"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { RadiusSlider } from "@/components/radius-slider";
import { SwipeCard } from "@/components/swipe-card";

import { ResolutionView } from "./resolution-view";
import { useActiveSession } from "./use-active-session";
import { useDeck } from "./use-deck";
import { useSwipeSession } from "./use-swipe-session";

/**
 * Swipe screen orchestration. Reads the active session (for its snapshotted radius +
 * initial status) and the cached deck (once — CLAUDE.md §2.1), then threads both through
 * useSwipeSession. From there the live session status drives the view: the swipe UI while
 * `active`, the host-resolution view while `awaiting_host_resolution`, and navigation to
 * /result or /lobby on the terminal transitions — all owned by useSwipeSession's realtime
 * channel; this view just renders.
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

  // Once SwipeRunner mounts it owns all navigation (via the realtime status channel:
  // matched/resolved → /result, cancelled → /lobby). After that, a stale getActiveSession
  // re-read returning null — e.g. a window-focus refetch once the session reaches a
  // terminal state — must NOT bounce us, or it would race the runner's own navigation. So
  // this lobby bounce only guards INITIAL entry with no live session (getActiveSession now
  // includes the non-terminal awaiting_host_resolution, so host resolution never bounces).
  const tookOver = useRef(false);
  useEffect(() => {
    if (sessionQuery.isPending) return;
    if (tookOver.current) return;
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

  tookOver.current = true;
  return (
    <SwipeRunner
      roomId={roomId}
      sessionId={sessionId}
      deck={deckQuery.data}
      sessionRadiusM={activeSession.radiusM}
      initialStatus={activeSession.status}
    />
  );
}

/**
 * Inner component so useSwipeSession only mounts once we have the deck + session radius —
 * hooks can't be conditional, and useSwipeSession subscribes a realtime channel on mount
 * which we want gated on those preconditions. Critically it stays mounted across the whole
 * resolution cycle (active → awaiting_host_resolution → active on a widen), so the member's
 * already-swiped set survives a widen and only the appended cards surface afterwards.
 */
function SwipeRunner({
  roomId,
  sessionId,
  deck,
  sessionRadiusM,
  initialStatus,
}: {
  roomId: string;
  sessionId: string;
  deck: import("@munch/core").DeckRestaurant[];
  sessionRadiusM: number;
  initialStatus: import("@munch/core").SessionStatus;
}) {
  const swipe = useSwipeSession(
    roomId,
    sessionId,
    deck,
    sessionRadiusM,
    initialStatus,
  );

  // Deck exhausted with no unanimous match → the server flipped the session to
  // awaiting_host_resolution; show the host the closest-to-unanimous ranking and everyone
  // else the passive "waiting on host" state (CLAUDE.md §2.3, §2.4).
  if (swipe.status === "awaiting_host_resolution") {
    return (
      <ResolutionView
        roomId={roomId}
        sessionId={sessionId}
        isHost={swipe.isHost}
        sessionRadiusM={sessionRadiusM}
      />
    );
  }
  // Terminal transitions (matched/resolved/cancelled) navigate away inside useSwipeSession;
  // render a neutral placeholder while that route change is in flight.
  if (swipe.status !== "active" && swipe.status !== "lobby") {
    return <p>Wrapping up…</p>;
  }

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
        <p>No match yet — waiting on the others to finish swiping.</p>
      ) : (
        <p>No restaurants in this radius. Widen the slider above.</p>
      )}
    </section>
  );
}
