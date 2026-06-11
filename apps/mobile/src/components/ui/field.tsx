import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "../../theme";

/**
 * Labeled field wrapper — an uppercase eyebrow label above its control
 * (09-design-system.md §5 label-md, §7). Presentational only; no logic (CLAUDE.md §4).
 * Generic by design: it labels text Inputs, chip rows, tiles, or the radius slider.
 * `error`, when set, renders a field-level error message below the control; Field does
 * no validation itself — the form decides when to show it.
 */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
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
  error: { ...typography.bodyMd, color: colors.error },
});
