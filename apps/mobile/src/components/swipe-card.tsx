import { Feather } from "@expo/vector-icons";
import { cuisineLabel, type DeckRestaurant } from "@munch/core";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, radii, shadow, spacing, typography } from "../theme";
import { Card } from "./ui/card";
import { FoodChip } from "./ui/chip";
import { ProgressPill } from "./ui/progress-pill";

/**
 * The Decision Card (09-design-system.md §8): the swipe card. A photo header with a distance
 * pill overlay, the restaurant name + rating chip, a `price • cuisine` line, and decorative
 * cuisine chips, composed from the @munch/ui primitives. Takes a DeckRestaurant + two button
 * handlers; holds no business logic and reads no data (CLAUDE.md §4). The matching/shuffle/
 * distance rules all live upstream.
 *
 * A pan/throw gesture is layered on for feel (react-native-gesture-handler + reanimated):
 * dragging the card past a horizontal threshold and releasing throws it off-screen and
 * triggers the same onLike/onPass handlers as the buttons (right = like, left = pass); a
 * short drag springs back. The pass/like buttons remain the accessible fallback (§10). The
 * gesture is pure UI — it only calls the existing handlers and NEVER touches the provider
 * (CLAUDE.md §2.1). The throw animation is skipped under reduce-motion (§10).
 *
 * The middle "save/super-like" bookmark of the mockup is intentionally NOT built — v1 is
 * like/pass only (09-design-system.md §8, 11-ui-roadmap.md §7).
 *
 * `distance_m` is the server-computed value from the haversine helper in 0009; we
 * format it but never recompute it.
 */

/** Horizontal drag distance (px) past which a release commits the swipe. */
const SWIPE_THRESHOLD_PX = 120;
const SCREEN_WIDTH = Dimensions.get("window").width;

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
  const translateX = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  // Runs on the JS thread (via runOnJS). Reset the card to centre before advancing so the
  // next card renders in place, then fire the existing handler — never a provider call.
  function commit(direction: "like" | "pass") {
    translateX.value = 0;
    if (direction === "like") {
      onLike();
    } else {
      onPass();
    }
  }

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX >= SWIPE_THRESHOLD_PX) {
        if (reduceMotion) {
          translateX.value = 0;
          runOnJS(commit)("like");
        } else {
          translateX.value = withTiming(SCREEN_WIDTH, { duration: 180 }, () => {
            runOnJS(commit)("like");
          });
        }
      } else if (event.translationX <= -SWIPE_THRESHOLD_PX) {
        if (reduceMotion) {
          translateX.value = 0;
          runOnJS(commit)("pass");
        } else {
          translateX.value = withTiming(
            -SCREEN_WIDTH,
            { duration: 180 },
            () => {
              runOnJS(commit)("pass");
            },
          );
        }
      } else {
        translateX.value = reduceMotion ? 0 : withTiming(0, { duration: 150 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${translateX.value / 20}deg` },
    ],
  }));

  const priceCuisine = formatPriceCuisine(restaurant);

  return (
    <View accessibilityLabel={restaurant.name}>
      <GestureDetector gesture={pan}>
        <Animated.View style={animatedStyle}>
          <Card
            padding="decision"
            image={
              restaurant.photo_url ? { uri: restaurant.photo_url } : undefined
            }
            imageHeight={260}
            imageOverlay={
              <ProgressPill
                tone="onImage"
                label={formatDistance(restaurant.distance_m)}
                leadingIcon={
                  <Feather name="map-pin" size={12} color={colors.heat} />
                }
              />
            }
          >
            <View style={styles.titleRow}>
              <Text style={styles.name} numberOfLines={1}>
                {restaurant.name}
              </Text>
              {restaurant.rating !== null ? (
                <ProgressPill
                  label={restaurant.rating.toFixed(1)}
                  leadingIcon={
                    <Feather name="star" size={12} color={colors.brand} />
                  }
                />
              ) : null}
            </View>
            {priceCuisine ? (
              <Text style={styles.meta}>
                {priceCuisine}
                {restaurant.is_open_now === false ? " · closed" : ""}
              </Text>
            ) : null}
            {restaurant.cuisines.length > 0 ? (
              <View style={styles.chips}>
                {restaurant.cuisines.map((id) => (
                  <FoodChip key={id} label={cuisineLabel(id)} />
                ))}
              </View>
            ) : null}
          </Card>
        </Animated.View>
      </GestureDetector>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.circle,
            styles.pass,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}
          onPress={onPass}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Pass"
        >
          <Feather name="x" size={28} color={colors.text} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.circle,
            styles.like,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}
          onPress={onLike}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Like"
        >
          <Feather name="heart" size={28} color={colors.onBrand} />
        </Pressable>
      </View>
    </View>
  );
}

/** `$$ • Japanese, Seafood` — the price/cuisine summary line; either part may be absent. */
function formatPriceCuisine(restaurant: DeckRestaurant): string {
  const price = restaurant.price_level
    ? "$".repeat(Number(restaurant.price_level))
    : "";
  const cuisines = restaurant.cuisines.map(cuisineLabel).join(", ");
  return [price, cuisines].filter(Boolean).join(" • ");
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

const CIRCLE = 64;

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  name: { ...typography.titleLg, color: colors.text, flexShrink: 1 },
  meta: {
    ...typography.bodyMd,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.base,
    marginTop: spacing.gutter,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    ...shadow("shadowLow"),
  },
  pass: { backgroundColor: colors.surfaceHighest },
  like: { backgroundColor: colors.brand },
  pressed: { transform: [{ translateY: 2 }] },
  disabled: { opacity: 0.5 },
});
