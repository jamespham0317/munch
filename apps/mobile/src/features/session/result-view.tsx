import { Link } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../theme";
import { useMatch } from "./use-match";

/**
 * Match announcement screen (RN parity with apps/web's ResultView). Both entry paths
 * (the swiper's own submit_swipe response and a co-member's subscribeSession match
 * event) pre-seed the same query cache key before navigating, so the common case
 * renders instantly; a fresh fetch only runs on a direct or refreshed entry. Renders both
 * terminal outcomes the same way — a unanimous match and a host-accepted top pick
 * (resolution `host_accepted_top`) — differing only in the headline copy.
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

  const { match, restaurant } = matchQuery.data;
  const isHostPick = match.resolution === "host_accepted_top";
  const headline = isHostPick ? "🍽️ The host picked" : "🎉 It’s a match!";
  const subcopy = isHostPick
    ? "No unanimous match, so the host chose the closest pick. Enjoy!"
    : "Everyone liked the same spot. Go enjoy it together!";

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>{headline}</Text>
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
      <Text style={styles.muted}>{subcopy}</Text>
      <Link href="/" style={styles.link}>
        Back home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.gutter, alignItems: "flex-start" },
  headline: { color: colors.text, fontSize: 24, fontWeight: "700" },
  photo: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceHighest,
  },
  name: { color: colors.text, fontSize: 20, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 14 },
  muted: { color: colors.textMuted },
  error: { color: colors.error },
  link: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: "600",
    paddingTop: spacing.base,
  },
});
