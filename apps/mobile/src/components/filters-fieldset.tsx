import {
  type CuisineId,
  CUISINES,
  PRICE_LEVELS,
  type PriceLevel,
} from "@munch/core";
import { StyleSheet, View } from "react-native";

import { spacing } from "../theme";
import { FoodChip, PriceTile, Toggle } from "./ui";
import { Field } from "./ui/field";

/**
 * Shared host-filter controls (open-now + the closed cuisine taxonomy + price levels),
 * RN parity with apps/web's FiltersFieldset — reused by the create-room form and the lobby
 * filter-edit panel so the two stay in sync (restyling here updates both, 09-design-system.md §8).
 * Presentational only; it owns no data access and holds the selections as controlled props
 * (CLAUDE.md §4). Cuisines + price levels come from the @munch/core CUISINES / PRICE_LEVELS
 * constants (no free text); the picker only ever emits taxonomy ids. Filters are host-only and
 * whole-room (CLAUDE.md §2.2); there is no per-member narrowing here.
 */

export function FiltersFieldset({
  openNow,
  onOpenNowChange,
  cuisines,
  onCuisinesChange,
  priceLevels,
  onPriceLevelsChange,
  disabled = false,
}: {
  openNow: boolean;
  onOpenNowChange: (value: boolean) => void;
  cuisines: CuisineId[];
  onCuisinesChange: (value: CuisineId[]) => void;
  priceLevels: PriceLevel[];
  onPriceLevelsChange: (value: PriceLevel[]) => void;
  disabled?: boolean;
}) {
  function toggleCuisine(id: CuisineId) {
    onCuisinesChange(
      cuisines.includes(id)
        ? cuisines.filter((value) => value !== id)
        : [...cuisines, id],
    );
  }

  function togglePriceLevel(level: PriceLevel) {
    onPriceLevelsChange(
      priceLevels.includes(level)
        ? priceLevels.filter((value) => value !== level)
        : [...priceLevels, level],
    );
  }

  return (
    <View style={styles.group}>
      <Toggle
        value={openNow}
        onValueChange={onOpenNowChange}
        label="Open now"
        disabled={disabled}
      />
      <Field label="What's the craving?">
        <View style={styles.chipWrap}>
          {CUISINES.map(({ id, label }) => (
            <FoodChip
              key={id}
              label={label}
              selected={cuisines.includes(id)}
              onPress={() => toggleCuisine(id)}
              disabled={disabled}
            />
          ))}
        </View>
      </Field>
      <Field label="Price range">
        <View style={styles.tileRow}>
          {PRICE_LEVELS.map(({ level, caption }) => (
            <PriceTile
              key={level}
              label={"$".repeat(Number(level))}
              caption={caption}
              selected={priceLevels.includes(level)}
              onPress={() => togglePriceLevel(level)}
              disabled={disabled}
            />
          ))}
        </View>
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.base },
  tileRow: { flexDirection: "row", gap: spacing.base },
});
