import type {
  MatchInfo,
  SubmitSwipeRequest,
  SubmitSwipeResponse,
} from "@munch/core";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { type ClientResult, toApiError } from "../errors";

/**
 * `submit_swipe` (docs/04 §3.7) — the hot path. The authoritative unanimous match check
 * runs server-side in a transaction (0010); the client never declares a match
 * (CLAUDE.md §2.3). No provider call ever happens on a swipe (CLAUDE.md §2.1).
 *
 * The RPC raises any of UNAUTHENTICATED / FORBIDDEN / SESSION_INVALID_STATE / VALIDATION_ERROR
 * as the exception MESSAGE — toApiError maps the message onto the matching ErrorCode (the
 * RPC_ERROR_CODES set in errors.ts). Raw DB text is never surfaced.
 *
 * The RPC returns `jsonb` whose shape already matches SubmitSwipeResponse (snake_case wire
 * shape), so the boundary "map" is just a structural narrow.
 */

type RpcResult<T> = { data: T | null; error: PostgrestError | null };

interface RawSubmitSwipeResponse {
  recorded: boolean;
  match: MatchInfo | null;
}

export async function submitSwipe(
  client: SupabaseClient,
  req: SubmitSwipeRequest,
): Promise<ClientResult<SubmitSwipeResponse>> {
  const { data: raw, error } = (await client.rpc("submit_swipe", {
    p_session_id: req.session_id,
    p_restaurant_id: req.restaurant_id,
    p_decision: req.decision,
  })) as RpcResult<RawSubmitSwipeResponse>;
  if (error || !raw) {
    return { data: null, error: toApiError(error) };
  }
  return {
    data: { recorded: raw.recorded, match: raw.match },
    error: null,
  };
}
