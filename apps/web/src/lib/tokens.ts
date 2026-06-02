import { colors } from "@munch/ui";

/**
 * Phase A seam (docs/ui-roadmap.md §2): proves `@munch/ui` resolves and typechecks
 * from the web app. Phase C seeds the Tailwind v4 theme from these shared tokens
 * (CSS custom properties / `@theme`) and loads Quicksand; this module is the import
 * proof only — no theme is wired here yet.
 */
export const munchBrand = colors.brand;
