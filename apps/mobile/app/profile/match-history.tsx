import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "../../src/components/ui";
import { MatchHistoryView } from "../../src/features/history/match-history-view";
import { colors, spacing, typography } from "../../src/theme";

/**
 * Match-history screen (10-pages.md §3.2) — a forward push from the profile hub's "View Match
 * History" (ProfileView). The top bar mirrors the Stitch "Match History" mockup: a back arrow
 * (pops to the Profile tab — an ordinary forward navigation, not a room-flow screen, so it pops
 * rather than replacing to home — see app/_layout.tsx) beside the Munch brand row. Thin wrapper
 * around the MatchHistoryView feature (CLAUDE.md §4).
 */
export default function MatchHistoryScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to profile"
          hitSlop={spacing.base}
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.brandRow}>
          <MaterialCommunityIcons
            name="silverware-fork-knife"
            size={24}
            color={colors.heat}
          />
          <Text style={styles.brand}>Munch</Text>
        </View>
      </View>
      <MatchHistoryView />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.gutter },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  brand: { ...typography.titleLg, color: colors.text },
});
