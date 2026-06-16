import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { Screen } from "../../src/components/ui";
import { MatchHistoryView } from "../../src/features/history/match-history-view";
import { colors, spacing, typography } from "../../src/theme";

/**
 * Match-history screen (10-pages.md §3.2) — a forward push from the profile hub's "View Match
 * History" (ProfileView). A plain back control pops to the Profile tab (this is an ordinary
 * forward navigation, not a room-flow screen, so it pops rather than replacing to home — see
 * app/_layout.tsx). Thin wrapper around the MatchHistoryView feature (CLAUDE.md §4).
 */
export default function MatchHistoryScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back to profile"
        style={styles.back}
        hitSlop={8}
      >
        <Feather name="chevron-left" size={24} color={colors.text} />
        <Text style={styles.backLabel}>Profile</Text>
      </Pressable>
      <MatchHistoryView />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  backLabel: { ...typography.titleLg, color: colors.text },
});
