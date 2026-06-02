import { cuisineLabel, type PriceLevel } from "@munch/core";
import { StyleSheet, Text } from "react-native";

import { colors } from "../theme";

/**
 * Read-only summary of the room's active filters (RN parity with apps/web's FiltersSummary).
 * Shown to non-host members (who can see but not edit the host-controlled filters —
 * CLAUDE.md §2.2) and in the lobby's active-filters line. Presentational only; cuisine ids
 * render via the @munch/core label lookup.
 */
export function FiltersSummary({
  openNow,
  cuisines,
  priceLevels,
}: {
  openNow: boolean;
  cuisines: string[];
  priceLevels: PriceLevel[];
}) {
  const parts: string[] = [];
  if (openNow) parts.push("Open now");
  if (cuisines.length > 0) {
    parts.push(cuisines.map((id) => cuisineLabel(id)).join(", "));
  }
  if (priceLevels.length > 0) {
    parts.push(priceLevels.map((level) => "$".repeat(Number(level))).join(" "));
  }

  return (
    <Text style={styles.summary}>
      Filters: {parts.length > 0 ? parts.join(" · ") : "none (any restaurant)"}
    </Text>
  );
}

const styles = StyleSheet.create({
  summary: { color: colors.textMuted, fontSize: 14 },
});
