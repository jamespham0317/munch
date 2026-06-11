// resolve-session/index.ts
// The Phase-3 host-resolution endpoint (docs/04 §3.9) — ONE Edge Function handling
// BOTH actions on a session stuck in `awaiting_host_resolution`:
//
//   • accept_top — the host accepts the closest-to-unanimous pick. Writes `matches`
//     (resolution = 'host_accepted_top'), flips the session to `resolved`. ZERO
//     provider calls.
//   • widen — one EXTRA provider fetch for restaurants NOT already in the deck,
//     appended to cached_decks at added_round = n+1, session back to `active`.
//     EXACTLY ONE provider call (CLAUDE.md §2.1 — widen is the only new provider call).
//
// WHY an Edge Function and not an RPC (docs/04 §3.9, CLAUDE.md §2.1/§3): widen needs the
// server-only provider key, which can only live in Edge Function env. accept_top rides
// along in the same function (service-role writes to `matches` + `sessions`) so there is
// ONE endpoint and the host check + state guard are shared across both actions. This
// mirrors start-session: user JWT identifies the caller, a service-role client does the
// privileged work, the single provider call is counted at the boundary, and a structured
// log line is the §2.1 invariant verifier.
//
// REQUEST BODY: the resolve_session discriminated union from @munch/core
// (packages/core/src/validation/sessions.ts, resolveSessionRequestSchema). Cross-runtime
// imports of the workspace packages aren't wired for Deno, so the shape is re-validated
// inline below — keep the two in lockstep if the schema grows.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  insertCachedDeck,
  RESTAURANT_TTL_MS,
  upsertRestaurants,
} from "../_shared/deck.ts";
import {
  EdgeError,
  errorBody,
  ProviderError,
  statusForCode,
} from "../_shared/errors.ts";
import {
  getProvider,
  getProviderCallCount,
} from "../_shared/provider/index.ts";

// Radius bounds mirror packages/core/src/constants.ts (RADIUS_MIN_M / RADIUS_MAX_M) and
// start-session — duplicated so the Edge Function (Deno) needs no @munch/core import.
const RADIUS_MIN_M = 500;
const RADIUS_MAX_M = 20_000;

type PriceLevel = "1" | "2" | "3" | "4";

/** The session row fields resolve_session needs: state guard + the widen snapshot. */
interface SessionRow {
  id: string;
  room_id: string;
  status: string;
  radius_m: number;
  filter_open_now: boolean;
  filter_cuisines: string[];
  filter_price_levels: PriceLevel[];
}

interface RoomAnchorRow {
  id: string;
  anchor_lat: number;
  anchor_lng: number;
}

/** Validated request body — the inline mirror of resolveSessionRequestSchema. */
type ResolveRequest =
  | { sessionId: string; action: "accept_top"; restaurantId: string }
  | {
      sessionId: string;
      action: "widen";
      radiusM?: number;
      filters?: {
        open_now?: boolean;
        cuisines?: string[];
        price_levels?: PriceLevel[];
      };
    };

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
    const body = await parseBody(req);

    // ----- 3. Resolve session + room + host check (service-role) ----------
    // Unlike start-session (which resolves the host's room), resolve_session carries the
    // session_id, so we resolve the session first, then its room, then assert the caller
    // hosts that room. A nonexistent session has no room → NOT_HOST: never leak existence
    // (consistent with get_resolution_ranking, 0015).
    const admin = createServiceClient();
    const session = await resolveSession(admin, body.sessionId);
    await ensureHost(admin, session.room_id, userId);

    // ----- 4. SESSION_INVALID_STATE guard ---------------------------------
    // Both actions require an awaiting_host_resolution session (docs/04 §3.9).
    if (session.status !== "awaiting_host_resolution") {
      throw new EdgeError("SESSION_INVALID_STATE", `status=${session.status}`);
    }

    // ----- 5. Dispatch by action ------------------------------------------
    if (body.action === "accept_top") {
      return await handleAcceptTop(admin, session, body.restaurantId);
    }
    return await handleWiden(admin, session, body);
  } catch (err) {
    if (err instanceof EdgeError) {
      // The mapped, safe envelope. Raw cause stays in the server log.
      console.error("[resolve-session]", err.code, err.cause ?? err.message);
      return jsonResponse(statusForCode(err.code), errorBody(err.code));
    }
    console.error("[resolve-session] unexpected", err);
    return jsonResponse(
      statusForCode("VALIDATION_ERROR"),
      errorBody("VALIDATION_ERROR"),
    );
  }
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * accept_top — the host accepts a pick. ZERO provider calls. The restaurant must be in
 * this session's cached deck (VALIDATION_ERROR otherwise). The match insert is idempotent
 * (matches.session_id is unique, 0002) and the session update is guarded on the
 * awaiting_host_resolution status so a double-resolve / racing widen is a no-op.
 */
async function handleAcceptTop(
  admin: SupabaseClient,
  session: SessionRow,
  restaurantId: string,
): Promise<Response> {
  // The pick must be a card already in this session's deck.
  const { data: deckRow, error: deckErr } = await admin
    .from("cached_decks")
    .select("restaurant_id")
    .eq("session_id", session.id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (deckErr) throw new EdgeError("VALIDATION_ERROR", deckErr);
  if (!deckRow)
    throw new EdgeError("VALIDATION_ERROR", "restaurant not in deck");

  // Idempotent: on a second accept the existing matches row stays put.
  const { error: matchErr } = await admin.from("matches").upsert(
    {
      session_id: session.id,
      restaurant_id: restaurantId,
      resolution: "host_accepted_top",
    },
    { onConflict: "session_id", ignoreDuplicates: true },
  );
  if (matchErr) throw new EdgeError("VALIDATION_ERROR", matchErr);

  // Retention hook: snapshot a match_history row for each signed-in present member
  // (guests get none — CLAUDE.md §3). The signed-in-only + snapshot logic lives in ONE
  // place (record_match_history, migration 0016), shared with submit_swipe's unanimous
  // path — call it via the service-role client rather than re-implementing it. Called
  // AFTER the matches row exists (the function reads matches) but BEFORE the session flip,
  // so a failure leaves the session in awaiting_host_resolution and the host can simply
  // retry accept (both the match upsert and this insert are idempotent). ZERO provider calls.
  const { error: histErr } = await admin.rpc("record_match_history", {
    p_session_id: session.id,
  });
  if (histErr) throw new EdgeError("VALIDATION_ERROR", histErr);

  // Guard on awaiting_host_resolution so we never resolve a session twice or race a widen.
  const { error: sessErr } = await admin
    .from("sessions")
    .update({
      status: "resolved",
      matched_restaurant_id: restaurantId,
      ended_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("status", "awaiting_host_resolution");
  if (sessErr) throw new EdgeError("VALIDATION_ERROR", sessErr);

  // Name for the announcement payload (docs/04 §3.9 accept response).
  const { data: restRow, error: restErr } = await admin
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .single();
  if (restErr || !restRow) throw new EdgeError("VALIDATION_ERROR", restErr);

  // Structured §2.1 verifier — accept makes ZERO provider calls.
  console.log(
    JSON.stringify({
      event: "resolve_session.accept.ok",
      session_id: session.id,
      room_id: session.room_id,
      provider_calls: 0,
    }),
  );

  return jsonResponse(200, {
    session: { status: "resolved" },
    match: {
      restaurant_id: restaurantId,
      restaurant_name: restRow.name as string,
      resolution: "host_accepted_top",
    },
  });
}

/**
 * widen — one EXTRA provider fetch for unseen restaurants, appended to the deck; session
 * back to `active`. The provider call happens BEFORE any DB write (same failure-mode
 * reasoning as start-session): a thrown PROVIDER_ERROR leaves the session untouched in
 * awaiting_host_resolution, so the host can simply retry widen or accept the top pick.
 * Earlier swipes/likes are never deleted — they still count toward a later unanimous match.
 */
async function handleWiden(
  admin: SupabaseClient,
  session: SessionRow,
  body: Extract<ResolveRequest, { action: "widen" }>,
): Promise<Response> {
  const room = await resolveRoomAnchor(admin, session.room_id);

  // excludeProviderRefs = every provider_ref already in this session's deck, so the
  // provider yields only unseen places (the on-conflict guard in insertCachedDeck is the
  // safety belt behind it).
  const excludeProviderRefs = await deckProviderRefs(admin, session.id);

  // Effective widen params: body overrides, falling back to the session snapshot for any
  // field omitted (so a second widen round builds on the first). A widen may only BROADEN
  // the candidate pool — raise the radius, add cuisines/prices, or clear a restriction to
  // "any" — never narrow it (feature spec §5); the anchor is unchanged so distances are
  // unaffected. The non-narrowing rule is enforced just below.
  const radiusM = body.radiusM ?? session.radius_m;
  const openNow = body.filters?.open_now ?? session.filter_open_now;
  const cuisines = body.filters?.cuisines ?? session.filter_cuisines;
  const priceLevels = body.filters?.price_levels ?? session.filter_price_levels;

  // Authoritative widen-only guard (feature spec §5). Inline mirror of @munch/core
  // isNonNarrowingWiden — Deno can't import the workspace package, so keep these in lockstep
  // (same pattern as the RADIUS bounds above). A non-narrowing UI never trips this; it is
  // defense-in-depth against a crafted request. open_now is locked (an omitted field falls
  // back to the snapshot, so it only narrows if a body explicitly flips it).
  if (
    radiusM < session.radius_m ||
    openNow !== session.filter_open_now ||
    !setFilterIsBroaderOrEqual(session.filter_cuisines, cuisines) ||
    !setFilterIsBroaderOrEqual(session.filter_price_levels, priceLevels)
  ) {
    throw new EdgeError("VALIDATION_ERROR", "widen must not narrow the pool");
  }

  // ----- Provider fetch — EXACTLY ONCE, before any DB write ----------------
  const callsBefore = getProviderCallCount();
  let places;
  try {
    places = await getProvider().fetchRestaurants({
      lat: room.anchor_lat,
      lng: room.anchor_lng,
      radiusM,
      openNow,
      cuisines,
      priceLevels,
      excludeProviderRefs,
    });
  } catch (err) {
    // Never surface the raw provider response (CLAUDE.md §3).
    throw err instanceof EdgeError ? err : new ProviderError(err);
  }
  const providerCalls = getProviderCallCount() - callsBefore;

  // Persist the widened snapshot (omitted fields keep their current value) so a later
  // widen round builds on this one.
  const { error: snapErr } = await admin
    .from("sessions")
    .update({
      radius_m: radiusM,
      filter_open_now: openNow,
      filter_cuisines: cuisines,
      filter_price_levels: priceLevels,
    })
    .eq("id", session.id);
  if (snapErr) throw new EdgeError("VALIDATION_ERROR", snapErr);

  // Append the new cards at the next round. The provider already excluded seen refs, so
  // `new_restaurants` is the count it returned; the on-conflict guard is belt-and-suspenders.
  const nextRound = await nextAddedRound(admin, session.id);
  if (places.length > 0) {
    const restaurantIds = await upsertRestaurants(
      admin,
      places,
      RESTAURANT_TTL_MS,
    );
    await insertCachedDeck(admin, session.id, restaurantIds, nextRound);
  }

  // Back to swiping. Guarded on awaiting_host_resolution to avoid racing a concurrent accept.
  const { error: sessErr } = await admin
    .from("sessions")
    .update({ status: "active" })
    .eq("id", session.id)
    .eq("status", "awaiting_host_resolution");
  if (sessErr) throw new EdgeError("VALIDATION_ERROR", sessErr);

  // Structured §2.1 verifier — widen makes EXACTLY ONE provider call.
  console.log(
    JSON.stringify({
      event: "resolve_session.widen.ok",
      session_id: session.id,
      room_id: session.room_id,
      provider_calls: providerCalls,
      new_restaurants: places.length,
    }),
  );

  return jsonResponse(200, {
    session: { status: "active" },
    new_restaurants: places.length,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Inline mirror of @munch/core `setFilterIsBroaderOrEqual` (feature spec §5; the workspace
 * package can't be imported into Deno — keep in lockstep). An EMPTY set means "no
 * restriction = all values = widest". Returns true iff the requested set does not narrow the
 * result vs the session set: requested empty is always broadest; restricting an empty
 * session set narrows; otherwise the request must be a superset of the session set.
 */
function setFilterIsBroaderOrEqual(
  sessionSet: string[],
  requestedSet: string[],
): boolean {
  if (requestedSet.length === 0) return true;
  if (sessionSet.length === 0) return false;
  const requested = new Set(requestedSet);
  return sessionSet.every((value) => requested.has(value));
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) {
    // Misconfiguration, not a user error — bubbles to the top-level catch as a coarse but
    // safe VALIDATION_ERROR (a missing platform env is never the caller's problem to fix).
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

/**
 * Parse + validate the request body against the resolve_session discriminated union
 * (inline mirror of @munch/core resolveSessionRequestSchema). Maps snake_case wire fields
 * to the internal camelCase shape. Any malformed input is a VALIDATION_ERROR.
 */
async function parseBody(req: Request): Promise<ResolveRequest> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch (err) {
    throw new EdgeError("VALIDATION_ERROR", err);
  }
  const b = (raw ?? {}) as Record<string, unknown>;
  const sessionId = b.session_id;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new EdgeError("VALIDATION_ERROR", "session_id");
  }

  if (b.action === "accept_top") {
    const restaurantId = b.restaurant_id;
    if (typeof restaurantId !== "string" || restaurantId.length === 0) {
      throw new EdgeError("VALIDATION_ERROR", "restaurant_id");
    }
    return { sessionId, action: "accept_top", restaurantId };
  }

  if (b.action === "widen") {
    const radiusM = b.radius_m;
    if (radiusM !== undefined) {
      if (
        typeof radiusM !== "number" ||
        !Number.isInteger(radiusM) ||
        radiusM < RADIUS_MIN_M ||
        radiusM > RADIUS_MAX_M
      ) {
        throw new EdgeError("VALIDATION_ERROR", `radius_m=${String(radiusM)}`);
      }
    }
    return {
      sessionId,
      action: "widen",
      radiusM: radiusM as number | undefined,
      filters: parseFilters(b.filters),
    };
  }

  throw new EdgeError("VALIDATION_ERROR", `action=${String(b.action)}`);
}

/** Validate the optional widen `filters` partial. Unknown/extra keys are ignored. */
function parseFilters(
  raw: unknown,
): Extract<ResolveRequest, { action: "widen" }>["filters"] {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") {
    throw new EdgeError("VALIDATION_ERROR", "filters");
  }
  const f = raw as Record<string, unknown>;
  const out: NonNullable<
    Extract<ResolveRequest, { action: "widen" }>["filters"]
  > = {};

  if (f.open_now !== undefined) {
    if (typeof f.open_now !== "boolean") {
      throw new EdgeError("VALIDATION_ERROR", "filters.open_now");
    }
    out.open_now = f.open_now;
  }
  if (f.cuisines !== undefined) {
    if (
      !Array.isArray(f.cuisines) ||
      !f.cuisines.every((c) => typeof c === "string")
    ) {
      throw new EdgeError("VALIDATION_ERROR", "filters.cuisines");
    }
    out.cuisines = f.cuisines as string[];
  }
  if (f.price_levels !== undefined) {
    if (
      !Array.isArray(f.price_levels) ||
      !f.price_levels.every(
        (p) => p === "1" || p === "2" || p === "3" || p === "4",
      )
    ) {
      throw new EdgeError("VALIDATION_ERROR", "filters.price_levels");
    }
    out.price_levels = f.price_levels as PriceLevel[];
  }
  return out;
}

/** Fetch the session row needed for the host check, state guard, and widen snapshot. */
async function resolveSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<SessionRow> {
  const { data, error } = await admin
    .from("sessions")
    .select(
      "id, room_id, status, radius_m, filter_open_now, filter_cuisines, filter_price_levels",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new EdgeError("VALIDATION_ERROR", error);
  // No row → no room to host → NOT_HOST (don't leak existence).
  if (!data) throw new EdgeError("NOT_HOST", "session not found");
  return data as SessionRow;
}

/** Assert the caller is the host of the room. NOT_HOST otherwise. */
async function ensureHost(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("role", "host")
    .maybeSingle();
  if (error) throw new EdgeError("VALIDATION_ERROR", error);
  if (!data) throw new EdgeError("NOT_HOST");
}

/** The room anchor for the widen provider fetch (filters come from the session snapshot). */
async function resolveRoomAnchor(
  admin: SupabaseClient,
  roomId: string,
): Promise<RoomAnchorRow> {
  const { data, error } = await admin
    .from("rooms")
    .select("id, anchor_lat, anchor_lng")
    .eq("id", roomId)
    .single();
  if (error || !data) throw new EdgeError("VALIDATION_ERROR", error);
  return data as RoomAnchorRow;
}

/** provider_ref of every restaurant already in this session's deck (widen exclude set). */
async function deckProviderRefs(
  admin: SupabaseClient,
  sessionId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("cached_decks")
    .select("restaurants!inner(provider_ref)")
    .eq("session_id", sessionId);
  if (error) throw new EdgeError("VALIDATION_ERROR", error);
  const rows = (data ?? []) as { restaurants: { provider_ref: string } }[];
  return rows.map((r) => r.restaurants.provider_ref);
}

/** Next added_round for the session = current max + 1 (0 if the deck were somehow empty). */
async function nextAddedRound(
  admin: SupabaseClient,
  sessionId: string,
): Promise<number> {
  const { data, error } = await admin
    .from("cached_decks")
    .select("added_round")
    .eq("session_id", sessionId)
    .order("added_round", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new EdgeError("VALIDATION_ERROR", error);
  const max = (data as { added_round: number } | null)?.added_round;
  return (max ?? -1) + 1;
}
