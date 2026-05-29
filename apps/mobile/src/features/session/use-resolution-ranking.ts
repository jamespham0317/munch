import { getResolutionRanking } from "@munch/api-client";
import type { RankingEntry } from "@munch/core";
import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * Host-only read of the closest-to-unanimous ranking (docs/04 §3.8; RN parity with
 * apps/web's useResolutionRanking). The underlying RPC is security-definer and host-only —
 * it raises NOT_HOST for anyone else — so this query is gated to the host on an
 * awaiting_host_resolution session via the `enabled` flag; non-host members never call it
 * (their UI is the passive "waiting on host" state). The ordering (fewest passes → highest
 * rating → nearest distance, CLAUDE.md §2.4) is decided server-side; the UI renders the rows
 * as returned and treats the first as the suggested pick.
 */

export const resolutionRankingKey = (sessionId: string) =>
  ["resolution-ranking", sessionId] as const;

async function fetchResolutionRanking(
  sessionId: string,
): Promise<RankingEntry[]> {
  const result = await getResolutionRanking(getSupabaseClient(), {
    session_id: sessionId,
  });
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data.ranking;
}

export function useResolutionRanking(sessionId: string, enabled: boolean) {
  return useQuery<RankingEntry[], Error>({
    queryKey: resolutionRankingKey(sessionId),
    queryFn: () => fetchResolutionRanking(sessionId),
    enabled,
    retry: false,
  });
}
