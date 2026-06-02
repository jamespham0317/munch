/**
 * Munch design tokens — the single, platform-agnostic source of truth for the
 * visual language (the "Munch Visual Language", docs/design-system.md §4–§6).
 *
 * These are plain TypeScript constants: NO React Native and NO DOM imports, so
 * both apps (and, if ever needed, server rendering) consume them and never
 * re-define the palette per app (docs/05 §2, CLAUDE.md §4).
 *
 * Values are stored as primitives (unitless numbers, hex strings) so each
 * platform adapts them — mobile via `StyleSheet`, web via Tailwind `@theme`
 * (docs/design-system.md §3). Keys are camelCase per the repo convention
 * (CLAUDE.md §5); the hyphenated names in design-system.md §4–§6 are the doc's
 * spelling of the same roles, and the web theme re-hyphenates at its boundary.
 */

/**
 * Semantic color roles (docs/design-system.md §4). Components reference the role,
 * never the raw hex. These are the SEMANTIC roles — not the Material-style names
 * in the Stitch designMd (e.g. Stitch `primary-container` is our `brand`).
 */
export const colors = {
  /** Primary actions, brand moments, active fills. */
  brand: "#ffbf00",
  /** Amber pressed/hover state. */
  brandPressed: "#fbbc00",
  /** Text/icons on amber (charcoal, never white). */
  onBrand: "#1c1b1b",
  /** Secondary interactive, highlights, selected chips. */
  heat: "#fc7c31",
  /** Burnt-orange emphasis (e.g. small solid buttons). */
  heatStrong: "#9f4200",
  /** Text/icons on burnt orange. */
  onHeat: "#ffffff",
  /** App background (cream). */
  background: "#fcf9f8",
  /** Cards, sheets (lowest container). */
  surface: "#ffffff",
  /** Tonal layer 1. */
  surfaceRaised: "#f6f3f2",
  /** Tonal layer 2 / inactive tiles. */
  surfaceSunken: "#f0eded",
  /** Neutral control fill (e.g. the pass button). */
  surfaceHighest: "#e5e2e1",
  /** Primary text. */
  text: "#1c1b1b",
  /** Secondary text. */
  textMuted: "#504532",
  /** Captions, placeholders, outlines. */
  textFaint: "#827660",
  /** Hairline borders, unselected chip outline. */
  border: "#d4c5ab",
  /** Errors / destructive. */
  error: "#ba1a1a",
  /** Text on error. */
  onError: "#ffffff",
  /** Error backgrounds. */
  errorContainer: "#ffdad6",
  /** Lobby presence dot — app-functional, added beyond the Material set. */
  online: "#2fbf71",
} as const;

/**
 * Type styles (docs/design-system.md §5). The canonical font is Quicksand,
 * loaded per-app in Phase B/C (`expo-font` mobile, `next/font/google` web).
 *
 * Units: `fontSize` in px (number), `fontWeight` as a string (RN/CSS both accept
 * the numeric-string form), `lineHeight` as a unitless multiplier (number), and
 * `letterSpacing` in em (number) where the type scale specifies tracking.
 */
export const typography = {
  /** Desktop hero. */
  displayLg: {
    fontSize: 40,
    fontWeight: "700",
    lineHeight: 1.1,
    letterSpacing: -0.02,
  },
  /** Mobile screen titles. */
  displayLgMobile: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 1.2,
    letterSpacing: -0.01,
  },
  /** Section headers. */
  headlineMd: { fontSize: 24, fontWeight: "700", lineHeight: 1.3 },
  /** Card titles, restaurant name. */
  titleLg: { fontSize: 20, fontWeight: "600", lineHeight: 1.4 },
  /** Primary body. */
  bodyLg: { fontSize: 18, fontWeight: "500", lineHeight: 1.6 },
  /** Default body. */
  bodyMd: { fontSize: 16, fontWeight: "500", lineHeight: 1.6 },
  /** Eyebrow labels, chips (UPPERCASE in use). */
  labelMd: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 1.2,
    letterSpacing: 0.05,
  },
  /** Meta (distance, counts). */
  caption: { fontSize: 12, fontWeight: "500", lineHeight: 1.4 },
} as const;

/**
 * Spacing scale + layout constants (docs/design-system.md §6), all px numbers.
 * 8px base; lean to the larger end inside containers for an airy feel.
 */
export const spacing = {
  xs: 4,
  sm: 12,
  base: 8,
  gutter: 16,
  md: 24,
  lg: 48,
  xl: 64,
  /** Mobile screen margin. */
  screenMarginMobile: 20,
  /** Desktop content is centered in this max-width. */
  contentMaxWidth: 1200,
  /** Desktop content margins. */
  desktopMargin: 48,
} as const;

/**
 * Corner radii (docs/design-system.md §6), px numbers. Sharp corners are avoided
 * entirely. Buttons & inputs are `full` (pill); restaurant cards are `xl`.
 */
export const radii = {
  sm: 8,
  /** Base radius. */
  DEFAULT: 16,
  md: 24,
  lg: 32,
  xl: 48,
  full: 9999,
} as const;

/**
 * Ambient soft shadows (docs/design-system.md §6). Stored as structured
 * primitives — each platform renders them differently (RN `shadow*` props /
 * `elevation`, web `box-shadow`), so we keep the parts, not a CSS/RN string.
 * `color` is the deep charcoal; `opacity` is applied to it per platform.
 */
export const shadows = {
  /** Resting cards/buttons. */
  shadowLow: { yOffset: 2, blur: 4, color: "#1c1b1b", opacity: 0.1 },
  /** Hover / dragged card. */
  shadowActive: { yOffset: 6, blur: 12, color: "#1c1b1b", opacity: 0.15 },
} as const;

/**
 * Press affordance (docs/design-system.md §6): a 2px downward translate on press
 * to simulate a physical click. Positive y = downward on both platforms.
 */
export const pressTranslateY = 2;
