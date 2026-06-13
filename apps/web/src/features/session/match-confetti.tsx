"use client";

import { colors } from "@munch/ui";
import confetti from "canvas-confetti";
import { useEffect } from "react";

/**
 * One-shot match celebration (09-design-system.md §8, 10-pages.md §3.7). Confetti spawns across
 * the full width at the top and **falls straight down** over the result card — emitted downward
 * (angle 270°, gravity-driven, low start velocity) so nothing ever travels upward. canvas-confetti
 * renders its own full-screen canvas above the page, so it already paints over the card. Colours
 * come from @munch/ui (never hardcoded hex — §3). Suppressed entirely under prefers-reduced-motion
 * (§10). Pure presentation — no data, no provider call (CLAUDE.md §4). Twin of the mobile
 * MatchConfetti.
 */
const CONFETTI_COLORS = [
  colors.brand,
  colors.heat,
  colors.brandPressed,
  colors.online,
];
// A handful of origins across the top edge give a full-width downpour (a single origin is a
// point); the summed particle counts land near the prior ~140.
const ORIGIN_XS = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85];

export function MatchConfetti() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    for (const x of ORIGIN_XS) {
      void confetti({
        particleCount: Math.round(140 / ORIGIN_XS.length),
        angle: 270, // straight down (90 = up); spread stays within the lower hemisphere
        spread: 80,
        startVelocity: 18,
        gravity: 0.9,
        ticks: 320,
        origin: { x, y: -0.05 }, // just above the top edge, so pieces fall in from the top
        colors: CONFETTI_COLORS,
      });
    }
  }, []);

  return null;
}
