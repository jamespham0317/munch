import {
  colors as munchColors,
  pressTranslateY as munchPressTranslateY,
  radii as munchRadii,
  shadows as munchShadows,
  type ShadowToken,
  spacing as munchSpacing,
  typography as munchTypography,
  type TypographyStyle,
} from "@munch/ui";
import type { TextStyle, ViewStyle } from "react-native";

/**
 * Mobile theme adapter (docs/09-design-system.md §3): React Native re-exports the
 * platform-agnostic `@munch/ui` tokens and ADAPTS them for RN — it never
 * re-defines a value (CLAUDE.md §4). Colors/spacing/radii pass straight through;
 * typography gains a Quicksand `fontFamily` and px-resolved line-height/tracking;
 * shadows become RN `shadow*` props + Android `elevation`.
 */

/** Semantic color roles — the single source is `@munch/ui` (09-design-system.md §4). */
export const colors = munchColors;

/** Spacing scale (09-design-system.md §6), straight from `@munch/ui`. */
export const spacing = munchSpacing;

/** Corner radii (09-design-system.md §6), straight from `@munch/ui`. */
export const radii = munchRadii;

/** 2px downward press translate to simulate a physical click (09-design-system.md §6). */
export const pressTranslateY = munchPressTranslateY;

/**
 * Map a token weight ("500"/"600"/"700") to its loaded Quicksand family. The
 * families are loaded in `app/_layout.tsx`; RN needs the concrete face name (it
 * does not synthesise weights from a single family like the web does).
 */
const fontFamilyForWeight: Record<string, string> = {
  "500": "Quicksand_500Medium",
  "600": "Quicksand_600SemiBold",
  "700": "Quicksand_700Bold",
};

/**
 * The 8 type styles (09-design-system.md §5) as RN text styles. `@munch/ui` stores
 * line-height as a unitless multiplier and tracking in em; RN wants both in px,
 * so we resolve them against `fontSize` here. Each style also carries the right
 * Quicksand face for its weight.
 */
export const typography = Object.fromEntries(
  (
    Object.entries(munchTypography) as [
      TypographyStyle,
      (typeof munchTypography)[TypographyStyle],
    ][]
  ).map(([name, style]) => {
    const resolved: TextStyle = {
      fontFamily: fontFamilyForWeight[style.fontWeight],
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight * style.fontSize,
    };
    if ("letterSpacing" in style && style.letterSpacing !== undefined) {
      resolved.letterSpacing = style.letterSpacing * style.fontSize;
    }
    return [name, resolved];
  }),
) as Record<TypographyStyle, TextStyle>;

/**
 * Map a `@munch/ui` ambient shadow (09-design-system.md §6) to RN's shadow props
 * plus a matching Android `elevation` (Android ignores `shadow*`). The blur
 * approximates elevation; offset y drives the drop. Derived entirely from the
 * token — no new values invented.
 */
export function shadow(level: ShadowToken): ViewStyle {
  const { yOffset, blur, color, opacity } = munchShadows[level];
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: blur,
    shadowOffset: { width: 0, height: yOffset },
    elevation: yOffset,
  };
}
