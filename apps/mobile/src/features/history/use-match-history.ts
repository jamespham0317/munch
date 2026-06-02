import { getMatchHistory } from "@munch/api-client";
import type { MatchHistory } from "@munch/core";
import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * Read the signed-in caller's saved matches (docs/04 §3.9), RN parity with apps/web's
 * useMatchHistory. RLS scopes the read to their own rows; only signed-in users ever have rows
 * (CLAUDE.md §3 guest ephemerality). The caller gates this on a signed-in identity via
 * `enabled`, so a guest never fires the read expecting rows — they get the "sign in to save"
 * state instead. Endpoint shape/mapping lives in @munch/api-client (CLAUDE.md §4); the envelope
 * is rethrown so TanStack Query exposes it.
 */

export const matchHistoryKey = ["match-history"] as const;

async function fetchMatchHistory(): Promise<MatchHistory[]> {
  const result = await getMatchHistory(getSupabaseClient());
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

export function useMatchHistory(enabled: boolean) {
  return useQuery<MatchHistory[], Error>({
    queryKey: matchHistoryKey,
    queryFn: fetchMatchHistory,
    enabled,
    retry: false,
  });
}
