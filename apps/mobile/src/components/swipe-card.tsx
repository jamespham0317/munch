import type { DeckRestaurant } from "@munch/core";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme";

/**
 * Presentational swipe card (RN parity with apps/web's SwipeCard). Takes a
 * DeckRestaurant + two button handlers; holds no business logic and reads no data
 * (CLAUDE.md §4). The matching/shuffle/distance rules all live upstream.
 *
 * `distance_m` is the server-computed value from the haversine helper in 0009; we
 * format it but never recompute it.
 */
export function SwipeCard({
  restaurant,
  onLike,
  onPass,
  disabled,
}: {
  restaurant: DeckRestaurant;
  onLike: () => void;
  onPass: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.card} accessibilityLabel={restaurant.name}>
      {restaurant.photo_url ? (
        <Image
          source={{ uri: restaurant.photo_url }}
          style={styles.photo}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.photo, styles.photoFallback]} accessible={false}>
          <Text style={styles.photoFallbackText}>No photo</Text>
        </View>
      )}
      <Text style={styles.name}>{restaurant.name}</Text>
      <Text style={styles.meta}>
        {restaurant.rating !== null
          ? `⭐ ${restaurant.rating.toFixed(1)} `
          : ""}
        {restaurant.price_level
          ? `${"$".repeat(Number(restaurant.price_level))} · `
          : ""}
        {formatDistance(restaurant.distance_m)}
        {restaurant.is_open_now === false ? " · closed" : ""}
      </Text>
      {restaurant.cuisines.length > 0 ? (
        <Text style={styles.cuisines}>{restaurant.cuisines.join(" · ")}</Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          style={[
            styles.button,
            styles.pass,
            disabled && styles.buttonDisabled,
          ]}
          onPress={onPass}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>Pass</Text>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            styles.like,
            disabled && styles.buttonDisabled,
          ]}
          onPress={onLike}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>Like</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  photo: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 12,
    backgroundColor: "#1f2937",
  },
  photoFallback: { alignItems: "center", justifyContent: "center" },
  photoFallbackText: { color: colors.textMuted },
  name: { color: colors.text, fontSize: 22, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 14 },
  cuisines: { color: colors.textMuted, fontSize: 14 },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  pass: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  like: { backgroundColor: colors.accent },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "600" },
});
