import { UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Page chrome for the full-screen (non-tab) routes — Create Room, Join, and the
 * auth/reset/callback screens. They live OUTSIDE the (tabs) route group so they carry no
 * nav chrome (pages.md §2); this gives them the brand row (which doubles as the way back to
 * the Match home), the cream canvas, an optional title/subtitle header, and a centered,
 * readable content column that reflows mobile↔desktop (design-system.md §6). Presentation
 * only — no data, no hooks (CLAUDE.md §4). Mirrors the per-screen header the mobile screens
 * render (apps/mobile/app/room/*, /auth/*).
 */
export function FullScreenView({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <div className="munch-column flex flex-col gap-md py-md md:py-lg">
        <Link
          href="/"
          aria-label="Munch home"
          className="inline-flex w-fit items-center gap-base rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
        >
          <UtensilsCrossed size={24} className="text-heat" aria-hidden />
          <span className="text-title-lg text-text">Munch</span>
        </Link>
        {title || subtitle ? (
          <header className="flex flex-col gap-base">
            {title ? (
              <h1 className="text-display-lg-mobile text-text md:text-display-lg">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="text-body-md text-text-muted">{subtitle}</p>
            ) : null}
          </header>
        ) : null}
        {children}
      </div>
    </main>
  );
}
