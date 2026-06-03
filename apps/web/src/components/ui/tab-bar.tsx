"use client";

import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * Responsive nav presentation primitive (design-system.md §7). PURE PRESENTATION — it
 * renders items and reports selection; the actual Next App Router routing wiring is
 * Prompt 3 (CLAUDE.md §4). The active item is brand amber. `layout` switches between a
 * bottom bar (mobile widths) and a top/side stack (desktop) without changing the API,
 * so Prompt 3 can place the same bar responsively. Each item supplies its own icon via
 * `renderIcon` (a CSS-variable colour, so the bar stays icon-library-agnostic and never
 * hardcodes a hex). The web twin of the Phase B mobile TabBar.
 */
export type TabBarItem = {
  key: string;
  label: string;
  renderIcon: (props: {
    color: string;
    size: number;
    focused: boolean;
  }) => ReactNode;
};

export function TabBar({
  items,
  activeKey,
  onSelect,
  layout = "bottom",
  className,
}: {
  items: TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  layout?: "bottom" | "side";
  className?: string;
}) {
  return (
    <nav
      role="tablist"
      className={cx(
        "bg-surface",
        layout === "bottom"
          ? "flex flex-row border-t border-border"
          : "flex flex-col border-r border-border",
        className,
      )}
    >
      {items.map((item) => {
        const focused = item.key === activeKey;
        const color = focused
          ? "var(--color-brand)"
          : "var(--color-text-faint)";
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={focused}
            aria-label={item.label}
            onClick={() => onSelect(item.key)}
            className={cx(
              "flex min-h-11 items-center justify-center gap-xs py-base text-caption",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40",
              layout === "bottom" ? "flex-1 flex-col" : "flex-row px-gutter",
              focused ? "text-brand" : "text-text-faint",
            )}
          >
            {item.renderIcon({ color, size: 24, focused })}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
