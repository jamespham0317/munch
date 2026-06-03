import { RADIUS_MIN_M } from "@munch/core";
import Slider from "@react-native-community/slider";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "../../theme";

/**
 * Local-only radius slider (design-system.md §7: amber thumb + amber value pill). Bound
 * to UI state and the deck's local distance filter — adjusting it NEVER refetches the
 * provider (CLAUDE.md §2.1). The upper bound is the session's snapshotted radius; the
 * lower bound is the shared RADIUS_MIN_M constant. Presentational only (CLAUDE.md §4).
 */
export function RadiusSlider({
  valueM,
  maxM,
  onChange,
}: {
  valueM: number;
  maxM: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Distance</Text>
        <View style={styles.valuePill}>
          <Text style={styles.valueText}>{formatKm(valueM)}</Text>
        </View>
      </View>
      <Slider
        minimumValue={RADIUS_MIN_M}
        maximumValue={maxM}
        step={100}
        value={valueM}
        onValueChange={onChange}
        minimumTrackTintColor={colors.brand}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.brand}
      />
    </View>
  );
}

function formatKm(metres: number): string {
  return `${(metres / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: { ...typography.bodyMd, color: colors.textMuted },
  valuePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.brand,
  },
  valueText: { ...typography.caption, color: colors.onBrand },
});
