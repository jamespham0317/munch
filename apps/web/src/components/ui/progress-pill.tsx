import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * Small caption pill / badge (09-design-system.md §7) — "Waiting…", "1.2 km", a "4.8 ★"
 * rating, an aggregate "(4/8)" count. Presentational only (CLAUDE.md §4); the rating
 * star (or any glyph) is passed as `leadingIcon` by the caller, in brand amber.
 * `tone="onImage"` adds a soft shadow so the pill reads over a photo header;
 * `tone="match"` is the celebratory amber-tint badge (faint brand fill + deep-amber
 * ink) used as the "It's a Match!" eyebrow (09-design-system.md §7). `className` lets
 * a caller override layout — e.g. swap the default `self-start` for `self-center` in a
 * centered header. The web twin of the Phase B mobile ProgressPill.
 */
export function ProgressPill({
  label,
  leadingIcon,
  tone = "neutral",
  className,
}: {
  label: string;
  leadingIcon?: ReactNode;
  tone?: "neutral" | "onImage" | "match";
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-xs self-start rounded-full px-sm py-xs text-caption",
        tone === "match"
          ? "bg-brand/20 text-brand-deep"
          : "bg-surface-raised text-text-muted",
        tone === "onImage" && "shadow-low",
        className,
      )}
    >
      {leadingIcon}
      {label}
    </span>
  );
}

/** Alias matching the design-system "Badge" name (same component). */
export { ProgressPill as Badge };
