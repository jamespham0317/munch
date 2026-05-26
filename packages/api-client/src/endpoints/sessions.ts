import type {
  GetDeckRequest,
  GetDeckResponse,
  GetResolutionRankingRequest,
  GetResolutionRankingResponse,
  ResolveSessionRequest,
  ResolveSessionResponse,
  StartSessionRequest,
  StartSessionResponse,
} from "@munch/core";
import type { SupabaseClient } from "@supabase/supabase-js";

import { type ClientResult, notImplemented } from "../errors";

/**
 * Session endpoints (docs/04 §3.5–§3.6, §3.8–§3.9). Stubs only in Phase 0, typed
 * against the shared @munch/core schemas.
 */

export function startSession(
  _client: SupabaseClient,
  _req: StartSessionRequest,
): Promise<ClientResult<StartSessionResponse>> {
  // TODO(Phase 2): the provider deck is fetched server-side exactly ONCE here,
  // then cached for the session — never per swipe (CLAUDE.md §2.1).
  return notImplemented("start_session", "Phase 2");
}

export function getDeck(
  _client: SupabaseClient,
  _req: GetDeckRequest,
): Promise<ClientResult<GetDeckResponse>> {
  return notImplemented("get_deck", "Phase 2");
}

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
