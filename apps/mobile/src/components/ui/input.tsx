import { type ReactNode, useState } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";

import { colors, radii, shadow, spacing, typography } from "../../theme";

/**
 * Text input primitive (09-design-system.md §7 Field/Input): a filled, radius-md control
 * that grows a 2px amber border + soft amber glow on focus, with a faint placeholder.
 * Presentational only (CLAUDE.md §4) — it forwards all TextInputProps so callers keep
 * their own value/handlers/validation. The 2px transparent resting border reserves the
 * space the focus border occupies, so focusing never shifts layout.
 *
 * `leadingIcon` insets a glyph at the left of the control (the auth/join screens — person,
 * lock, mail). It overlays the input's left padding so the focus border still wraps the
 * whole pill (RN parity with the web Input's leading-icon slot).
 */
export function Input({
  style,
  onFocus,
  onBlur,
  leadingIcon,
  ...props
}: TextInputProps & { leadingIcon?: ReactNode }) {
  const [focused, setFocused] = useState(false);
  const input = (
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
      style={[
        styles.input,
        leadingIcon ? styles.inputWithIcon : null,
        focused && styles.focused,
        style,
      ]}
    />
  );
  if (!leadingIcon) return input;
  return (
    <View style={styles.iconWrap}>
      <View style={styles.leadingIcon} pointerEvents="none">
        {leadingIcon}
      </View>
      {input}
    </View>
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
  // Reserve room for the overlaid leading glyph (icon sits at spacing.gutter).
  inputWithIcon: { paddingLeft: 48 },
  iconWrap: { position: "relative", justifyContent: "center" },
  // Span the input's full height (top/bottom: 0) and center the glyph, so the icon stays
  // vertically centered regardless of the input's line height (e.g. the taller bold locked
  // field) — the RN parity of the web Input's `top-1/2 -translate-y-1/2`.
  leadingIcon: {
    position: "absolute",
    left: spacing.gutter,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 1,
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
