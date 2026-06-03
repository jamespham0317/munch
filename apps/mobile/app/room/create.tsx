import { ScrollView, StyleSheet, Text } from "react-native";

import { CreateRoomForm } from "../../src/features/room/create-room-form";
import { colors, spacing } from "../../src/theme";

/** Create-room screen. Thin wrapper around the CreateRoomForm feature (CLAUDE.md §4). */
export default function CreateRoomScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Create a room</Text>
      <CreateRoomForm />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
});
