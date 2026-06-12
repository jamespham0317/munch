import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../../src/components/ui";
import { CreateRoomForm } from "../../src/features/room/create-room-form";
import { colors, spacing, typography } from "../../src/theme";

/** Create-room screen. Thin wrapper around the CreateRoomForm feature (CLAUDE.md §4). */
export default function CreateRoomScreen() {
  return (
    <Screen>
      <View style={styles.brandRow}>
        <MaterialCommunityIcons
          name="silverware-fork-knife"
          size={24}
          color={colors.heat}
        />
        <Text style={styles.brand}>Munch</Text>
      </View>

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
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  brand: { ...typography.titleLg, color: colors.text },
  title: { ...typography.displayLgMobile, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
});
