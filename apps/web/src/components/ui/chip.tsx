"use client";

import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * Cuisine / tag chip primitive (09-design-system.md §7). Presentational only (CLAUDE.md §4):
 * selection is a prop and the label is supplied by the caller — the closed CUISINES
 * taxonomy lives in @munch/core and is never hardcoded here. Unselected: cream fill,
 * hairline border, muted text. Selected: solid burnt-orange (`heat`) with on-heat text.
 * Omitting `onClick` renders a decorative (card-tag) chip with no button role — the web
 * twin of the Phase B mobile Chip.
 */
export function Chip({
  label,
  selected = false,
  onClick,
  disabled = false,
  leadingIcon,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  leadingIcon?: ReactNode;
}) {
  const base = cx(
    "inline-flex items-center gap-xs rounded-full px-gutter py-base text-body-md",
    selected
      ? "bg-heat text-on-heat"
      : "border border-border bg-background text-text-muted",
    disabled && "opacity-50",
  );

  if (!onClick) {
    return (
      <span className={base}>
        {leadingIcon}
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        base,
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40",
      )}
    >
      {leadingIcon}
      {label}
    </button>
  );
}

/** Alias matching the design-system "FoodChip" name (same component). */
export { Chip as FoodChip };
