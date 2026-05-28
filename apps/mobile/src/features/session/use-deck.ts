import { getDeck } from "@munch/api-client";
import type { DeckRestaurant } from "@munch/core";
import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * One-shot read of the session's cached deck (RN parity with apps/web's useDeck).
 * The deck is immutable for the session (per-session caching, CLAUDE.md §2.1), so
 * `staleTime: Infinity` keeps a single fetch pinned for the lifetime of the screen.
 * A swipe NEVER refetches this — that's the whole point of the cache.
 */

export const deckKey = (sessionId: string) => ["deck", sessionId] as const;

async function fetchDeck(sessionId: string): Promise<DeckRestaurant[]> {
  const result = await getDeck(getSupabaseClient(), { session_id: sessionId });
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data.restaurants;
}

export function useDeck(sessionId: string) {
  return useQuery<DeckRestaurant[], Error>({
    queryKey: deckKey(sessionId),
    queryFn: () => fetchDeck(sessionId),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
