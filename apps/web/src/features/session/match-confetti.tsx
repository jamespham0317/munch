"use client";

import { colors } from "@munch/ui";
import confetti from "canvas-confetti";
import { useEffect } from "react";

/**
 * One-shot match celebration (09-design-system.md §8, 10-pages.md §3.7). Fires a single confetti
 * burst on mount in brand/heat colours sourced from @munch/ui (never hardcoded hex —
 * 09-design-system.md §3). Suppressed entirely under prefers-reduced-motion (§10). Pure
 * presentation — no data, no provider call (CLAUDE.md §4). Web twin of the Phase B mobile
 * ConfettiCannon.
 */
export function MatchConfetti() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    void confetti({
      particleCount: 140,
      spread: 70,
      origin: { y: 0 },
      colors: [colors.brand, colors.heat, colors.brandPressed, colors.online],
    });
  }, []);

  return null;
}
