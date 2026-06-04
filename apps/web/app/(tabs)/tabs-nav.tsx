"use client";

import { Compass, Heart, User, UtensilsCrossed } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { TabBar, type TabBarItem } from "@/components/ui";

/**
 * Three-destination nav shell (10-pages.md §2): Discover · Match · Profile. The router
 * adapter that derives the active destination from the pathname and routes on select; the
 * presentational pieces own no navigation logic (CLAUDE.md §4). Mirrors the mobile (tabs)
 * shell, using the same Feather glyphs (compass/heart/user) via lucide-react for
 * cross-platform parity.
 *
 * Responsive without a JS viewport check (SSR-safe):
 * - Desktop (≥1024px, the container breakpoint): a bespoke left **side rail** reskinned to the
 *   Stitch "Munch Web" desktop sidenav — brand logo, labelled rows with a solid-amber active
 *   pill, and a user-identity card pinned to the bottom (09-design-system.md §4, §6, §7).
 * - Below it: the shared TabBar primitive as a fixed **bottom bar** (unchanged).
 * Three destinations regardless of any single mockup showing two (10-pages.md §2).
 */

type Destination = {
  key: string;
  href: string;
  label: string;
  Icon: typeof Compass;
};

// Fixed display order: Discover · Match · Profile. Match is the room-flow entry (home);
// Profile is the account/history destination.
const DESTINATIONS: Destination[] = [
  { key: "discover", href: "/discover", label: "Discover", Icon: Compass },
  { key: "match", href: "/", label: "Match", Icon: Heart },
  { key: "profile", href: "/history", label: "Profile", Icon: User },
];

function activeKeyFor(pathname: string): string {
  if (pathname.startsWith("/discover")) return "discover";
  if (pathname.startsWith("/history")) return "profile";
  // Home ("/") and anything else under the Match tab resolve to Match.
  return "match";
}

export function TabsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = activeKeyFor(pathname);

  function select(key: string) {
    const destination = DESTINATIONS.find((d) => d.key === key);
    if (destination && key !== activeKey) router.push(destination.href);
  }

  // Bottom bar (mobile) reuses the shared presentational primitive — unchanged.
  const items: TabBarItem[] = DESTINATIONS.map(({ key, label, Icon }) => ({
    key,
    label,
    renderIcon: ({ color, size }) => (
      <Icon color={color} size={size} aria-hidden />
    ),
  }));

  return (
    <>
      {/* Desktop: bespoke left side rail matching the Stitch "Munch Web" sidenav. */}
      <nav
        aria-label="Primary"
        className="z-40 hidden bg-background lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:p-lg"
      >
        {/* Brand logo + wordmark — colours match the Match-tab header (heat icon, charcoal text). */}
        <div className="mb-lg flex items-center gap-sm">
          <UtensilsCrossed size={28} className="text-heat" aria-hidden />
          <span className="text-display-lg-mobile font-bold text-text">
            Munch
          </span>
        </div>

        {/* Labelled rows; active row is a solid-amber pill with charcoal text. */}
        <div className="flex flex-1 flex-col gap-base">
          {DESTINATIONS.map(({ key, label, Icon }) => {
            const focused = key === activeKey;
            return (
              <button
                key={key}
                type="button"
                aria-current={focused ? "page" : undefined}
                onClick={() => select(key)}
                className={[
                  "flex min-h-11 items-center gap-md rounded-lg px-md py-sm text-label-md transition-colors",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40",
                  focused
                    ? "bg-brand text-on-brand"
                    : "text-text-muted hover:bg-surface-sunken",
                ].join(" ")}
              >
                <Icon size={22} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile: fixed bottom bar above the content (shared primitive, unchanged). */}
      <TabBar
        items={items}
        activeKey={activeKey}
        onSelect={select}
        layout="bottom"
        className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
      />
    </>
  );
}
