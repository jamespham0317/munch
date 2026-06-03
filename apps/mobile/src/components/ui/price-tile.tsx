import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, spacing, typography } from "../../theme";

/**
 * Selectable price / segment tile (design-system.md §7). Presentational only
 * (CLAUDE.md §4): selection is a prop. Selected = amber (`brand`) fill with charcoal
 * text; unselected = sunken tonal fill. Designed to sit `flex: 1` in a row of tiles
 * ($-$$$$). `caption` is the small descriptor under the glyph (e.g. "Cheap").
 */
export function PriceTile({
  label,
  caption,
  selected = false,
  onPress,
  disabled = false,
}: {
  label: string;
  caption?: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={[
        styles.tile,
        selected ? styles.selected : styles.unselected,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, selected && styles.textSelected]}>
        {label}
      </Text>
      {caption ? (
        <Text style={[styles.caption, selected && styles.textSelected]}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Alias matching the design-system "SegmentedTile" name (same component). */
export { PriceTile as SegmentedTile };

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radii.md,
  },
  unselected: { backgroundColor: colors.surfaceSunken },
  selected: { backgroundColor: colors.brand },
  disabled: { opacity: 0.5 },
  label: { ...typography.titleLg, color: colors.text },
  caption: { ...typography.caption, color: colors.textMuted },
  textSelected: { color: colors.onBrand },
});
