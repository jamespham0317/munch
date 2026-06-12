import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors, radii, shadow, spacing } from "../../theme";

/**
 * Icon badge primitive (09-design-system.md §7) — a rounded container holding a single
 * glyph, the decorative anchor atop the auth/join cards (RN parity with the web IconBadge).
 * Presentational only (CLAUDE.md §4). Two variants from the Stitch mockups:
 *  - `solid` — amber `brand` fill, charcoal glyph, soft `shadowLow`, a static 3° tilt for a
 *    playful "squishy" feel (the Join "restaurant" badge). No motion (§10).
 *  - `tonalCircle` — a circular faint-amber (`brand` @ 20%) tonal surface with deep-amber
 *    `brandDeep` ink (the Forgot "info"/"lock"/"check" badge).
 */
export function IconBadge({
  icon,
  variant = "solid",
}: {
  icon: ReactNode;
  variant?: "solid" | "tonalCircle";
}) {
  return (
    <View
      style={[
        styles.base,
        variant === "tonalCircle" ? styles.tonalCircle : styles.solid,
        variant === "solid" ? shadow("shadowLow") : null,
      ]}
    >
      {icon}
    </View>
  );
}

/** `brand` (#ffbf00) at the given alpha — derived from the token, not a new palette value. */
function brandAlpha(alpha: number): string {
  const hex = colors.brand.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  solid: {
    backgroundColor: colors.brand,
    borderRadius: radii.lg,
    padding: spacing.gutter,
    transform: [{ rotate: "3deg" }],
  },
  tonalCircle: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    backgroundColor: brandAlpha(0.2),
  },
});
