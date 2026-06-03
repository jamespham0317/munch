import type { DeckRestaurant, SessionStatus } from "@munch/core";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { RadiusSlider } from "../../components/radius-slider";
import { SwipeCard } from "../../components/swipe-card";
import { colors, spacing } from "../../theme";
import { ResolutionView } from "./resolution-view";
import { useActiveSession } from "./use-active-session";
import { useDeck } from "./use-deck";
import { useSwipeSession } from "./use-swipe-session";

/**
 * Swipe screen orchestration (RN parity with apps/web's SessionView). Reads the active
 * session (for its snapshotted radius + initial status) and the cached deck (once —
 * CLAUDE.md §2.1), then threads both through useSwipeSession. From there the live session
 * status drives the view: the swipe UI while `active`, the host-resolution view while
 * `awaiting_host_resolution`, and navigation to the result screen / lobby on the terminal
 * transitions — all owned by useSwipeSession's realtime channel; this view just renders.
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
  // matched/resolved → result, cancelled → /lobby). After that, a stale getActiveSession
  // re-read returning null — e.g. an app-focus refetch once the session reaches a terminal
  // state — must NOT bounce us, or it would race the runner's own navigation. So this lobby
  // bounce only guards INITIAL entry with no live session (getActiveSession includes the
  // non-terminal awaiting_host_resolution, so host resolution never bounces).
  const tookOver = useRef(false);
  useEffect(() => {
    if (sessionQuery.isPending) return;
    if (tookOver.current) return;
    if (!activeSession || activeSession.id !== sessionId) {
      router.replace({ pathname: "/room/[roomId]/lobby", params: { roomId } });
    }
  }, [activeSession, sessionId, sessionQuery.isPending, roomId, router]);

  if (sessionQuery.isPending || deckQuery.isPending) {
    return <Text style={styles.muted}>Loading session…</Text>;
  }
  if (sessionQuery.isError) {
    return (
      <Text style={styles.error} accessibilityRole="alert">
        {sessionQuery.error.message}
      </Text>
    );
  }
  if (deckQuery.isError) {
    return (
      <Text style={styles.error} accessibilityRole="alert">
        {deckQuery.error.message}
      </Text>
    );
  }
  if (!activeSession || activeSession.id !== sessionId) {
    return <Text style={styles.muted}>Returning to lobby…</Text>;
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
    return <Text style={styles.muted}>Wrapping up…</Text>;
  }

  return (
    <View style={styles.container}>
      <RadiusSlider
        valueM={swipe.radiusM}
        maxM={sessionRadiusM}
        onChange={swipe.setRadiusM}
      />
      {swipe.error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {swipe.error.message}
        </Text>
      ) : null}
      {swipe.currentCard ? (
        <SwipeCard
          restaurant={swipe.currentCard}
          onLike={() => swipe.swipe("like")}
          onPass={() => swipe.swipe("pass")}
          disabled={swipe.isSubmitting}
        />
      ) : swipe.isExhausted ? (
        <Text style={styles.muted}>
          No match yet — keep this screen open while others finish swiping.
        </Text>
      ) : (
        <Text style={styles.muted}>
          No restaurants in this radius. Widen the slider above.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  muted: { color: colors.textMuted },
  error: { color: colors.error },
});
