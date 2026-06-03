import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "../../theme";

/**
 * Cuisine / tag chip primitive (design-system.md §7). Presentational only
 * (CLAUDE.md §4): selection is a prop and the label is supplied by the caller —
 * the closed CUISINES taxonomy lives in @munch/core and is never hardcoded here.
 * Unselected: cream fill, hairline border, muted text. Selected: solid burnt-orange
 * (`heat`) fill with on-heat text. Omitting `onPress` renders a decorative (card
 * tag) chip with no button role.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
  leadingIcon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  leadingIcon?: ReactNode;
}) {
  const containerStyle = [
    styles.chip,
    selected ? styles.selected : styles.unselected,
    disabled && styles.disabled,
  ];
  const content = (
    <>
      {leadingIcon}
      <Text
        style={[
          styles.label,
          selected ? styles.labelSelected : styles.labelUnselected,
        ]}
      >
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={containerStyle}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      hitSlop={spacing.base}
      style={containerStyle}
    >
      {content}
    </Pressable>
  );
}

/** Alias matching the design-system "FoodChip" name (same component). */
export { Chip as FoodChip };

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.base,
    borderRadius: radii.full,
  },
  unselected: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.heat },
  disabled: { opacity: 0.5 },
  label: { ...typography.bodyMd },
  labelUnselected: { color: colors.textMuted },
  labelSelected: { color: colors.onHeat },
});
