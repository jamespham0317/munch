import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme";

/**
 * Labeled field wrapper for the room forms — a label above its control. Presentational
 * only; no logic (CLAUDE.md §4).
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
  field: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: 14 },
});
