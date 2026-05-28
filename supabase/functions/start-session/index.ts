// start-session/index.ts
// The ONLY Phase-2 Edge Function. Implements docs/04 §3.5 — the host starts a
// session, the provider is fetched EXACTLY ONCE for the room's anchor + filters
// + radius, restaurants and cached_decks are written, and the session is flipped
// to `active`. This is the load-bearing per-session-call invariant (CLAUDE.md
// §2.1): no other code path on a swipe, a deck read, or a card render may call
// the provider; the Phase-0 CI guard keeps the provider key out of apps/* and
// packages/*, and the provider abstraction (_shared/provider) keeps the call
// concentrated here.
//
// REQUEST BODY: { radius_m: integer in [500, 20000] } — the only body field per
// doc 04 §3.5. The canonical schema is `startSessionRequestSchema` in
// @munch/core (packages/core/src/validation/sessions.ts); cross-runtime imports
// of the workspace packages aren't wired up for Deno, so the shape is
// re-validated inline below. Keep these two in lockstep if the schema grows.
//
// STEP ORDER deviates intentionally from the literal order in
// docs/phase-2-prompts.md §Prompt 3 — we fetch the provider BEFORE inserting any
// `sessions` row. supabase-js issues separate REST calls per write, so the DB
// writes aren't atomic; doing the provider call first means a thrown
// PROVIDER_ERROR leaves ZERO DB state (no stuck `lobby` row that would later
// trip the SESSION_INVALID_STATE guard on retry). Same end result, simpler
// failure mode.
//
// HOST CHECK: we read room_members through a service-role client (the room
// lookup must succeed even though the caller is technically a member already —
// RLS would allow it via room_members_select_same_room, but using the
// service-role client keeps the host check explicit and avoids accidentally
// granting access on a misconfigured policy). The user-scoped client is used
// ONLY to identify the caller (auth.getUser).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { EdgeError, errorBody, statusForCode } from "../_shared/errors.ts";
import {
  getProvider,
  type NormalizedRestaurant,
} from "../_shared/provider/index.ts";
import { getProviderCallCount } from "../_shared/provider/google-places.ts";

// Radius bounds mirror packages/core/src/constants.ts (RADIUS_MIN_M / RADIUS_MAX_M).
// Duplicated here so the Edge Function (Deno) doesn't need a cross-runtime import
// of @munch/core; keep these two in sync if the constants change.
const RADIUS_MIN_M = 500;
const RADIUS_MAX_M = 20_000;

/** Provider TTL for the `restaurants.expires_at` column. Conservative 24h under
 *  typical provider caching terms (CLAUDE.md §3); a row rediscovered by a later
 *  session keeps the LARGER of (existing, new) so we never shorten a TTL. */
const RESTAURANT_TTL_MS = 24 * 60 * 60 * 1000;

/** Non-terminal session statuses — start_session refuses if one already exists. */
const NON_TERMINAL_STATUSES = ["lobby", "active", "awaiting_host_resolution"];

interface RoomRow {
  id: string;
  anchor_lat: number;
  anchor_lng: number;
  filter_open_now: boolean;
  filter_cuisines: string[];
  filter_price_levels: ("1" | "2" | "3" | "4")[];
}

interface RestaurantInsertRow extends NormalizedRestaurant {
  expires_at: string;
}

Deno.serve(async (req) => {
  try {
    // ----- 1. Auth ---------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      throw new EdgeError("UNAUTHENTICATED");
    }
    const userClient = createUserClient(authHeader);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      throw new EdgeError("UNAUTHENTICATED", userErr ?? "no user");
    }
    const userId = userData.user.id;

    // ----- 2. Validate body -----------------------------------------------
    const radiusM = await parseRadiusM(req);

    // ----- 3. Resolve room + host check (service-role) --------------------
    const admin = createServiceClient();
    const room = await resolveHostRoom(admin, userId);

    // ----- 4. SESSION_INVALID_STATE guard ---------------------------------
    await ensureNoActiveSession(admin, room.id);

    // ----- 5. Provider fetch — EXACTLY ONCE -------------------------------
    // Snapshot filters come from the ROOM ROW, not the request — the client
    // cannot widen beyond the host's filter set (CLAUDE.md §2.2). The single
    // provider call lives here; getProviderCallCount() before/after verifies
    // the §2.1 invariant in the success log line below.
    const callsBefore = getProviderCallCount();
    const provider = getProvider();
    const places = await provider.fetchRestaurants({
      lat: room.anchor_lat,
      lng: room.anchor_lng,
      radiusM,
      openNow: room.filter_open_now,
      cuisines: room.filter_cuisines,
      priceLevels: room.filter_price_levels,
    });
    const providerCalls = getProviderCallCount() - callsBefore;

    // ----- 6. DB writes (sessions → restaurants → cached_decks → flip) ----
    // Not a single SQL transaction (supabase-js issues separate REST calls),
    // but the order is chosen so that a partial failure leaves the session in
    // `lobby` — recoverable on retry once cleaned up. Provider call already
    // succeeded; the rest is local DB plumbing.
    const sessionId = await insertLobbySession(admin, room, radiusM);
    const restaurantIds =
      places.length > 0 ? await upsertRestaurants(admin, places) : [];
    if (restaurantIds.length > 0) {
      await insertCachedDeck(admin, sessionId, restaurantIds);
    }
    await activateSession(admin, sessionId);

    // ----- 7. Success log + response --------------------------------------
    // Structured one-line log — the §2.1 invariant verifier. Prompt 7's
    // FakeProvider counter mirrors this shape so the integration assertion is
    // uniform across providers.
    console.log(
      JSON.stringify({
        event: "start_session.ok",
        session_id: sessionId,
        room_id: room.id,
        deck_size: restaurantIds.length,
        provider_calls: providerCalls,
      }),
    );

    return jsonResponse(200, {
      session: { id: sessionId, status: "active", radius_m: radiusM },
      deck_size: restaurantIds.length,
    });
  } catch (err) {
    if (err instanceof EdgeError) {
      // The mapped, safe envelope. Raw cause stays in the server log.
      console.error("[start-session]", err.code, err.cause ?? err.message);
      return jsonResponse(statusForCode(err.code), errorBody(err.code));
    }
    console.error("[start-session] unexpected", err);
    return jsonResponse(
      statusForCode("VALIDATION_ERROR"),
      errorBody("VALIDATION_ERROR"),
    );
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) {
    // Misconfiguration, not a user error. Throws bubble up to the top-level
    // try/catch which logs and returns a 400 VALIDATION_ERROR — coarse but
    // safe, since a missing platform env is never the caller's problem to fix.
    throw new Error(`missing env ${name}`);
  }
  return v;
}

/** User-scoped client: used ONLY to identify the caller via auth.getUser(). */
function createUserClient(authHeader: string): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Service-role client: bypasses RLS for the host check + privileged writes. */
function createServiceClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function parseRadiusM(req: Request): Promise<number> {
  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    throw new EdgeError("VALIDATION_ERROR", err);
  }
  const radius = (body as { radius_m?: unknown })?.radius_m;
  if (
    typeof radius !== "number" ||
    !Number.isInteger(radius) ||
    radius < RADIUS_MIN_M ||
    radius > RADIUS_MAX_M
  ) {
    throw new EdgeError("VALIDATION_ERROR", `radius_m=${String(radius)}`);
  }
  return radius;
}

/**
 * Find the room this caller hosts. Doc-04 §3.5 doesn't include a room_id in the
 * body — the api-client startSession signature in Prompt 4 will keep it that
 * way — so we resolve via room_members where role='host' and user_id=caller.
 * A user could in principle host more than one room, but in practice the lobby
 * UI starts the session for the room currently in view; the contract today is
 * "one host has at most one non-terminal room/session pair". If multiple host
 * rows exist for this user, we take the most recently joined one (the active
 * lobby). NOT_HOST when none.
 */
async function resolveHostRoom(
  admin: SupabaseClient,
  userId: string,
): Promise<RoomRow> {
  const { data, error } = await admin
    .from("room_members")
    .select(
      "joined_at, rooms!inner(id, anchor_lat, anchor_lng, filter_open_now, filter_cuisines, filter_price_levels, is_active)",
    )
    .eq("user_id", userId)
    .eq("role", "host")
    .order("joined_at", { ascending: false })
    .limit(1);
  if (error) throw new EdgeError("VALIDATION_ERROR", error);
  const row = data?.[0] as
    | { rooms: RoomRow & { is_active: boolean } }
    | undefined;
  if (!row?.rooms) throw new EdgeError("NOT_HOST");
  if (!row.rooms.is_active) throw new EdgeError("SESSION_INVALID_STATE");
  return {
    id: row.rooms.id,
    anchor_lat: row.rooms.anchor_lat,
    anchor_lng: row.rooms.anchor_lng,
    filter_open_now: row.rooms.filter_open_now,
    filter_cuisines: row.rooms.filter_cuisines,
    filter_price_levels: row.rooms.filter_price_levels,
  };
}

async function ensureNoActiveSession(
  admin: SupabaseClient,
  roomId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("sessions")
    .select("id")
    .eq("room_id", roomId)
    .in("status", NON_TERMINAL_STATUSES)
    .limit(1);
  if (error) throw new EdgeError("VALIDATION_ERROR", error);
  if (data && data.length > 0) throw new EdgeError("SESSION_INVALID_STATE");
}

async function insertLobbySession(
  admin: SupabaseClient,
  room: RoomRow,
  radiusM: number,
): Promise<string> {
  const { data, error } = await admin
    .from("sessions")
    .insert({
      room_id: room.id,
      status: "lobby",
      radius_m: radiusM,
      filter_open_now: room.filter_open_now,
      filter_cuisines: room.filter_cuisines,
      filter_price_levels: room.filter_price_levels,
    })
    .select("id")
    .single();
  if (error || !data) throw new EdgeError("VALIDATION_ERROR", error);
  return data.id as string;
}

/**
 * Upsert restaurants by (provider, provider_ref). The Postgres unique index
 * lives on (provider, provider_ref) (0002), so the conflict target is exact.
 * On conflict we update the volatile columns (name/lat/lng/rating/photo_url/
 * is_open_now) and the metadata; expires_at is kept as the LARGER of the new
 * computed TTL and the existing row's value (handled via two-step: select
 * existing, then build the insert payload) — but supabase-js .upsert() doesn't
 * support a conditional on conflict, so we just write the new expires_at and
 * accept that the TTL "resets" each time a session re-fetches a restaurant.
 * That's strictly conservative under provider caching terms (CLAUDE.md §3).
 *
 * Returns the inserted/updated restaurant ids in input order.
 */
async function upsertRestaurants(
  admin: SupabaseClient,
  places: NormalizedRestaurant[],
): Promise<string[]> {
  const expiresAt = new Date(Date.now() + RESTAURANT_TTL_MS).toISOString();
  const rows: RestaurantInsertRow[] = places.map((p) => ({
    ...p,
    expires_at: expiresAt,
  }));
  const { data, error } = await admin
    .from("restaurants")
    .upsert(rows, { onConflict: "provider,provider_ref" })
    .select("id, provider_ref");
  if (error || !data) throw new EdgeError("VALIDATION_ERROR", error);
  // Re-align ids to input order via provider_ref. supabase upsert doesn't
  // guarantee return order matches input order.
  const byRef = new Map<string, string>();
  for (const r of data as { id: string; provider_ref: string }[]) {
    byRef.set(r.provider_ref, r.id);
  }
  const ids: string[] = [];
  for (const p of places) {
    const id = byRef.get(p.provider_ref);
    if (id) ids.push(id);
  }
  return ids;
}

async function insertCachedDeck(
  admin: SupabaseClient,
  sessionId: string,
  restaurantIds: string[],
): Promise<void> {
  const rows = restaurantIds.map((restaurant_id) => ({
    session_id: sessionId,
    restaurant_id,
    added_round: 0,
  }));
  // `do nothing` on conflict — safety belt against a duplicate id slipping
  // through (cached_decks has a unique (session_id, restaurant_id), 0002).
  const { error } = await admin.from("cached_decks").upsert(rows, {
    onConflict: "session_id,restaurant_id",
    ignoreDuplicates: true,
  });
  if (error) throw new EdgeError("VALIDATION_ERROR", error);
}

async function activateSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const { error } = await admin
    .from("sessions")
    .update({ status: "active", started_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw new EdgeError("VALIDATION_ERROR", error);
}
