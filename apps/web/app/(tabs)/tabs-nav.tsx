"use client";

import { Compass, Heart, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { TabBar, type TabBarItem } from "@/components/ui";

/**
 * Three-destination nav shell (pages.md §2): Discover · Match · Profile. The router
 * adapter for the presentational TabBar primitive (design-system.md §7) — it derives the
 * active destination from the pathname and routes on select; the primitive owns no
 * navigation logic (CLAUDE.md §4). Mirrors the mobile (tabs) shell, using the same Feather
 * glyphs (compass/heart/user) via lucide-react for cross-platform parity.
 *
 * Renders the SAME bar twice so it can be responsive without a JS viewport check
 * (SSR-safe): a left side rail at desktop (≥1024px, the container breakpoint) and a fixed
 * bottom bar below it (design-system.md §6, "top/side nav at desktop"). Three destinations
 * regardless of any single mockup showing two (pages.md §2).
 */

type Destination = {
  key: string;
  href: string;
  label: string;
  Icon: typeof Compass;
};

// Fixed display order: Discover · Match · Profile. Match is the room-flow entry (home);
// Profile is the account/history destination (auth moves here in Prompt 4).
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

  const items: TabBarItem[] = DESTINATIONS.map(({ key, label, Icon }) => ({
    key,
    label,
    renderIcon: ({ color, size }) => (
      <Icon color={color} size={size} aria-hidden />
    ),
  }));

  function select(key: string) {
    const destination = DESTINATIONS.find((d) => d.key === key);
    if (destination && key !== activeKey) router.push(destination.href);
  }

  return (
    <>
      {/* Desktop: in-flow left side rail (the primitive's `side` layout). */}
      <TabBar
        items={items}
        activeKey={activeKey}
        onSelect={select}
        layout="side"
        className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:justify-start lg:gap-base lg:py-lg"
      />
      {/* Mobile: fixed bottom bar above the content. */}
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
