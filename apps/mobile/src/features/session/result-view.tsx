import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { cuisineLabel, type DeckRestaurant } from "@munch/core";
import { useRouter } from "expo-router";
import {
  Dimensions,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { useReducedMotion } from "react-native-reanimated";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { FoodChip } from "../../components/ui/chip";
import { ProgressPill } from "../../components/ui/progress-pill";
import { colors, spacing, typography } from "../../theme";
import { useMatch } from "./use-match";

/**
 * Match announcement screen (RN parity with apps/web's ResultView; 10-pages.md §3.7,
 * "It's a Match!"). Both entry paths (the swiper's own submit_swipe response and a co-member's
 * subscribeSession match event) pre-seed the same query cache key before navigating, so the
 * common case renders instantly; a fresh fetch only runs on a direct or refreshed entry.
 * Renders both terminal outcomes the same way — a unanimous match and a host-accepted top pick
 * (resolution `host_accepted_top`) — differing only in the headline copy.
 *
 * "Get Directions" and "Share Match" use only the match payload we already hold — they open an
 * external maps app / the OS share sheet and NEVER call the provider (CLAUDE.md §2.1,
 * 09-design-system.md §8). The confetti is suppressed under reduce-motion (§10).
 */
const SCREEN_WIDTH = Dimensions.get("window").width;

export function ResultView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const matchQuery = useMatch(sessionId);
  const reduceMotion = useReducedMotion();

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
  const headline = isHostPick ? "The host picked!" : "Everyone agreed!";
  const subcopy = isHostPick
    ? "No unanimous match, so the host chose the closest pick. Time to eat."
    : "Looks like you're all craving the same thing. Time to eat.";

  async function handleShare() {
    try {
      await Share.share({ message: shareMessage(restaurant) });
    } catch {
      // Sharing is best-effort; a dismissed or failed share is not surfaced.
    }
  }

  function handleDirections() {
    void Linking.openURL(directionsUrl(restaurant));
  }

  return (
    <View style={styles.container}>
      {reduceMotion ? null : (
        <ConfettiCannon
          count={140}
          origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
          autoStart
          fadeOut
          colors={[
            colors.brand,
            colors.heat,
            colors.brandPressed,
            colors.online,
          ]}
        />
      )}

      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.replace("/")}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={spacing.base}
        >
          <Feather name="x" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <ProgressPill
          label="It's a Match!"
          tone="match"
          style={styles.matchBadge}
          leadingIcon={
            <MaterialCommunityIcons
              name="party-popper"
              size={14}
              color={colors.brandDeep}
            />
          }
        />
        <Text style={styles.headline} accessibilityRole="header">
          {headline}
        </Text>
        <Text style={styles.subcopy}>{subcopy}</Text>
      </View>

      <Card
        padding="md"
        image={restaurant.photo_url ? { uri: restaurant.photo_url } : undefined}
        imageHeight={220}
        imageOverlay={
          restaurant.cuisines.length > 0 ? (
            <View style={styles.tagOverlay}>
              <View style={styles.tagRow}>
                {restaurant.cuisines.slice(0, 2).map((id) => (
                  <FoodChip key={id} label={cuisineLabel(id)} selected />
                ))}
              </View>
            </View>
          ) : undefined
        }
      >
        <Text style={styles.name}>{restaurant.name}</Text>
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={14} color={colors.textMuted} />
          <Text style={styles.meta}>{formatPriceCuisine(restaurant)}</Text>
          {restaurant.rating !== null ? (
            <ProgressPill
              label={restaurant.rating.toFixed(1)}
              leadingIcon={
                <Feather name="star" size={12} color={colors.brand} />
              }
            />
          ) : null}
        </View>
        {/* Primary action lives inside the Decision card, under the meta row
            (10-pages.md §3.7). The Button stretches to the card's interior width. */}
        <View style={styles.cardAction}>
          <Button
            label="Get Directions"
            onPress={handleDirections}
            leadingIcon={
              <Feather name="navigation" size={18} color={colors.onBrand} />
            }
          />
        </View>
      </Card>

      <Button
        label="Share Match"
        variant="ghost"
        onPress={() => void handleShare()}
        leadingIcon={<Feather name="share-2" size={18} color={colors.text} />}
      />
    </View>
  );
}

/** `distance • $$` for the match meta row; the pin icon is rendered separately. */
function formatPriceCuisine(restaurant: DeckRestaurant): string {
  const distance = formatDistance(restaurant.distance_m);
  const price = restaurant.price_level
    ? "$".repeat(Number(restaurant.price_level))
    : "";
  return [`${distance} away`, price].filter(Boolean).join(" • ");
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** A universal maps deep link from the matched restaurant's coordinates (no provider call). */
function directionsUrl(restaurant: DeckRestaurant): string {
  const query = encodeURIComponent(`${restaurant.lat},${restaurant.lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function shareMessage(restaurant: DeckRestaurant): string {
  return `It's a match — we're eating at ${restaurant.name}! ${directionsUrl(restaurant)}`;
}

const styles = StyleSheet.create({
  container: { gap: spacing.gutter, alignItems: "stretch" },
  topBar: { flexDirection: "row", justifyContent: "flex-end" },
  header: { alignItems: "center", gap: spacing.base },
  matchBadge: { alignSelf: "center" },
  headline: {
    ...typography.displayLgMobile,
    color: colors.text,
    textAlign: "center",
  },
  subcopy: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
  },
  cardAction: { marginTop: spacing.md },
  tagOverlay: { flex: 1, justifyContent: "flex-end" },
  tagRow: { flexDirection: "row", gap: spacing.base },
  name: { ...typography.headlineMd, color: colors.text },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
    marginTop: spacing.xs,
  },
  meta: { ...typography.bodyMd, color: colors.textMuted },
  muted: { ...typography.bodyMd, color: colors.textMuted },
  error: { ...typography.bodyMd, color: colors.error },
});
