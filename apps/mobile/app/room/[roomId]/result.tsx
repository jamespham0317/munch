import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { ResultView } from "../../../src/features/session/result-view";
import { colors, spacing } from "../../../src/theme";

/**
 * Match announcement route. `sessionId` arrives as a search param from the swipe
 * screen (either entry path; see ResultView). Thin pass-through (CLAUDE.md §4).
 */
export default function ResultScreen() {
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
      <Text style={styles.title}>Match</Text>
      {sessionId ? (
        <ResultView sessionId={sessionId} />
      ) : (
        <Text style={styles.muted}>Missing session.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  muted: { color: colors.textMuted },
});
