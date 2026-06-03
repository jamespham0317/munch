import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * Small caption pill / badge (design-system.md §7) — "Waiting…", "1.2 km", a "4.8 ★"
 * rating, an aggregate "(4/8)" count. Presentational only (CLAUDE.md §4); the rating
 * star (or any glyph) is passed as `leadingIcon` by the caller, in brand amber.
 * `tone="onImage"` adds a soft shadow so the pill reads over a photo header. The web
 * twin of the Phase B mobile ProgressPill.
 */
export function ProgressPill({
  label,
  leadingIcon,
  tone = "neutral",
}: {
  label: string;
  leadingIcon?: ReactNode;
  tone?: "neutral" | "onImage";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-xs self-start rounded-full bg-surface-raised px-sm py-xs text-caption text-text-muted",
        tone === "onImage" && "shadow-low",
      )}
    >
      {leadingIcon}
      {label}
    </span>
  );
}

/** Alias matching the design-system "Badge" name (same component). */
export { ProgressPill as Badge };
