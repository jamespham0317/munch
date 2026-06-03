import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * Surface card primitive (design-system.md §7): radius-xl, soft `shadow-low`, white
 * surface. `padding` exposes the 24px default and the 32px "Decision" card interior
 * (CLAUDE.md §4 — presentational, no data). The web twin of the Phase B mobile Card.
 * An optional image header carries a bottom legibility scrim (charcoal gradient, from
 * the `text` token — not a new colour) so overlaid white text stays readable; the
 * `imageOverlay` slot is positioned over it. `surface` switches the fill from the default
 * white to the brand amber (charcoal text) for the highlighted cards — the Welcome
 * "Create a Room" card and the lobby code panel (design-system.md §8).
 */
export function Card({
  children,
  padding = "md",
  surface = "default",
  image,
  imageAlt = "",
  imageHeight = 200,
  imageOverlay,
  className,
}: {
  children?: ReactNode;
  /** `md` = 24px interior; `decision` = 32px (the swipe card); `none` = no padding. */
  padding?: "md" | "decision" | "none";
  /** `default` = white surface; `brand` = amber fill with charcoal text. */
  surface?: "default" | "brand";
  /** A missing/undefined src renders the card without a photo header. */
  image?: string | undefined;
  imageAlt?: string;
  imageHeight?: number;
  imageOverlay?: ReactNode;
  className?: string;
}) {
  const padClass =
    padding === "decision" ? "p-8" : padding === "none" ? "" : "p-md";
  const surfaceClass =
    surface === "brand" ? "bg-brand text-on-brand" : "bg-surface";
  return (
    <div
      className={cx(
        "overflow-hidden rounded-xl shadow-low",
        surfaceClass,
        className,
      )}
    >
      {image ? (
        <div
          className="relative w-full bg-surface-highest"
          style={{ height: imageHeight }}
        >
          {/* Remote, dynamically sized restaurant photos; next/image config is out
              of scope for this reskin (the root ESLint config has no next plugin). */}
          <img
            src={image}
            alt={imageAlt}
            className="h-full w-full object-cover"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-text/40 to-transparent"
          />
          {imageOverlay ? (
            <div className="absolute inset-0 p-gutter">{imageOverlay}</div>
          ) : null}
        </div>
      ) : null}
      <div className={padClass}>{children}</div>
    </div>
  );
}
