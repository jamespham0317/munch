import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";

import { Screen } from "../../../src/components/ui";
import { SessionView } from "../../../src/features/session/session-view";
import { colors, typography } from "../../../src/theme";

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
    <Screen>
      {roomId && sessionId ? (
        <SessionView roomId={roomId} sessionId={sessionId} />
      ) : (
        <Text style={styles.muted}>Missing session.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.bodyMd, color: colors.textMuted },
});
