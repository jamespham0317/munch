import { useState } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { colors, radii, shadow, spacing, typography } from "../../theme";

/**
 * Text input primitive (09-design-system.md §7 Field/Input): a filled, radius-md control
 * that grows a 2px amber border + soft amber glow on focus, with a faint placeholder.
 * Presentational only (CLAUDE.md §4) — it forwards all TextInputProps so callers keep
 * their own value/handlers/validation. The 2px transparent resting border reserves the
 * space the focus border occupies, so focusing never shifts layout.
 */
export function Input({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      placeholderTextColor={props.placeholderTextColor ?? colors.textFaint}
      style={[styles.input, focused && styles.focused, style]}
    />
  );
}

// Amber focus glow: the shadow-active blur/opacity from the token, recolored to the
// brand role and centered (no offset) — no new token value is invented (§3).
const activeShadow = shadow("shadowActive");

const styles = StyleSheet.create({
  input: {
    ...typography.bodyMd,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  focused: {
    borderColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: activeShadow.shadowOpacity,
    shadowRadius: activeShadow.shadowRadius,
    shadowOffset: { width: 0, height: 0 },
    elevation: activeShadow.elevation,
  },
});
