import type { ReactNode } from "react";

import { TabsNav } from "./tabs-nav";

/**
 * Nav-shell layout for the three in-app destinations (10-pages.md §2). Wraps Discover · Match ·
 * Profile in the responsive nav (TabsNav) and the centered 1200px content well
 * (09-design-system.md §6). Room-flow and auth routes live OUTSIDE this route group, so they
 * present full-screen with no nav chrome (mirrors the mobile shell). Presentation only — no
 * data, no hooks; Providers already wrap the tree from the root layout.
 *
 * Desktop (≥1024px): side rail + content in a flex row. Mobile: content scrolls under a fixed
 * bottom bar, so the main column carries bottom padding to clear it.
 */
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lg:flex lg:min-h-screen">
      <TabsNav />
      <main className="flex-1 pb-24 lg:pb-0">
        <div className="munch-container py-md">{children}</div>
      </main>
    </div>
  );
}
