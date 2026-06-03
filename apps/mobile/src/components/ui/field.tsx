import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "../../theme";

/**
 * Labeled field wrapper — an uppercase eyebrow label above its control
 * (design-system.md §5 label-md, §7). Presentational only; no logic (CLAUDE.md §4).
 * Generic by design: it labels text Inputs, chip rows, tiles, or the radius slider.
 */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.base },
  label: {
    ...typography.labelMd,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
});
