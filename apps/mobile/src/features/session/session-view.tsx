import type { DeckRestaurant } from "@munch/core";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { RadiusSlider } from "../../components/radius-slider";
import { SwipeCard } from "../../components/swipe-card";
import { colors, spacing } from "../../theme";
import { useActiveSession } from "./use-active-session";
import { useDeck } from "./use-deck";
import { useSwipeSession } from "./use-swipe-session";

/**
 * Swipe screen orchestration (RN parity with apps/web's SessionView). Reads the active
 * session (for its snapshotted radius + status sanity), the cached deck (once —
 * CLAUDE.md §2.1), and threads both through the useSwipeSession hook. The result
 * screen / lobby navigations all happen inside useSwipeSession via the
 * subscribeSession realtime channel; this view just renders.
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
  // the lobby. useSwipeSession also routes to the result screen on a `matched` event
  // arriving via realtime, so the common case ("we matched") is covered there before
  // this fires.
  useEffect(() => {
    if (sessionQuery.isPending) return;
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
  deck: DeckRestaurant[];
  sessionRadiusM: number;
}) {
  const swipe = useSwipeSession(roomId, sessionId, deck, sessionRadiusM);

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
  container: { gap: spacing.lg },
  muted: { color: colors.textMuted },
  error: { color: colors.danger },
});
