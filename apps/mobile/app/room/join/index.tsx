import { StyleSheet, Text } from "react-native";

import { Screen } from "../../../src/components/ui";
import { JoinRoomForm } from "../../../src/features/room/join-room-form";
import { colors, typography } from "../../../src/theme";

/** Manual join screen (blank code). Thin wrapper around the JoinRoomForm feature. */
export default function JoinRoomScreen() {
  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Join with Code
      </Text>
      <Text style={styles.subtitle}>
        Enter the code your host shared to jump into their room.
      </Text>
      <JoinRoomForm />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.displayLgMobile, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
});
