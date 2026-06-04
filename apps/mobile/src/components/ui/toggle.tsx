import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "../../theme";

/**
 * Selection toggle with the playful "bite-out-of-a-circle" mark (09-design-system.md §7,
 * §2). Presentational only (CLAUDE.md §4): value is controlled by the caller. When on,
 * a brand-filled circle has a surface-colored "bite" notched out of its top-right.
 */
export function Toggle({
  value,
  onValueChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      hitSlop={spacing.base}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View style={[styles.mark, value ? styles.markOn : styles.markOff]}>
        {value ? <View style={styles.bite} /> : null}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const MARK_SIZE = 24;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  disabled: { opacity: 0.5 },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  markOff: { borderWidth: 2, borderColor: colors.border },
  markOn: { backgroundColor: colors.brand },
  // The "bite": a surface-colored circle notched out of the filled mark's corner.
  bite: {
    position: "absolute",
    top: -MARK_SIZE * 0.3,
    right: -MARK_SIZE * 0.3,
    width: MARK_SIZE * 0.7,
    height: MARK_SIZE * 0.7,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
  },
  label: { ...typography.bodyMd, color: colors.text },
});
