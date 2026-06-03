"use client";

import type { DeckRestaurant, SessionStatus } from "@munch/core";
import { SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { RadiusSlider } from "@/components/radius-slider";
import { SwipeCard } from "@/components/swipe-card";
import { cx } from "@/components/ui/cx";

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
    return <p className="text-body-md text-text-muted">Loading session…</p>;
  }
  if (sessionQuery.isError) {
    return (
      <p role="alert" className="text-body-md text-error">
        {sessionQuery.error.message}
      </p>
    );
  }
  if (deckQuery.isError) {
    return (
      <p role="alert" className="text-body-md text-error">
        {deckQuery.error.message}
      </p>
    );
  }
  if (!activeSession || activeSession.id !== sessionId) {
    return <p className="text-body-md text-text-muted">Returning to lobby…</p>;
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
  deck: DeckRestaurant[];
  sessionRadiusM: number;
  initialStatus: SessionStatus;
}) {
  const swipe = useSwipeSession(
    roomId,
    sessionId,
    deck,
    sessionRadiusM,
    initialStatus,
  );

  // The radius "narrow" control lives behind an "Adjust" affordance (pages.md §3.6) instead
  // of being permanently open; toggling it only shows/hides the existing local slider — the
  // setRadiusM wiring is unchanged and never refetches the provider (CLAUDE.md §2.1).
  const [adjustOpen, setAdjustOpen] = useState(false);

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
        deck={deck}
      />
    );
  }
  // Terminal transitions (matched/resolved/cancelled) navigate away inside useSwipeSession;
  // render a neutral placeholder while that route change is in flight.
  if (swipe.status !== "active" && swipe.status !== "lobby") {
    return <p className="text-body-md text-text-muted">Wrapping up…</p>;
  }

  return (
    <section className="flex flex-col gap-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-base">
          <UtensilsCrossed size={24} className="text-heat" aria-hidden />
          <span className="text-title-lg text-text">Munch</span>
        </div>
        <button
          type="button"
          onClick={() => setAdjustOpen((open) => !open)}
          aria-label="Adjust distance"
          aria-expanded={adjustOpen}
          className={cx(
            "inline-flex min-h-11 items-center gap-xs rounded-full px-gutter text-label-md uppercase text-text transition-transform active:translate-y-[var(--munch-press-translate-y)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40",
            adjustOpen ? "bg-surface-highest" : "bg-surface-raised",
          )}
        >
          <SlidersHorizontal size={14} aria-hidden />
          Adjust
        </button>
      </div>

      {adjustOpen ? (
        <div className="rounded-md bg-surface p-gutter shadow-low">
          <RadiusSlider
            valueM={swipe.radiusM}
            maxM={sessionRadiusM}
            onChange={swipe.setRadiusM}
          />
        </div>
      ) : null}

      {swipe.error ? (
        <p role="alert" className="text-body-md text-error">
          {swipe.error.message}
        </p>
      ) : null}
      {swipe.currentCard ? (
        <SwipeCard
          restaurant={swipe.currentCard}
          onLike={() => swipe.swipe("like")}
          onPass={() => swipe.swipe("pass")}
          disabled={swipe.isSubmitting}
        />
      ) : swipe.isExhausted ? (
        <p className="text-body-md text-text-muted">
          No match yet — keep this screen open while others finish swiping.
        </p>
      ) : (
        <p className="text-body-md text-text-muted">
          No restaurants in this radius. Tap Adjust to widen the distance.
        </p>
      )}
    </section>
  );
}
