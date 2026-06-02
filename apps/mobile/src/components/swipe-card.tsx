import type { DeckRestaurant } from "@munch/core";
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, spacing } from "../theme";

/**
 * Presentational swipe card (RN parity with apps/web's SwipeCard). Takes a
 * DeckRestaurant + two button handlers; holds no business logic and reads no data
 * (CLAUDE.md §4). The matching/shuffle/distance rules all live upstream.
 *
 * A pan/throw gesture is layered on for feel (react-native-gesture-handler + reanimated):
 * dragging the card past a horizontal threshold and releasing throws it off-screen and
 * triggers the same onLike/onPass handlers as the buttons (right = like, left = pass); a
 * short drag springs back. The buttons remain the accessible fallback. The gesture is pure
 * UI — it only calls the existing handlers and NEVER touches the provider (CLAUDE.md §2.1).
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
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 180 }, () => {
          runOnJS(commit)("like");
        });
      } else if (event.translationX <= -SWIPE_THRESHOLD_PX) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 180 }, () => {
          runOnJS(commit)("pass");
        });
      } else {
        translateX.value = withTiming(0, { duration: 150 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${translateX.value / 20}deg` },
    ],
  }));

  return (
    <View style={styles.card} accessibilityLabel={restaurant.name}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.swipeable, animatedStyle]}>
          {restaurant.photo_url ? (
            <Image
              source={{ uri: restaurant.photo_url }}
              style={styles.photo}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[styles.photo, styles.photoFallback]}
              accessible={false}
            >
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
            <Text style={styles.cuisines}>
              {restaurant.cuisines.join(" · ")}
            </Text>
          ) : null}
        </Animated.View>
      </GestureDetector>
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
  swipeable: { gap: spacing.sm },
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
