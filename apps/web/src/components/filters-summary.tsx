import { cuisineLabel, type PriceLevel } from "@munch/core";

/**
 * Read-only summary of the room's active filters. Shown to non-host members (who can see but
 * not edit the host-controlled filters — CLAUDE.md §2.2) and in the lobby's active-filters
 * line. Presentational only; cuisine ids render via the @munch/core label lookup.
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
    <p className="text-body-md text-text-muted">
      {parts.length > 0 ? (
        parts.join(" · ")
      ) : (
        <em>No filters — any restaurant</em>
      )}
    </p>
  );
}
