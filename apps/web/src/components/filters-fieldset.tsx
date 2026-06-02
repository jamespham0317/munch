import { type CuisineId, CUISINES, type PriceLevel } from "@munch/core";

/**
 * Shared host-filter controls (open-now + the closed cuisine taxonomy + price levels),
 * reused by the create-room form and the lobby filter-edit panel so the two stay in sync.
 * Presentational only — it owns no data access and holds the selections as controlled props
 * (CLAUDE.md §4). Cuisines come from the @munch/core CUISINES constant (no free text); the
 * picker only ever emits taxonomy ids. Filters are host-only and whole-room (CLAUDE.md §2.2);
 * there is no per-member narrowing here.
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
    <>
      <label>
        <input
          type="checkbox"
          checked={openNow}
          onChange={(event) => onOpenNowChange(event.target.checked)}
          disabled={disabled}
        />
        Open now
      </label>
      <fieldset>
        <legend>Cuisines</legend>
        {CUISINES.map(({ id, label }) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={cuisines.includes(id)}
              onChange={() => toggleCuisine(id)}
              disabled={disabled}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Price range</legend>
        {PRICE_LEVELS.map((level) => (
          <label key={level}>
            <input
              type="checkbox"
              checked={priceLevels.includes(level)}
              onChange={() => togglePriceLevel(level)}
              disabled={disabled}
            />
            {"$".repeat(Number(level))}
          </label>
        ))}
      </fieldset>
    </>
  );
}
