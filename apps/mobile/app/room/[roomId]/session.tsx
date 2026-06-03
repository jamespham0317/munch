import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { SessionView } from "../../../src/features/session/session-view";
import { colors, spacing } from "../../../src/theme";

/**
 * Swipe screen route. `sessionId` arrives as a search param from the lobby's
 * start-session navigation (host) or the lobby's session-subscription auto-route
 * (members). Thin pass-through (CLAUDE.md §4); SessionView owns the data layer and the
 * realtime channel. Missing roomId/sessionId bounces back to the lobby.
 */
export default function SessionScreen() {
  const router = useRouter();
  const { roomId, sessionId } = useLocalSearchParams<{
    roomId: string;
    sessionId?: string;
  }>();

  useEffect(() => {
    if (roomId && !sessionId) {
      router.replace({ pathname: "/room/[roomId]/lobby", params: { roomId } });
    }
  }, [roomId, sessionId, router]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Swipe</Text>
      {roomId && sessionId ? (
        <SessionView roomId={roomId} sessionId={sessionId} />
      ) : (
        <Text style={styles.muted}>Missing session.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  muted: { color: colors.textMuted },
});
