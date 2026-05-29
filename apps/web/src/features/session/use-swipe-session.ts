import {
  getRoomMembers,
  type SessionEvent,
  submitSwipe,
  subscribeSession,
} from "@munch/api-client";
import {
  type DeckRestaurant,
  type RoomMember,
  type SessionStatus,
  shuffleDeck,
  type SubmitSwipeRequest,
  type SubmitSwipeResponse,
} from "@munch/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";

import { deckKey } from "./use-deck";
import { matchKey } from "./use-match";

/**
 * Owns the swipe screen's data flow:
 *   1. Resolve the caller's member id from the room's members + the current auth user
 *      (same lookup the lobby does — both screens dedupe through the QueryClient).
 *   2. Derive this member's deterministic order via shuffleDeck (seed = memberId +
 *      sessionId) over the cached, immutable deck.
 *   3. Submit each Like/Pass via the submit_swipe RPC; on a `match` response, seed the
 *      result-screen cache and route to /result.
 *   4. Subscribe to subscribeSession so co-members receive the same match event and
 *      track the authoritative session status. The status drives the screen (the swipe
 *      UI vs. the host-resolution view, owned by SessionView); a `matched`/`resolved`
 *      status routes everyone to /result, a `cancelled` status routes to /lobby, and an
 *      `awaiting_host_resolution → active` transition is a host widen (see below).
 *
 * Per CLAUDE.md §2.1 the deck is fetched ONCE at session start (see useDeck) and again only
 * when the host WIDENS — the one extra provider call lives server-side in resolve-session,
 * and on the resulting `active` status we re-read the (now larger) cached deck via getDeck;
 * no swipe ever triggers a refetch. Per CLAUDE.md §2.3 the server is the only thing that
 * declares a match — the client never derives one from local swipe state.
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
  /** Live, server-authoritative session status (seeded from the initial read, then realtime). */
  status: SessionStatus;
  /** True when the caller is the room host — gates the host-resolution controls. */
  isHost: boolean;
}

export function useSwipeSession(
  roomId: string,
  sessionId: string,
  deck: DeckRestaurant[],
  sessionRadiusM: number,
  initialStatus: SessionStatus,
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

  const me = useMemo(() => {
    const userId = userQuery.data?.id;
    if (!userId || !membersQuery.data) return null;
    return membersQuery.data.find((member) => member.userId === userId) ?? null;
  }, [membersQuery.data, userQuery.data]);
  const memberId = me?.id ?? null;
  const isHost = me?.role === "host";

  // Live session status. Seeded from the initial active-session read and advanced by the
  // realtime channel below; SessionView renders the swipe UI vs. the host-resolution view
  // off this value (CLAUDE.md §2.3 — status is server-authoritative, never derived locally).
  const [status, setStatus] = useState<SessionStatus>(initialStatus);

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
        router.replace(`/room/${roomId}/result?sessionId=${sessionId}`);
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
  // on the result screen with the same payload. Status transitions drive the rest:
  //   * matched / resolved  → /result (a unanimous match or the host accepting a top pick);
  //   * cancelled           → /lobby  (host left mid-session, CLAUDE.md §2.3 exception);
  //   * awaiting_host_resolution → SessionView swaps in the host-resolution view (no nav);
  //   * active (arriving after awaiting) → a host WIDEN: re-read the now-larger cached deck.
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
          router.replace(`/room/${roomId}/result?sessionId=${sessionId}`);
          return;
        }
        const nextStatus = event.payload.status;
        setStatus(nextStatus);
        if (nextStatus === "matched" || nextStatus === "resolved") {
          router.replace(`/room/${roomId}/result?sessionId=${sessionId}`);
        } else if (nextStatus === "cancelled") {
          router.replace(`/room/${roomId}/lobby`);
        } else if (nextStatus === "active") {
          // A widen round just appended unseen cards to cached_decks (the single extra
          // provider call happened server-side in resolve-session — CLAUDE.md §2.1).
          // Invalidate the one-shot deck read so useDeck refetches the larger deck; the
          // shuffled/remaining memos below filter out this member's already-swiped ids,
          // so only the newly-appended cards surface. The status event only carries
          // `active` on a real change (subscribeSession de-dupes), so this never fires at
          // mount — it is exclusively the awaiting_host_resolution → active resume.
          void queryClient.invalidateQueries({ queryKey: deckKey(sessionId) });
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
    status,
    isHost,
  };
}
