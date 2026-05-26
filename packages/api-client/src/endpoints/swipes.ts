import type { SubmitSwipeRequest, SubmitSwipeResponse } from "@munch/core";
import type { SupabaseClient } from "@supabase/supabase-js";

import { type ClientResult, notImplemented } from "../errors";

/**
 * `submit_swipe` (docs/04 §3.7) — the hot path. The authoritative unanimous match
 * check runs server-side in a transaction; the client never declares a match
 * (CLAUDE.md §2.3). No provider call ever happens on a swipe (CLAUDE.md §2.1).
 * Stub only in Phase 0.
 */
export function submitSwipe(
  _client: SupabaseClient,
  _req: SubmitSwipeRequest,
): Promise<ClientResult<SubmitSwipeResponse>> {
  return notImplemented("submit_swipe", "Phase 2");
}
