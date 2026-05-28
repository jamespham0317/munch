import {
  getRoomMembers,
  type SessionEvent,
  submitSwipe,
  subscribeSession,
} from "@munch/api-client";
import {
  type DeckRestaurant,
  type RoomMember,
  shuffleDeck,
  type SubmitSwipeRequest,
  type SubmitSwipeResponse,
} from "@munch/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "../../lib/supabase";
import { matchKey } from "./use-match";

/**
 * Owns the swipe screen's data flow (RN parity with apps/web's useSwipeSession):
 *   1. Resolve the caller's member id from the room's members + the current auth user
 *      (same lookup the lobby does — both screens dedupe through the QueryClient).
 *   2. Derive this member's deterministic order via shuffleDeck (seed = memberId +
 *      sessionId) over the cached, immutable deck.
 *   3. Submit each Like/Pass via the submit_swipe RPC; on a `match` response, seed the
 *      result-screen cache and route to the result screen.
 *   4. Subscribe to subscribeSession so co-members receive the same match event and
 *      route to the same result screen; route to /lobby on a `cancelled` status.
 *
 * Per CLAUDE.md §2.1 the deck is fetched ONCE (see useDeck); no swipe ever triggers a
 * refetch. Per CLAUDE.md §2.3 the server is the only thing that declares a match — the
 * client never derives one from local swipe state.
 */

const membersKey = (roomId: string) => ["room-members", roomId] as const;
const sessionUserKey = ["session-user"] as const;

async function fetchMembers(roomId: string): Promise<RoomMember[]> {
  const result = await getRoomMembers(getSupabaseClient(), roomId);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

interface SessionUser {
  id: string;
}

async function fetchSessionUser(): Promise<SessionUser | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id } : null;
}

export interface SwipeSession {
  /** Cards in this member's shuffled, radius-filtered order. */
  visibleDeck: DeckRestaurant[];
  /** The card currently shown, or null when the visible deck is exhausted. */
  currentCard: DeckRestaurant | null;
  /** Local radius slider value in metres; defaults to the deck-wide max distance. */
  radiusM: number;
  setRadiusM: (value: number) => void;
  /** Submit a swipe for `currentCard`. */
  swipe: (decision: "like" | "pass") => void;
  /** True while the submit_swipe RPC is in flight. */
  isSubmitting: boolean;
  /** Last RPC error, if any (safe message — never raw DB text). */
  error: Error | null;
  /** True once every card in the radius-filtered deck has been swiped this session. */
  isExhausted: boolean;
}

export function useSwipeSession(
  roomId: string,
  sessionId: string,
  deck: DeckRestaurant[],
  sessionRadiusM: number,
): SwipeSession {
  const router = useRouter();
  const queryClient = useQueryClient();

  const membersQuery = useQuery<RoomMember[], Error>({
    queryKey: membersKey(roomId),
    queryFn: () => fetchMembers(roomId),
    retry: false,
  });
  const userQuery = useQuery<SessionUser | null, Error>({
    queryKey: sessionUserKey,
    queryFn: fetchSessionUser,
    retry: false,
  });

  const memberId = useMemo(() => {
    const userId = userQuery.data?.id;
    if (!userId || !membersQuery.data) return null;
    return (
      membersQuery.data.find((member) => member.userId === userId)?.id ?? null
    );
  }, [membersQuery.data, userQuery.data]);

  const shuffled = useMemo(() => {
    if (!memberId) return [];
    return shuffleDeck(deck, { memberId, sessionId });
  }, [deck, memberId, sessionId]);

  // Local radius slider state. Per CLAUDE.md §2.1 changing this NEVER refetches the
  // provider — it just filters the already-cached deck locally. The slider starts at
  // the session's snapshotted radius (= the radius the deck was fetched at) so every
  // card is visible by default; sliding it down narrows the visible deck. A widen-style
  // refetch is Phase 3 (resolveSession action='widen').
  const [radiusM, setRadiusM] = useState<number>(sessionRadiusM);

  const visibleDeck = useMemo(
    () => shuffled.filter((r) => r.distance_m <= radiusM),
    [shuffled, radiusM],
  );

  // Track which cards the caller has already swiped this session — keyed by restaurant id
  // so a radius change can't "un-swipe" a card. Sliding the radius narrower hides
  // unswiped cards beyond the value; sliding it wider re-exposes them in order.
  const [swipedIds, setSwipedIds] = useState<Set<string>>(() => new Set());
  const remaining = useMemo(
    () => visibleDeck.filter((r) => !swipedIds.has(r.id)),
    [visibleDeck, swipedIds],
  );
  const currentCard = remaining[0] ?? null;
  const isExhausted = visibleDeck.length > 0 && remaining.length === 0;

  const mutation = useMutation<
    SubmitSwipeResponse,
    Error,
    SubmitSwipeRequest & { card: DeckRestaurant }
  >({
    mutationFn: async ({ card: _card, ...req }) => {
      const result = await submitSwipe(getSupabaseClient(), req);
      if (result.error) {
        throw new Error(result.error.error.message);
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      // Always advance, even on a `null` match — the card has been recorded server-side.
      setSwipedIds((current) => {
        const next = new Set(current);
        next.add(variables.restaurant_id);
        return next;
      });
      if (data.match) {
        // Seed the result-screen cache so the navigation is instant for the swiper; the
        // co-member path seeds the same key from the realtime handler below.
        queryClient.setQueryData(matchKey(sessionId), {
          match: data.match,
          restaurant: variables.card,
        });
        router.replace({
          pathname: "/room/[roomId]/result",
          params: { roomId, sessionId },
        });
      }
    },
  });

  function swipe(decision: "like" | "pass") {
    if (!currentCard || mutation.isPending) return;
    mutation.mutate({
      session_id: sessionId,
      restaurant_id: currentCard.id,
      decision,
      card: currentCard,
    });
  }

  // Subscribe to the session's authoritative state. The realtime helper already fetches
  // the matched DeckRestaurant for SessionMatchEvent, so co-members and the swiper land
  // on the result screen with the same payload. A status transition to `cancelled`
  // (host left mid-session) routes back to the lobby.
  useEffect(() => {
    const client = getSupabaseClient();
    const channel = subscribeSession(
      client,
      sessionId,
      (event: SessionEvent) => {
        if (event.kind === "match") {
          queryClient.setQueryData(matchKey(sessionId), {
            match: event.payload.match,
            restaurant: event.payload.restaurant,
          });
          router.replace({
            pathname: "/room/[roomId]/result",
            params: { roomId, sessionId },
          });
          return;
        }
        if (
          event.payload.status === "cancelled" ||
          event.payload.status === "resolved"
        ) {
          router.replace({
            pathname: "/room/[roomId]/lobby",
            params: { roomId },
          });
        }
      },
    );
    return () => {
      void client.removeChannel(channel);
    };
  }, [roomId, sessionId, router, queryClient]);

  return {
    visibleDeck,
    currentCard,
    radiusM,
    setRadiusM,
    swipe,
    isSubmitting: mutation.isPending,
    error: mutation.error,
    isExhausted,
  };
}
