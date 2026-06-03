import { type CuisineId, CUISINES, type PriceLevel } from "@munch/core";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { colors, spacing } from "../theme";
import { Field } from "./ui/field";

/**
 * Shared host-filter controls (open-now + the closed cuisine taxonomy + price levels),
 * RN parity with apps/web's FiltersFieldset — reused by the create-room form and the lobby
 * filter-edit panel so the two stay in sync. Presentational only; it owns no data access and
 * holds the selections as controlled props (CLAUDE.md §4). Cuisines come from the @munch/core
 * CUISINES constant (no free text); the picker only ever emits taxonomy ids. Filters are
 * host-only and whole-room (CLAUDE.md §2.2); there is no per-member narrowing here.
 */

const PRICE_LEVELS: readonly PriceLevel[] = ["1", "2", "3", "4"];

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
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Open now</Text>
        <Switch
          value={openNow}
          onValueChange={onOpenNowChange}
          disabled={disabled}
        />
      </View>
      <Field label="Cuisines">
        <View style={styles.chipWrap}>
          {CUISINES.map(({ id, label }) => {
            const selected = cuisines.includes(id);
            return (
              <Pressable
                key={id}
                onPress={() => toggleCuisine(id)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                style={[
                  styles.chip,
                  selected && styles.chipSelected,
                  disabled && styles.chipDisabled,
                ]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>
      <Field label="Price range">
        <View style={styles.chipWrap}>
          {PRICE_LEVELS.map((level) => {
            const selected = priceLevels.includes(level);
            return (
              <Pressable
                key={level}
                onPress={() => togglePriceLevel(level)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                style={[
                  styles.chip,
                  selected && styles.chipSelected,
                  disabled && styles.chipDisabled,
                ]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {"$".repeat(Number(level))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.gutter },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: { color: colors.text, fontSize: 16 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.base },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.base,
  },
  chipSelected: { backgroundColor: colors.brand },
  chipDisabled: { opacity: 0.5 },
  chipText: { color: colors.textMuted, fontSize: 16 },
  chipTextSelected: { color: colors.onBrand, fontWeight: "600" },
});
