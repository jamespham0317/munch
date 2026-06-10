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
  type RankingEntry,
  type ResolveSessionRequest,
  type ResolveSessionResponse,
  type Session,
  type SessionStatus,
  type StartSessionRequest,
  type StartSessionResponse,
} from "@munch/core";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { type ClientResult, makeApiError, toApiError } from "../errors";

/**
 * Session endpoints (docs/04 §3.5–§3.6, §3.8–§3.9). startSession (§3.5) and resolveSession
 * (§3.9) call Edge Functions — the provider key is server-only (CLAUDE.md §2.1); getDeck
 * (§3.6) and getResolutionRanking (§3.8) are RPC reads (the ranking RPC is security-definer
 * and host-only, raising NOT_HOST/SESSION_INVALID_STATE as its exception message).
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
    return { data: null, error: await mapInvokeError(error, "start-session") };
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
 * no envelope and falls through to PROVIDER_ERROR — the provider is the only off-platform
 * dependency of either Edge Function (start-session, and resolve-session's widen), so that's
 * the most useful classification and the one widen needs to offer retry copy.
 */
async function mapInvokeError(error: unknown, fn: string) {
  const code = await readEnvelopeCode(error);
  if (code) {
    console.error(`[api-client] ${fn} error`, code);
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
 * Read the room's latest non-terminal session, if any. RLS (sessions_select_member from
 * 0003) scopes this to rooms the caller belongs to. Used by the lobby to decide whether to
 * auto-route members into the swipe screen when the host starts a session, and by the swipe
 * screen to seed the live session status on (re)entry — including `awaiting_host_resolution`,
 * which is non-terminal (the host can still widen back to `active`), so a refresh during host
 * resolution lands on the resolution view rather than bouncing to the lobby. The terminal
 * states (`matched`/`resolved`/`cancelled`) are excluded. Returns `null` when no such session
 * exists.
 */
export async function getActiveSession(
  client: SupabaseClient,
  roomId: string,
): Promise<ClientResult<Session | null>> {
  const { data, error } = await client
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("room_id", roomId)
    .in("status", ["lobby", "active", "awaiting_host_resolution"])
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

// --- 3.8 get_resolution_ranking --------------------------------------------

/**
 * Raw row shape of the `get_resolution_ranking` RPC (0015). snake_case == RankingEntry.
 * Like mapDeckRow, the numeric/integer columns can arrive as string from PostgREST.
 */
interface RawRankingRow {
  restaurant_id: string;
  name: string;
  pass_count: number | string;
  like_count: number | string;
  member_count: number | string;
  rating: number | string | null;
  distance_m: number | string;
}

/**
 * getResolutionRanking (docs/04 §3.8, host only). Thin call to the security-definer
 * `get_resolution_ranking` RPC, which reads ALL active members' swipes and orders the deck
 * closest-to-unanimous server-side (fewest passes → highest rating → nearest distance,
 * CLAUDE.md §2.4). The RPC raises NOT_HOST / SESSION_INVALID_STATE / UNAUTHENTICATED as its
 * exception message; toApiError maps each onto the matching ErrorCode (raw text never leaks).
 */
export async function getResolutionRanking(
  client: SupabaseClient,
  req: GetResolutionRankingRequest,
): Promise<ClientResult<GetResolutionRankingResponse>> {
  const { data: raw, error } = (await client.rpc("get_resolution_ranking", {
    p_session_id: req.session_id,
  })) as RpcResult<RawRankingRow[]>;
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  return {
    data: { ranking: (raw ?? []).map(mapRankingRow) },
    error: null,
  };
}

function mapRankingRow(row: RawRankingRow): RankingEntry {
  return {
    restaurant_id: row.restaurant_id,
    name: row.name,
    pass_count: Number(row.pass_count),
    like_count: Number(row.like_count),
    member_count: Number(row.member_count),
    rating: row.rating === null ? null : Number(row.rating),
    distance_m: Number(row.distance_m),
  };
}

// --- 3.9 resolve_session ----------------------------------------------------

/**
 * Raw success body of the resolve-session Edge Function (docs/04 §3.9, verbatim). Both arms
 * are already the snake_case wire shape == @munch/core's ResolveSessionResponse; the action
 * is discriminated server-side, so the body is one of these two shapes per request.
 */
type RawResolveSessionResponse =
  | { session: { status: SessionStatus }; match: MatchInfo }
  | { session: { status: SessionStatus }; new_restaurants: number };

/**
 * resolveSession (docs/04 §3.9, host only). Calls the resolve-session Edge Function, passing
 * the discriminated-union request straight through — the server validates and dispatches by
 * `action`. accept_top makes ZERO provider calls; widen makes EXACTLY ONE (the only new
 * provider call this phase, CLAUDE.md §2.1) — both live server-side because widen needs the
 * server-only provider key. A transport failure maps to PROVIDER_ERROR so the UI can offer
 * widen-retry copy; envelope codes (NOT_HOST, SESSION_INVALID_STATE, …) map via mapInvokeError.
 */
export async function resolveSession(
  client: SupabaseClient,
  req: ResolveSessionRequest,
): Promise<ClientResult<ResolveSessionResponse>> {
  const { data, error } =
    (await client.functions.invoke<RawResolveSessionResponse>(
      "resolve-session",
      { body: req },
    )) as InvokeResult<RawResolveSessionResponse>;
  if (error || !data) {
    return {
      data: null,
      error: await mapInvokeError(error, "resolve-session"),
    };
  }
  // Structural narrow on the discriminated body (same approach as startSession): the wire
  // shape is already snake_case, so we pass each arm through unchanged.
  if ("match" in data) {
    return {
      data: { session: { status: data.session.status }, match: data.match },
      error: null,
    };
  }
  return {
    data: {
      session: { status: data.session.status },
      new_restaurants: data.new_restaurants,
    },
    error: null,
  };
}
