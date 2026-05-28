import { Link } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../theme";
import { useMatch } from "./use-match";

/**
 * Match announcement screen (RN parity with apps/web's ResultView). Both entry paths
 * (the swiper's own submit_swipe response and a co-member's subscribeSession match
 * event) pre-seed the same query cache key before navigating, so the common case
 * renders instantly; a fresh fetch only runs on a direct or refreshed entry.
 */
export function ResultView({ sessionId }: { sessionId: string }) {
  const matchQuery = useMatch(sessionId);

  if (matchQuery.isPending) {
    return <Text style={styles.muted}>Loading match…</Text>;
  }
  if (matchQuery.isError) {
    return (
      <Text style={styles.error} accessibilityRole="alert">
        {matchQuery.error.message}
      </Text>
    );
  }

  const { restaurant } = matchQuery.data;

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>It’s a match!</Text>
      {restaurant.photo_url ? (
        <Image
          source={{ uri: restaurant.photo_url }}
          style={styles.photo}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <Text style={styles.name}>{restaurant.name}</Text>
      {restaurant.rating !== null ? (
        <Text style={styles.meta}>⭐ {restaurant.rating.toFixed(1)}</Text>
      ) : null}
      <Text style={styles.muted}>Session ended.</Text>
      <Link href="/" style={styles.link}>
        Back home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, alignItems: "flex-start" },
  headline: { color: colors.text, fontSize: 24, fontWeight: "700" },
  photo: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 12,
    backgroundColor: "#1f2937",
  },
  name: { color: colors.text, fontSize: 20, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 14 },
  muted: { color: colors.textMuted },
  error: { color: colors.danger },
  link: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600",
    paddingTop: spacing.sm,
  },
});
