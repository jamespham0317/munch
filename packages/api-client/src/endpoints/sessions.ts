import {
  type DeckRestaurant,
  type ErrorCode,
  errorCodeSchema,
  type GetDeckRequest,
  type GetDeckResponse,
  type GetResolutionRankingRequest,
  type GetResolutionRankingResponse,
  type MatchInfo,
  type MatchResolution,
  type PriceLevel,
  type ResolveSessionRequest,
  type ResolveSessionResponse,
  type Session,
  type SessionStatus,
  type StartSessionRequest,
  type StartSessionResponse,
} from "@munch/core";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import {
  type ClientResult,
  makeApiError,
  notImplemented,
  toApiError,
} from "../errors";

/**
 * Session endpoints (docs/04 §3.5–§3.6, §3.8–§3.9). Phase-2 lights up startSession
 * (Edge Function call — the provider key is server-only, CLAUDE.md §2.1) and
 * getDeck (security-invoker RPC read; RLS via cached_decks_select_member +
 * restaurants_select_deck_member). §3.8/§3.9 remain Phase-3 stubs.
 */

type RpcResult<T> = { data: T | null; error: PostgrestError | null };

// --- 3.5 start_session ------------------------------------------------------

/**
 * Raw success body of the start-session Edge Function (matches doc-04 §3.5 verbatim;
 * snake_case wire shape == @munch/core's StartSessionResponse type).
 */
interface RawStartSessionResponse {
  session: { id: string; status: "active"; radius_m: number };
  deck_size: number;
}

/**
 * The shape `functions.invoke<T>()` resolves to. The library types its `error` as `any` on
 * the failure branch; we narrow it to `unknown` so mapInvokeError can classify it safely.
 */
type InvokeResult<T> =
  | { data: T; error: null }
  | { data: null; error: unknown };

/**
 * startSession (docs/04 §3.5, host only). Calls the start-session Edge Function, which is
 * the ONLY path that touches the provider — the per-session-call invariant (CLAUDE.md §2.1)
 * lives server-side. PROVIDER_ERROR is the one fallback that must reach the UI so it can
 * offer retry copy; every other failure maps via the standard envelope.
 */
export async function startSession(
  client: SupabaseClient,
  req: StartSessionRequest,
): Promise<ClientResult<StartSessionResponse>> {
  const { data, error } =
    (await client.functions.invoke<RawStartSessionResponse>("start-session", {
      body: { radius_m: req.radius_m },
    })) as InvokeResult<RawStartSessionResponse>;
  if (error || !data) {
    return { data: null, error: await mapInvokeError(error) };
  }
  return {
    data: {
      session: {
        id: data.session.id,
        status: data.session.status,
        radius_m: data.session.radius_m,
      },
      deck_size: data.deck_size,
    },
    error: null,
  };
}

/**
 * Map a non-2xx invoke result by reading the Edge Function's `{ error: { code, message } }`
 * envelope (supabase/functions/_shared/errors.ts). We honor the code (incl. PROVIDER_ERROR)
 * but ALWAYS replace the message with the canonical safe one so raw text never leaks
 * (docs/06 §8/§9). A genuine transport error (FunctionsFetchError / FunctionsRelayError) has
 * no envelope and falls through to PROVIDER_ERROR — start-session's only off-platform
 * dependency is the provider, so that's the most useful classification.
 */
async function mapInvokeError(error: unknown) {
  const code = await readEnvelopeCode(error);
  if (code) {
    console.error("[api-client] start-session error", code);
    return makeApiError(code);
  }
  return toApiError(error, "PROVIDER_ERROR");
}

/**
 * Best-effort parse of the Edge Function's `{ error: { code, message } }` body. We duck-type
 * the error's `context` (the underlying Response) rather than relying on
 * `instanceof FunctionsHttpError`: supabase-js carries its own bundled @supabase/functions-js,
 * so an error it throws is often a DIFFERENT class instance than the one this package imports,
 * and `instanceof` then silently fails — collapsing every edge error onto the PROVIDER_ERROR
 * fallback. Reading `context.json()` is robust to that.
 */
async function readEnvelopeCode(error: unknown): Promise<ErrorCode | null> {
  const context = (error as { context?: unknown } | null | undefined)?.context;
  if (
    context === null ||
    typeof context !== "object" ||
    typeof (context as { json?: unknown }).json !== "function"
  ) {
    return null;
  }
  try {
    const body = await (context as { json: () => Promise<unknown> }).json();
    const raw =
      typeof body === "object" && body !== null && "error" in body
        ? (body as { error?: { code?: unknown } }).error?.code
        : undefined;
    const parsed = errorCodeSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// --- 3.6 get_deck -----------------------------------------------------------

/** The raw row shape returned by `get_deck_for_session` (0009). snake_case == DeckRestaurant. */
interface RawDeckRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  // numeric(2,1) and integer can arrive as string from PostgREST in some configs.
  rating: number | string | null;
  price_level: PriceLevel | null;
  cuisines: string[];
  photo_url: string | null;
  is_open_now: boolean | null;
  distance_m: number | string;
}

/**
 * getDeck (docs/04 §3.6). Thin call to the security-invoker `get_deck_for_session` RPC; the
 * server computes `distance_m` (haversine_m) against the room anchor so the client never
 * needs the anchor. The per-member shuffle order is derived in @munch/core/shuffle.ts; the
 * deck itself is static for the session (CLAUDE.md §2.1) so callers should fetch this once.
 */
export async function getDeck(
  client: SupabaseClient,
  req: GetDeckRequest,
): Promise<ClientResult<GetDeckResponse>> {
  const { data: raw, error } = (await client.rpc("get_deck_for_session", {
    p_session_id: req.session_id,
  })) as RpcResult<RawDeckRow[]>;
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  return {
    data: { restaurants: (raw ?? []).map(mapDeckRow) },
    error: null,
  };
}

function mapDeckRow(row: RawDeckRow): DeckRestaurant {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    rating: row.rating === null ? null : Number(row.rating),
    price_level: row.price_level,
    cuisines: row.cuisines,
    photo_url: row.photo_url,
    is_open_now: row.is_open_now,
    distance_m: Number(row.distance_m),
  };
}

// --- session + match read helpers (Phase 2 UI plumbing) ---------------------

const SESSION_COLUMNS =
  "id, room_id, status, radius_m, filter_open_now, filter_cuisines, " +
  "filter_price_levels, started_at, ended_at, matched_restaurant_id, created_at";

interface SessionRow {
  id: string;
  room_id: string;
  status: SessionStatus;
  radius_m: number;
  filter_open_now: boolean;
  filter_cuisines: string[];
  filter_price_levels: PriceLevel[];
  started_at: string | null;
  ended_at: string | null;
  matched_restaurant_id: string | null;
  created_at: string;
}

function mapSessionRow(row: SessionRow): Session {
  return {
    id: row.id,
    roomId: row.room_id,
    status: row.status,
    radiusM: row.radius_m,
    filterOpenNow: row.filter_open_now,
    filterCuisines: row.filter_cuisines,
    filterPriceLevels: row.filter_price_levels,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    matchedRestaurantId: row.matched_restaurant_id,
    createdAt: row.created_at,
  };
}

/**
 * Read the room's latest non-terminal session (lobby/active), if any. RLS
 * (sessions_select_member from 0003) scopes this to rooms the caller belongs to.
 * Used by the lobby to decide whether to auto-route members into the swipe screen
 * when the host starts a session. Returns `null` when no such session exists.
 */
export async function getActiveSession(
  client: SupabaseClient,
  roomId: string,
): Promise<ClientResult<Session | null>> {
  const { data, error } = await client
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("room_id", roomId)
    .in("status", ["lobby", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<SessionRow[]>();
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  const row = data[0];
  return { data: row ? mapSessionRow(row) : null, error: null };
}

/** The matched restaurant payload returned by getMatch — the result screen's data. */
export interface MatchWithRestaurant {
  match: MatchInfo;
  restaurant: DeckRestaurant;
}

interface RawMatchRow {
  restaurant_id: string;
  resolution: MatchResolution;
}

/**
 * Read the session's match outcome plus the matched restaurant card under RLS
 * (matches_select_member + restaurants_select_deck_member from 0003/0009). Used by
 * the result screen so it works for the swiper (who already has the payload from
 * submit_swipe's response, but may refresh) and for co-members who entered via the
 * subscribeSession match event. Returns `null` when no match has been recorded yet.
 */
export async function getMatch(
  client: SupabaseClient,
  sessionId: string,
): Promise<ClientResult<MatchWithRestaurant | null>> {
  const { data: matchData, error: matchError } = await client
    .from("matches")
    .select("restaurant_id, resolution")
    .eq("session_id", sessionId)
    .maybeSingle()
    .returns<RawMatchRow | null>();
  if (matchError) {
    return { data: null, error: toApiError(matchError) };
  }
  if (!matchData) {
    return { data: null, error: null };
  }
  const deck = await getDeck(client, { session_id: sessionId });
  if (deck.error) {
    return { data: null, error: deck.error };
  }
  const restaurant = deck.data.restaurants.find(
    (r) => r.id === matchData.restaurant_id,
  );
  if (!restaurant) {
    // The matched restaurant must be in the session's cached deck; if it isn't, the
    // session state is inconsistent — surface a safe VALIDATION_ERROR rather than the
    // raw "row missing" to the UI.
    console.error(
      "[api-client] getMatch: matched restaurant not in cached deck",
    );
    return { data: null, error: toApiError(null) };
  }
  return {
    data: {
      match: {
        restaurant_id: matchData.restaurant_id,
        restaurant_name: restaurant.name,
        resolution: matchData.resolution,
      },
      restaurant,
    },
    error: null,
  };
}

// --- 3.8 / 3.9 stay stubbed until Phase 3 -----------------------------------

export function getResolutionRanking(
  _client: SupabaseClient,
  _req: GetResolutionRankingRequest,
): Promise<ClientResult<GetResolutionRankingResponse>> {
  // TODO(Phase 3): closest-to-unanimous ranking — fewest passes → rating →
  // distance, NOT raw like count (CLAUDE.md §2.4).
  return notImplemented("get_resolution_ranking", "Phase 3");
}

export function resolveSession(
  _client: SupabaseClient,
  _req: ResolveSessionRequest,
): Promise<ClientResult<ResolveSessionResponse>> {
  // TODO(Phase 3): accept_top, or widen with ONE extra provider fetch (CLAUDE.md §2.1).
  return notImplemented("resolve_session", "Phase 3");
}
