import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  colors,
  pressTranslateY,
  radii,
  shadow,
  spacing,
  typography,
} from "../../theme";

/**
 * Pill button primitive (09-design-system.md §7). Presentational only — no data, no
 * hooks (CLAUDE.md §4). Variants map to the semantic roles: `primary` (amber fill,
 * charcoal text), `secondary` (burnt-orange fill, white text), `ghost` (2px outline,
 * transparent), `social` (white with a logo slot for provider sign-in), `text`
 * (borderless amber label on a transparent fill — the low-emphasis secondary action,
 * e.g. Cancel). Pressed applies the 2px press translate (+ brand-pressed on the primary
 * fill); the throw is an instant transform, so there is no time-based motion to reduce (§10).
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "social" | "text";

const VARIANT_BG: Record<ButtonVariant, string> = {
  primary: colors.brand,
  secondary: colors.heat,
  ghost: "transparent",
  social: colors.surface,
  text: "transparent",
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: colors.onBrand,
  secondary: colors.onHeat,
  ghost: colors.text,
  social: colors.text,
  text: colors.brand,
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  leadingIcon,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading glyph — the `social` variant's provider-logo slot. */
  leadingIcon?: ReactNode;
  accessibilityLabel?: string;
}) {
  const isDisabled = disabled || loading;
  const textColor = VARIANT_TEXT[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: VARIANT_BG[variant] },
        variant === "ghost" && styles.ghost,
        variant === "social" && shadow("shadowLow"),
        pressed && !isDisabled && styles.pressed,
        pressed &&
          !isDisabled &&
          variant === "primary" &&
          styles.pressedPrimary,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {leadingIcon ? <View>{leadingIcon}</View> : null}
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  ghost: { borderWidth: 2, borderColor: colors.border },
  pressed: { transform: [{ translateY: pressTranslateY }] },
  pressedPrimary: { backgroundColor: colors.brandPressed },
  disabled: { opacity: 0.5 },
  label: { ...typography.titleLg },
});
