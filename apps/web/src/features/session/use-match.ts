import { getMatch, type MatchWithRestaurant } from "@munch/api-client";
import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/lib/supabase";

/**
 * Result-screen read: the session's match plus the matched DeckRestaurant. Both swipe-
 * screen entry paths (the swiper's submit_swipe response and a co-member's realtime
 * SessionMatchEvent) seed this cache key before navigating, so a fresh fetch only runs
 * on direct/refresh entry into the result route.
 */

export const matchKey = (sessionId: string) =>
  ["session-match", sessionId] as const;

async function fetchMatch(sessionId: string): Promise<MatchWithRestaurant> {
  const result = await getMatch(getSupabaseClient(), sessionId);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  if (!result.data) {
    // No match row yet — for the result screen this is an inconsistent state (the user
    // navigated here without a match), so surface a neutral message.
    throw new Error("No match for this session yet.");
  }
  return result.data;
}

export function useMatch(sessionId: string) {
  return useQuery<MatchWithRestaurant, Error>({
    queryKey: matchKey(sessionId),
    queryFn: () => fetchMatch(sessionId),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
