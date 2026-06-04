"use client";

import { cx } from "./cx";

/**
 * Selectable price / segment tile (09-design-system.md §7). Presentational only (CLAUDE.md
 * §4): selection is a prop. Selected = amber (`brand`) fill with charcoal text;
 * unselected = sunken tonal fill. Designed to sit `flex-1` in a row of tiles ($-$$$$).
 * `caption` is the small descriptor under the glyph (e.g. "Cheap"). The web twin of the
 * Phase B mobile PriceTile.
 */
export function PriceTile({
  label,
  caption,
  selected = false,
  onClick,
  disabled = false,
}: {
  label: string;
  caption?: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-pressed={selected}
      className={cx(
        "flex min-h-11 flex-1 flex-col items-center justify-center gap-xs rounded-md px-base py-sm",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40",
        selected ? "bg-brand text-on-brand" : "bg-surface-sunken text-text",
        disabled && "opacity-50",
      )}
    >
      <span className="text-title-lg">{label}</span>
      {caption ? (
        <span className={cx("text-caption", !selected && "text-text-muted")}>
          {caption}
        </span>
      ) : null}
    </button>
  );
}

/** Alias matching the design-system "SegmentedTile" name (same component). */
export { PriceTile as SegmentedTile };
