import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * Icon badge primitive (09-design-system.md §7) — a rounded container holding a single
 * glyph, the decorative anchor atop the auth/join cards. Presentational only (CLAUDE.md §4).
 * Two variants from the Stitch mockups:
 *  - `solid` — amber `brand` fill, charcoal glyph, soft `shadow-low`, a static 3° tilt for
 *    a playful "squishy" feel (the Join "restaurant" badge). No hover/float motion (§10).
 *  - `tonalCircle` — a circular faint-amber (`brand`/20) tonal surface with deep-amber
 *    `brand-deep` ink (the Forgot "info"/"lock"/"check" badge).
 */
export function IconBadge({
  icon,
  variant = "solid",
  className,
}: {
  icon: ReactNode;
  variant?: "solid" | "tonalCircle";
  className?: string;
}) {
  const variantClass =
    variant === "tonalCircle"
      ? "h-20 w-20 rounded-full bg-brand/20 text-brand-deep"
      : "rounded-lg bg-brand p-4 text-on-brand shadow-low rotate-3";
  return (
    <div
      aria-hidden
      className={cx(
        "inline-flex items-center justify-center",
        variantClass,
        className,
      )}
    >
      {icon}
    </div>
  );
}
