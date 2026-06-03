import { ScrollView, StyleSheet, Text } from "react-native";

import { CreateRoomForm } from "../../src/features/room/create-room-form";
import { colors, spacing, typography } from "../../src/theme";

/** Create-room screen. Thin wrapper around the CreateRoomForm feature (CLAUDE.md §4). */
export default function CreateRoomScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title} accessibilityRole="header">
        Start a Munch Group
      </Text>
      <Text style={styles.subtitle}>
        Set your vibes and let the group decide together.
      </Text>
      <CreateRoomForm />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.screenMarginMobile, gap: spacing.md },
  title: { ...typography.displayLgMobile, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
});
