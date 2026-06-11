import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";

import { Screen } from "../../../src/components/ui";
import { ResultView } from "../../../src/features/session/result-view";
import { colors, typography } from "../../../src/theme";

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
    <Screen>
      {sessionId ? (
        <ResultView sessionId={sessionId} />
      ) : (
        <Text style={styles.muted}>Missing session.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.bodyMd, color: colors.textMuted },
});
