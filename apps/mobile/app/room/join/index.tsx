import { ScrollView, StyleSheet, Text } from "react-native";

import { JoinRoomForm } from "../../../src/features/room/join-room-form";
import { colors, spacing } from "../../../src/theme";

/** Manual join screen (blank code). Thin wrapper around the JoinRoomForm feature. */
export default function JoinRoomScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Join a room</Text>
      <JoinRoomForm />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
});
