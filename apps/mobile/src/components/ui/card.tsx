import type { ReactNode } from "react";
import {
  Image,
  type ImageSourcePropType,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";

import { colors, radii, shadow, spacing } from "../../theme";

/**
 * Surface card primitive (design-system.md §7): radius-xl, soft `shadow-low`, white
 * surface. `padding` exposes the 24px default and the 32px "Decision" card interior
 * (CLAUDE.md §4 — presentational, no data). An optional image header carries a
 * bottom legibility scrim so overlaid white text (e.g. the Match reveal) stays
 * readable; `imageOverlay` content is positioned over it.
 */
export function Card({
  children,
  padding = "md",
  image,
  imageHeight = 200,
  imageOverlay,
  style,
}: {
  children?: ReactNode;
  /** `md` = 24px interior; `decision` = 32px (the swipe card); `none` = no padding. */
  padding?: "md" | "decision" | "none";
  /** A `null`/`undefined` source renders the card without a photo header. */
  image?: ImageSourcePropType | undefined;
  imageHeight?: number;
  imageOverlay?: ReactNode;
  style?: ViewStyle;
}) {
  const pad = padding === "decision" ? 32 : padding === "none" ? 0 : spacing.md;
  return (
    <View style={[styles.card, shadow("shadowLow"), style]}>
      {image ? (
        <View style={[styles.imageWrap, { height: imageHeight }]}>
          <Image
            source={image}
            style={styles.image}
            accessibilityIgnoresInvertColors
          />
          <View style={styles.scrim} pointerEvents="none" />
          {imageOverlay ? (
            <View style={styles.overlay} pointerEvents="box-none">
              {imageOverlay}
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ padding: pad }}>{children}</View>
    </View>
  );
}

/** Charcoal at a given alpha — derived from the `text` token, not a new palette value. */
function charcoalAlpha(alpha: number): string {
  const hex = colors.text.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  imageWrap: { width: "100%", backgroundColor: colors.surfaceHighest },
  image: { width: "100%", height: "100%" },
  // Subtle bottom band approximating the bottom-inner-shadow of design-system.md §4.
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%",
    backgroundColor: charcoalAlpha(0.28),
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.gutter,
  },
});
