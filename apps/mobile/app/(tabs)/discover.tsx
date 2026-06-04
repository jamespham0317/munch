import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "../../src/theme";

/**
 * Discover tab placeholder (10-pages.md §3.9). A browse/discovery feed is post-v1
 * (docs/07 §8); v1 is room-based, so this ships as a styled "coming soon" state so
 * the tab isn't empty. Presentation only — no data wiring, no hooks (CLAUDE.md §4).
 * Mirrors the "Discover - Under Construction" Stitch mockup: a soft amber/heat glow
 * behind a large neutral circle flanked by a heat and a brand dot.
 */
export default function DiscoverScreen() {
  return (
    <View style={styles.screen}>
      {/* Decorative warm glow behind the circle cluster (09-design-system.md §4). */}
      <View style={[styles.glow, styles.glowHeat]} />
      <View style={[styles.glow, styles.glowBrand]} />

      <View style={styles.cluster}>
        <View style={styles.mainCircle} />
        <View style={[styles.dot, styles.dotHeat]} />
        <View style={[styles.dot, styles.dotBrand]} />
      </View>

      <Text style={styles.title}>Under Construction</Text>
      <Text style={styles.body}>
        We&apos;re cooking up something special. Check back soon for more ways
        to find great food!
      </Text>
    </View>
  );
}

const CIRCLE = 184;
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  glow: {
    position: "absolute",
    borderRadius: radii.full,
    opacity: 0.18,
  },
  glowHeat: {
    width: 320,
    height: 320,
    backgroundColor: colors.heat,
    transform: [{ translateY: -90 }, { translateX: 60 }],
  },
  glowBrand: {
    width: 260,
    height: 260,
    backgroundColor: colors.brand,
    transform: [{ translateY: -40 }, { translateX: -70 }],
  },
  cluster: {
    width: CIRCLE,
    height: CIRCLE,
    marginBottom: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  mainCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceRaised,
  },
  dot: {
    position: "absolute",
    borderRadius: radii.full,
  },
  dotHeat: {
    width: 48,
    height: 48,
    backgroundColor: colors.heat,
    top: 4,
    right: 0,
  },
  dotBrand: {
    width: 40,
    height: 40,
    backgroundColor: colors.brand,
    bottom: 8,
    left: 8,
  },
  title: {
    ...typography.headlineMd,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
  },
});
