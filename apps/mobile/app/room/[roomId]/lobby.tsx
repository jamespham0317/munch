import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

import { LobbyView } from "../../../src/features/room/lobby-view";
import { colors, spacing } from "../../../src/theme";

/** Lobby screen. Thin wrapper around the LobbyView feature (CLAUDE.md §4). */
export default function LobbyScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Room lobby</Text>
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
  content: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  muted: { color: colors.textMuted },
});
