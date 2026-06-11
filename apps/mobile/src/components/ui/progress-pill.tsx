import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { colors, radii, shadow, spacing, typography } from "../../theme";

/**
 * Small caption pill / badge (09-design-system.md §7) — "Waiting…", "1.2 mi", a "4.8 ★"
 * rating, an aggregate "(4/8)" count. Presentational only (CLAUDE.md §4); the rating
 * star (or any glyph) is passed as `leadingIcon` by the caller, in brand amber.
 * `tone="onImage"` adds a surface fill + shadow so the pill reads over a photo header;
 * `tone="match"` is the celebratory amber-tint badge (faint brand fill + deep-amber ink)
 * used as the "It's a Match!" eyebrow (09-design-system.md §7). `style` lets a caller
 * override layout — e.g. swap the default `flex-start` for a centered `alignSelf` in a
 * centered header.
 */
export function ProgressPill({
  label,
  leadingIcon,
  tone = "neutral",
  style,
}: {
  label: string;
  leadingIcon?: ReactNode;
  tone?: "neutral" | "onImage" | "match";
  style?: ViewStyle;
}) {
  const isMatch = tone === "match";
  return (
    <View
      style={[
        styles.pill,
        isMatch && styles.pillMatch,
        tone === "onImage" && shadow("shadowLow"),
        style,
      ]}
    >
      {leadingIcon}
      <Text style={[styles.label, isMatch && styles.labelMatch]}>{label}</Text>
    </View>
  );
}

/** Alias matching the design-system "Badge" name (same component). */
export { ProgressPill as Badge };

/** Faint brand-amber fill for the match badge — `brand` (#ffbf00) at 20% (09 §7). */
const MATCH_FILL = "rgba(255, 191, 0, 0.2)";

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceRaised,
  },
  pillMatch: { backgroundColor: MATCH_FILL },
  label: { ...typography.caption, color: colors.textMuted },
  labelMatch: { color: colors.brandDeep },
});
