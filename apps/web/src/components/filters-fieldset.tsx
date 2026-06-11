import {
  type CuisineId,
  CUISINES,
  PRICE_LEVELS,
  type PriceLevel,
} from "@munch/core";

import { Field, FoodChip, PriceTile, Toggle } from "./ui";

/**
 * Shared host-filter controls (open-now + the closed cuisine taxonomy + price levels),
 * reused by the create-room form and the lobby filter-edit panel so the two stay in sync
 * (restyling here updates both, 09-design-system.md §8). Presentational only — it owns no data
 * access and holds the selections as controlled props (CLAUDE.md §4). Cuisines + price levels
 * come from the @munch/core CUISINES / PRICE_LEVELS constants (no free text); the picker only
 * ever emits taxonomy ids. Filters are host-only and whole-room (CLAUDE.md §2.2); there is no
 * per-member narrowing here.
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
    <div className="flex flex-col gap-md">
      <Toggle
        value={openNow}
        onValueChange={onOpenNowChange}
        label="Open now"
        disabled={disabled}
      />
      <Field label="What's the craving?">
        <div className="flex flex-wrap gap-base">
          {CUISINES.map(({ id, label }) => (
            <FoodChip
              key={id}
              label={label}
              selected={cuisines.includes(id)}
              onClick={() => toggleCuisine(id)}
              disabled={disabled}
            />
          ))}
        </div>
      </Field>
      <Field label="Price range">
        <div className="flex gap-base">
          {PRICE_LEVELS.map(({ level, caption }) => (
            <PriceTile
              key={level}
              label={"$".repeat(Number(level))}
              caption={caption}
              selected={priceLevels.includes(level)}
              onClick={() => togglePriceLevel(level)}
              disabled={disabled}
            />
          ))}
        </div>
      </Field>
    </div>
  );
}
