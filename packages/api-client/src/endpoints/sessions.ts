import {
  type DeckRestaurant,
  type ErrorCode,
  errorCodeSchema,
  type GetDeckRequest,
  type GetDeckResponse,
  type GetResolutionRankingRequest,
  type GetResolutionRankingResponse,
  type PriceLevel,
  type ResolveSessionRequest,
  type ResolveSessionResponse,
  type StartSessionRequest,
  type StartSessionResponse,
} from "@munch/core";
import { FunctionsHttpError } from "@supabase/functions-js";
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
 * Map a FunctionsHttpError (non-2xx) by reading its response body — the Edge Function
 * surfaces the standard `{ error: { code, message } }` envelope (supabase/functions/
 * _shared/errors.ts). We honor the code (incl. PROVIDER_ERROR) but ALWAYS replace the
 * message with the canonical safe one so raw text never leaks (docs/06 §8/§9). Any other
 * error (FunctionsFetchError network failure, FunctionsRelayError) falls through to
 * toApiError with a PROVIDER_ERROR fallback — start-session's only off-platform dependency
 * is the provider, so a transport failure is most usefully classified as one.
 */
async function mapInvokeError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const code = await readEnvelopeCode(error);
    if (code) {
      console.error("[api-client] start-session error", code);
      return makeApiError(code);
    }
  }
  return toApiError(error, "PROVIDER_ERROR");
}

/** Best-effort parse of the Edge Function's `{ error: { code, message } }` body. */
async function readEnvelopeCode(
  error: FunctionsHttpError,
): Promise<ErrorCode | null> {
  try {
    // FunctionsHttpError.context is typed `any` upstream but in practice is the Response.
    const response = error.context as { json: () => Promise<unknown> };
    const body = await response.json();
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
