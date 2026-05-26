import type { Restaurant } from "@munch/core";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme";

/**
 * Presentational card for the Phase 0 smoke read. No logic — it just displays the
 * seeded restaurant the screen fetched via @munch/api-client (CLAUDE.md §4).
 */
export function SmokeRestaurantCard({
  restaurant,
}: {
  restaurant: Restaurant;
}) {
  const hasCuisines = restaurant.cuisines.length > 0;
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{restaurant.name}</Text>
      <Text style={styles.meta}>
        {restaurant.rating != null ? `★ ${restaurant.rating}` : "No rating"}
        {hasCuisines ? ` · ${restaurant.cuisines.join(", ")}` : ""}
      </Text>
      <Text style={styles.caption}>
        Read under RLS via an anonymous session ✓
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  name: { color: colors.text, fontSize: 22, fontWeight: "600" },
  meta: { color: colors.textMuted },
  caption: { color: colors.accent, fontSize: 12, marginTop: spacing.sm },
});
