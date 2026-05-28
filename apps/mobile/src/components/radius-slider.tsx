import { RADIUS_MIN_M } from "@munch/core";
import Slider from "@react-native-community/slider";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme";

/**
 * Local-only radius slider (RN parity with apps/web's RadiusSlider). Bound to UI
 * state and the deck's local distance filter — adjusting it NEVER refetches the
 * provider (CLAUDE.md §2.1; widen is Phase 3). The upper bound is the session's
 * snapshotted radius (the radius the deck was fetched at); the lower bound is the
 * shared RADIUS_MIN_M constant.
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
      <Text style={styles.label}>Show within {formatKm(valueM)}</Text>
      <Slider
        minimumValue={RADIUS_MIN_M}
        maximumValue={maxM}
        step={100}
        value={valueM}
        onValueChange={onChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.textMuted}
        thumbTintColor={colors.accent}
      />
    </View>
  );
}

function formatKm(metres: number): string {
  return `${(metres / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm / 2 },
  label: { color: colors.textMuted, fontSize: 14 },
});
