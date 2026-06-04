import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "../theme";

/**
 * Read-only summary of the room's search anchor (location label + optional radius), RN parity
 * with apps/web's AnchorSummary. Shown in the lobby to every member: the anchor is
 * host-controlled and set on Create Room via the map (CLAUDE.md §2.2) — the lobby gets NO
 * editable map, so this is informational only. Non-hosts also see the radius; the host edits
 * the radius via its own control, so `radiusM` is omitted there to avoid double-showing it.
 * Presentational only.
 *
 * There is no reverse-geocoding (map-pick only), so `anchorLabel` is often blank — a neutral
 * "Pinned location" fallback is shown then.
 */
export function AnchorSummary({
  anchorLabel,
  radiusM,
}: {
  anchorLabel: string | null;
  radiusM?: number;
}) {
  const label = anchorLabel?.trim() ? anchorLabel.trim() : "Pinned location";
  const text =
    radiusM === undefined ? label : `${label} · ${formatKm(radiusM)}`;

  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name="map-marker" size={14} color={colors.heat} />
      <Text style={styles.label}>{text}</Text>
    </View>
  );
}

function formatKm(metres: number): string {
  return `${(metres / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted },
});
