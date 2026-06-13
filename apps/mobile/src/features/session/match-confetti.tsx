import { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { colors } from "../../theme";

/**
 * One-shot match celebration (09-design-system.md §8, 10-pages.md §3.7). A full-bleed overlay
 * of confetti that spawns across the top edge and **falls straight down** over the result card
 * — no upward launch (RN parity with the web MatchConfetti's downward canvas-confetti). Built on
 * the existing react-native-reanimated (no new dependency — CLAUDE.md §8), replacing the old
 * react-native-confetti-cannon whose upward arc was baked in and not configurable.
 *
 * Rendered as the LAST child of ResultView so it paints ABOVE the card; the overlay is
 * `pointerEvents="none"` so the card's actions (Get Directions / Share / Close) stay tappable.
 * Colours come from the @munch/ui tokens (never hardcoded hex — §3). Suppressed entirely under
 * reduce-motion (§10): the component self-gates and renders nothing. Pure presentation — no
 * data, no provider call (CLAUDE.md §4).
 */
const CONFETTI_COLORS = [
  colors.brand,
  colors.heat,
  colors.brandPressed,
  colors.online,
];
const PARTICLE_COUNT = 140;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Particle = {
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotate: number;
  swayAmp: number;
  rounded: boolean;
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function MatchConfetti() {
  const reduceMotion = useReducedMotion();

  // Particle descriptors are randomised once per mount (the result screen is one-shot), so the
  // fall is stable across re-renders. Each piece gets its own start X, fall speed, stagger,
  // spin, and horizontal sway for a natural downpour.
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * SCREEN_WIDTH,
        size: randomBetween(7, 14),
        color:
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ??
          colors.brand,
        delay: randomBetween(0, 600),
        duration: randomBetween(2400, 4200),
        rotate: randomBetween(360, 1080) * (Math.random() < 0.5 ? -1 : 1),
        swayAmp: randomBetween(12, 40),
        rounded: Math.random() < 0.5,
      })),
    [],
  );

  if (reduceMotion) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {particles.map((particle, index) => (
        <ConfettiPiece key={index} particle={particle} />
      ))}
    </View>
  );
}

/** A single confetti piece: falls top→bottom once on mount, spinning and swaying, then fades. */
function ConfettiPiece({ particle }: { particle: Particle }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      particle.delay,
      withTiming(1, { duration: particle.duration, easing: Easing.linear }),
    );
  }, [particle.delay, particle.duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.85, 1], [1, 1, 0]),
    transform: [
      // Falls from just above the top edge to just past the bottom — only ever downward.
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [-20, SCREEN_HEIGHT + 40],
        ),
      },
      {
        translateX: interpolate(
          progress.value,
          [0, 0.5, 1],
          [0, particle.swayAmp, 0],
        ),
      },
      { rotateZ: `${progress.value * particle.rotate}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: particle.x,
          width: particle.size,
          height: particle.size * 0.6,
          backgroundColor: particle.color,
          borderRadius: particle.rounded ? particle.size : 1,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  // Full-bleed, non-interactive layer sized to the viewport so confetti falls the whole screen.
  // zIndex/elevation keep it above the card on both platforms (it is also rendered last).
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    zIndex: 10,
    elevation: 10,
  },
  piece: { position: "absolute", top: 0 },
});
