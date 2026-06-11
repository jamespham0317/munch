import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { Screen } from "../../../src/components/ui";
import { LobbyView } from "../../../src/features/room/lobby-view";
import { colors, typography } from "../../../src/theme";

/**
 * Lobby screen. Thin wrapper around the LobbyView feature (CLAUDE.md §4). LobbyView owns
 * its own header ("Waiting for the crew…", 10-pages.md §3.5), so the route only supplies the
 * cream screen container and the missing-param fallback.
 */
export default function LobbyScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();

  return (
    <Screen>
      {roomId ? (
        <LobbyView roomId={roomId} />
      ) : (
        <Text style={styles.muted}>Missing room.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.bodyMd, color: colors.textMuted },
});
