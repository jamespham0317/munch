import { ScrollView, StyleSheet, Text } from "react-native";

import { JoinRoomForm } from "../../../src/features/room/join-room-form";
import { colors, spacing, typography } from "../../../src/theme";

/** Manual join screen (blank code). Thin wrapper around the JoinRoomForm feature. */
export default function JoinRoomScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title} accessibilityRole="header">
        Join with Code
      </Text>
      <Text style={styles.subtitle}>
        Enter the code your host shared to jump into their room.
      </Text>
      <JoinRoomForm />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.screenMarginMobile, gap: spacing.md },
  title: { ...typography.displayLgMobile, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
});
