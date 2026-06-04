import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, typography } from "../../theme";

/**
 * Small caption pill / badge (09-design-system.md §7) — "Waiting…", "1.2 mi", a "4.8 ★"
 * rating, an aggregate "(4/8)" count. Presentational only (CLAUDE.md §4); the rating
 * star (or any glyph) is passed as `leadingIcon` by the caller, in brand amber.
 * `tone="onImage"` adds a surface fill + shadow so the pill reads over a photo header.
 */
export function ProgressPill({
  label,
  leadingIcon,
  tone = "neutral",
}: {
  label: string;
  leadingIcon?: ReactNode;
  tone?: "neutral" | "onImage";
}) {
  return (
    <View style={[styles.pill, tone === "onImage" && shadow("shadowLow")]}>
      {leadingIcon}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** Alias matching the design-system "Badge" name (same component). */
export { ProgressPill as Badge };

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
  label: { ...typography.caption, color: colors.textMuted },
});
