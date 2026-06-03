import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

import { LobbyView } from "../../../src/features/room/lobby-view";
import { colors, spacing, typography } from "../../../src/theme";

/**
 * Lobby screen. Thin wrapper around the LobbyView feature (CLAUDE.md §4). LobbyView owns
 * its own header ("Waiting for the crew…", pages.md §3.5), so the route only supplies the
 * cream screen container and the missing-param fallback.
 */
export default function LobbyScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {roomId ? (
        <LobbyView roomId={roomId} />
      ) : (
        <Text style={styles.muted}>Missing room.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.screenMarginMobile, gap: spacing.md },
  muted: { ...typography.bodyMd, color: colors.textMuted },
});
