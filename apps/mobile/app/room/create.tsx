import { StyleSheet, Text } from "react-native";

import { Screen } from "../../src/components/ui";
import { CreateRoomForm } from "../../src/features/room/create-room-form";
import { colors, typography } from "../../src/theme";

/** Create-room screen. Thin wrapper around the CreateRoomForm feature (CLAUDE.md §4). */
export default function CreateRoomScreen() {
  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Start a Munch Group
      </Text>
      <Text style={styles.subtitle}>
        Set your vibes and let the group decide together.
      </Text>
      <CreateRoomForm />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.displayLgMobile, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
});
