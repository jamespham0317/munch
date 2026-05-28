"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { RadiusSlider } from "@/components/radius-slider";
import { SwipeCard } from "@/components/swipe-card";

import { useActiveSession } from "./use-active-session";
import { useDeck } from "./use-deck";
import { useSwipeSession } from "./use-swipe-session";

/**
 * Swipe screen orchestration. Reads the active session (for its snapshotted radius +
 * status sanity), the cached deck (once — CLAUDE.md §2.1), and threads both through the
 * useSwipeSession hook. The result screen / lobby navigations all happen inside
 * useSwipeSession via the subscribeSession realtime channel; this view just renders.
 */
export function SessionView({
  roomId,
  sessionId,
}: {
  roomId: string;
  sessionId: string;
}) {
  const router = useRouter();
  const sessionQuery = useActiveSession(roomId);
  const deckQuery = useDeck(sessionId);

  const activeSession = sessionQuery.data ?? null;
  // Active session ended (cancelled/matched/resolved) or never existed → bounce back to
  // the lobby. useSwipeSession also routes to /result on a `matched` event arriving via
  // realtime, so the common case ("we matched") is covered there before this fires.
  useEffect(() => {
    if (sessionQuery.isPending) return;
    if (!activeSession || activeSession.id !== sessionId) {
      router.replace(`/room/${roomId}/lobby`);
    }
  }, [activeSession, sessionId, sessionQuery.isPending, roomId, router]);

  if (sessionQuery.isPending || deckQuery.isPending) {
    return <p>Loading session…</p>;
  }
  if (sessionQuery.isError) {
    return <p role="alert">{sessionQuery.error.message}</p>;
  }
  if (deckQuery.isError) {
    return <p role="alert">{deckQuery.error.message}</p>;
  }
  if (!activeSession || activeSession.id !== sessionId) {
    return <p>Returning to lobby…</p>;
  }

  return (
    <SwipeRunner
      roomId={roomId}
      sessionId={sessionId}
      deck={deckQuery.data}
      sessionRadiusM={activeSession.radiusM}
    />
  );
}

/**
 * Inner component so useSwipeSession only mounts once we have the deck + session radius —
 * hooks can't be conditional, and useSwipeSession subscribes a realtime channel on mount
 * which we want gated on those preconditions.
 */
function SwipeRunner({
  roomId,
  sessionId,
  deck,
  sessionRadiusM,
}: {
  roomId: string;
  sessionId: string;
  deck: import("@munch/core").DeckRestaurant[];
  sessionRadiusM: number;
}) {
  const swipe = useSwipeSession(roomId, sessionId, deck, sessionRadiusM);

  return (
    <section>
      <RadiusSlider
        valueM={swipe.radiusM}
        maxM={sessionRadiusM}
        onChange={swipe.setRadiusM}
      />
      {swipe.error ? <p role="alert">{swipe.error.message}</p> : null}
      {swipe.currentCard ? (
        <SwipeCard
          restaurant={swipe.currentCard}
          onLike={() => swipe.swipe("like")}
          onPass={() => swipe.swipe("pass")}
          disabled={swipe.isSubmitting}
        />
      ) : swipe.isExhausted ? (
        <p>No match yet — keep this tab open while others finish swiping.</p>
      ) : (
        <p>No restaurants in this radius. Widen the slider above.</p>
      )}
    </section>
  );
}
