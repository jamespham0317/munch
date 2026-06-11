"use client";

import type { DeckRestaurant, SessionStatus } from "@munch/core";
import { SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { RadiusSlider } from "@/components/radius-slider";
import { SwipeCard } from "@/components/swipe-card";
import { cx } from "@/components/ui/cx";
import { LeaveRoomControl } from "@/features/room/leave-room-control";
import { useRemovedRedirect } from "@/features/room/use-removed-redirect";
import { useRoomExit } from "@/features/room/use-room-exit";
import { useRoomMember } from "@/features/room/use-room-member";
import { useRoomPresence } from "@/features/room/use-room-presence";

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

  // Keepalive + cosmetic presence run for the whole swipe surface (heartbeat keeps the caller in
  // the cohort; presence is purely cosmetic). The membership channel inside useRoomPresence keeps
  // the shared member list live, so an external removal (auto-removal past the grace window, or a
  // host ending the room) surfaces as the caller dropping out of the active roster → route home.
  const { memberId, isHost, settled: membersSettled } = useRoomMember(roomId);
  useRoomPresence(roomId, memberId);
  const exit = useRoomExit(roomId);
  useRemovedRedirect({
    memberId,
    settled: membersSettled,
    suppressedRef: exit.exitingRef,
  });

  const activeSession = sessionQuery.data ?? null;
  const sessionMatches = activeSession?.id === sessionId;

  // Once SwipeRunner mounts it owns all navigation (via the realtime status channel:
  // matched/resolved → /result, cancelled → /lobby). After that, a stale getActiveSession
  // re-read returning null — e.g. a window-focus refetch once the session reaches a
  // terminal state — must NOT bounce us, or it would race the runner's own navigation. So
  // this lobby bounce only guards INITIAL entry with no live session (getActiveSession now
  // includes the non-terminal awaiting_host_resolution, so host resolution never bounces).
  //
  // It must also wait for the active-session query to SETTLE before bouncing. On a host start
  // we land here while the shared active-session cache still holds the lobby's stale `null`
  // (the lobby read it as "no session yet"); React Query refetches it on mount. Bouncing in
  // that window flips us to the lobby and straight back once the refetch resolves to the live
  // session — the session→lobby→session start flicker. `isFetching` covers both the first load
  // and the background refetch, so we only bounce on a CONFIRMED absent session.
  const tookOver = useRef(false);
  useEffect(() => {
    if (sessionQuery.isFetching) return;
    if (tookOver.current) return;
    if (!sessionMatches) {
      router.replace(`/room/${roomId}/lobby`);
    }
  }, [sessionMatches, sessionQuery.isFetching, roomId, router]);

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
    // Still settling (the active-session refetch right after a host start) vs. confirmed gone:
    // show a neutral "loading" while fetching so we never flash "Returning to lobby…" on the
    // way INTO a freshly started session — the effect above only bounces once it's settled.
    // The explicit null check (rather than `sessionMatches`) also narrows activeSession to
    // non-null for the SwipeRunner props below.
    return (
      <p className="text-body-md text-text-muted">
        {sessionQuery.isFetching ? "Loading session…" : "Returning to lobby…"}
      </p>
    );
  }

  tookOver.current = true;
  return (
    <SwipeRunner
      roomId={roomId}
      sessionId={sessionId}
      deck={deckQuery.data}
      sessionRadiusM={activeSession.radiusM}
      initialStatus={activeSession.status}
      isHost={isHost}
      exit={exit}
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
  isHost,
  exit,
}: {
  roomId: string;
  sessionId: string;
  deck: DeckRestaurant[];
  sessionRadiusM: number;
  initialStatus: SessionStatus;
  isHost: boolean;
  exit: ReturnType<typeof useRoomExit>;
}) {
  const swipe = useSwipeSession(
    roomId,
    sessionId,
    deck,
    sessionRadiusM,
    initialStatus,
  );

  // The radius "narrow" control lives behind an "Adjust" affordance (10-pages.md §3.6) instead
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

      <LeaveRoomControl isHost={isHost} exit={exit} context="session" />
    </section>
  );
}
