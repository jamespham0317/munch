import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef } from "react";
import { type ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "../../src/components/ui";
import { CreateRoomForm } from "../../src/features/room/create-room-form";
import { colors, spacing, typography } from "../../src/theme";

/** Create-room screen. Thin wrapper around the CreateRoomForm feature (CLAUDE.md §4). */
export default function CreateRoomScreen() {
  // The screen owns the ScrollView, so it owns the scroll position. The form requests a
  // scroll-to-the-name-field (its topmost element) via scrollToTop on an empty-name submit.
  const scrollRef = useRef<ScrollView>(null);
  return (
    <Screen scrollRef={scrollRef}>
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
      <CreateRoomForm
        scrollToTop={() =>
          scrollRef.current?.scrollTo({ y: 0, animated: true })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  brand: { ...typography.titleLg, color: colors.text },
  title: { ...typography.displayLgMobile, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
});
