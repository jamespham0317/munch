# Design System

**Project:** Munch
**Document:** Design System — "Munch Visual Language"
**Status:** Draft v1 — for build
**Last updated:** 2026-06-02

---

## 1. Purpose

This is the canonical source for Munch's visual language: tokens, primitives, and the
component patterns the apps reskin to. It derives from the Stitch "Munch Visual Language"
mockups and turns them into implementation-ready rules shared across mobile (Expo / React
Native) and web (Next.js).

The companion docs are `10-pages.md` (which screens exist and what each is wired to) and
`11-ui-roadmap.md` (the phased build order). If a token or component here disagrees with the
code, that is a bug — reconcile in the same change (CLAUDE.md §1).

---

## 2. Brand & style

**Modern-Playful.** Munch turns the stressful "where should we eat?" debate into a
gamified, social experience for a Gen-Z/Millennial audience. The style is "squishy" and
tactile: generous whitespace, a warm high-saturation palette, extreme roundedness, and soft
ambient depth rather than hard drop shadows. It should feel closer to a social app than a
utility/directory.

---

## 3. The token layer (`@munch/ui`)

Tokens live **once** in `packages/ui` as platform-agnostic TypeScript constants — **no React
Native and no DOM imports**, so both apps and (if ever needed) server rendering can consume
them. This honors the monorepo rule: no duplicated values across apps (docs/05 §2, §8).

```
packages/ui/
├── src/
│   ├── tokens.ts     # colors, typography, spacing, radii, shadows (the values below)
│   └── index.ts
├── package.json      # @munch/ui, exports ./src/index.ts (source, no build) — mirrors @munch/core
└── tsconfig.json
```

**Platform mapping (tokens are the single source; each platform adapts, never re-defines):**

- **Mobile** — `apps/mobile/src/theme/index.ts` re-exports `@munch/ui` tokens; RN primitives
  consume them via `StyleSheet`.
- **Web** — the Tailwind v4 theme is seeded from the same tokens (emitted as CSS custom
  properties / `@theme` values); components style with token-backed utility classes.

**Explicitly not doing:** `react-native-web`. Sharing tokens is high-value and cheap; sharing
rendered components across the RN/DOM boundary is not worth the weight here. Component
**implementations** stay per-app; their **look** is unified through the tokens below.

---

## 4. Color

Anchored by **Vibrant Amber** (appetite, optimism) with **Burnt Orange** for heat/secondary
actions, on a warm **Cream** surface with **Deep Charcoal** text. Semantic roles (left) are
what components reference — never raw hex.

| Role | Hex | Use |
|---|---|---|
| `brand` (amber) | `#ffbf00` | Primary actions, brand moments, active fills |
| `brand-pressed` | `#fbbc00` | Amber pressed/hover state |
| `on-brand` | `#1c1b1b` | Text/icons on amber (charcoal, not white) |
| `heat` (burnt orange) | `#fc7c31` | Secondary interactive, highlights, selected chips |
| `heat-strong` | `#9f4200` | Burnt-orange emphasis (e.g. small solid buttons) |
| `on-heat` | `#ffffff` | Text/icons on burnt orange |
| `background` (cream) | `#fcf9f8` | App background |
| `surface` | `#ffffff` | Cards, sheets (lowest container) |
| `surface-raised` | `#f6f3f2` | Tonal layer 1 |
| `surface-sunken` | `#f0eded` | Tonal layer 2 / inactive tiles |
| `surface-highest` | `#e5e2e1` | Neutral control fill (e.g. the pass button) |
| `text` | `#1c1b1b` | Primary text |
| `text-muted` | `#504532` | Secondary text |
| `text-faint` | `#827660` | Captions, placeholders, outlines |
| `border` | `#d4c5ab` | Hairline borders, unselected chip outline |
| `error` | `#ba1a1a` | Errors / destructive |
| `on-error` | `#ffffff` | Text on error |
| `error-container` | `#ffdad6` | Error backgrounds |
| `online` | `#2fbf71` | Presence dot (functional; added beyond the Material set) |

Notes:
- Pure black/white are avoided for text/background to keep the warm atmosphere. Card
  interiors are `#ffffff`; the app canvas is cream.
- Image headers inside cards carry a subtle bottom-inner-shadow so overlaid white text stays
  legible.
- `online` is an app-functional color for lobby presence dots; the Stitch palette didn't
  define one. Keep it out of brand surfaces.

---

## 5. Typography

**Quicksand** everywhere (rounded terminals = friendly/bubbly). Body uses medium (500), not
regular, so the rounded face keeps character at small sizes. Labels are uppercase with
tracking. Load via `expo-font` + `@expo-google-fonts/quicksand` (mobile) and
`next/font/google` (web).

| Token | Size | Weight | Line-height | Tracking | Use |
|---|---|---|---|---|---|
| `display-lg` | 40px | 700 | 1.1 | -0.02em | Desktop hero |
| `display-lg-mobile` | 32px | 700 | 1.2 | -0.01em | Mobile screen titles |
| `headline-md` | 24px | 700 | 1.3 | — | Section headers |
| `title-lg` | 20px | 600 | 1.4 | — | Card titles, restaurant name |
| `body-lg` | 18px | 500 | 1.6 | — | Primary body |
| `body-md` | 16px | 500 | 1.6 | — | Default body |
| `label-md` | 14px | 700 | 1.2 | 0.05em (UPPERCASE) | Eyebrow labels, chips |
| `caption` | 12px | 500 | 1.4 | — | Meta (distance, counts) |

---

## 6. Spacing, radii, elevation

**Spacing** — 8px base; lean to the larger end inside containers for an airy feel.

`xs 4 · sm 12 · base 8 · gutter 16 · md 24 · lg 48 · xl 64`. Card interiors use `md` (24px);
the "Decision" card uses 32px. Mobile screen margin 20px; desktop content is centered in a
**1200px max-width** container with 48px margins. On web these are the `.munch-container`
(1200px tab-shell width) and `.munch-column` (36rem reading column for the full-screen
room/auth routes) utilities in `globals.css` — var-backed, not Tailwind's `max-w-*` t-shirt
scale, which the seeded named `--spacing-*` tokens shadow.

**Radii** — sharp corners are avoided entirely.

`sm 8px · DEFAULT 16px · md 24px · lg 32px · xl 48px · full 9999px`. Buttons & inputs are
`full` (pill). Restaurant cards are `xl`. Icons follow the type: rounded ends, 2px strokes.

**Elevation** — ambient soft shadows, not hard drops; tonal cream layers add depth too.

- `shadow-low` — 4px blur, 10% charcoal, 2px y-offset (resting cards/buttons).
- `shadow-active` — 12px blur, 15% charcoal, 6px y-offset (hover / dragged card).
- **Press affordance** — 2px downward translate on press to simulate a physical click.

---

## 7. Component primitives

Built once per platform in `components/ui/` (mobile) and the web equivalent, all from §4–§6
tokens. They hold **no business logic and read no data** (CLAUDE.md §4).

- **Button** — pill (`radius-full`). Variants: `primary` (amber fill, charcoal text),
  `secondary` (burnt-orange fill, white text), `ghost`/`outline` (border, transparent),
  `social` (white, provider logo + label). States: default / pressed (2px translate +
  `brand-pressed`) / disabled / loading. Min 44px touch target.
- **Chip / FoodChip** — cuisine + tag pills. Unselected: cream fill / `border` outline /
  muted text. Selected: solid `heat` (burnt orange) / `on-heat` text. Used for the closed
  `CUISINES` taxonomy (docs/01 §8) and decorative card tags.
- **Card** — `radius-xl`, `shadow-low`, white surface, 24px padding (32px for the Decision
  card). Optional image header with bottom-inner-shadow.
- **PriceTile / SegmentedTile** — `$`–`$$$$` selectable tiles; selected = amber fill.
- **Field / Input** — pill or `radius-md`; 2px amber border + soft amber outer glow on focus;
  faint placeholder.
- **Avatar** — circular; optional `online` presence dot; "+" variant for "Invite more".
- **ProgressPill / Badge** — small caption pills ("Waiting…", "1.2 km", rating "4.8 ★",
  "(4/8)"). Rating star uses amber.
- **RadiusSlider** — amber thumb + amber value pill; bounded to the host's anchor (see §9).
- **AnchorMap** — the Create Room anchor picker (Phase 4.6): a MapLibre map over keyless
  OpenStreetMap raster tiles with a **fixed center pin** (anchor = map center) and a translucent
  **amber radius ring** (`brand` low-opacity fill + `heat` stroke). The ring is a **fixed-size
  overlay** centered on the map — it never moves or resizes; the RadiusSlider drives the **map
  zoom** (`zoomForRadius`) so the ring represents the selected radius and stays fully visible.
  The "© OpenStreetMap contributors" attribution is always visible. Built once per platform
  (`maplibre-gl` web / `@maplibre/maplibre-react-native` mobile, no `react-native-web`);
  presentational only — reads no data and makes no provider call (CLAUDE.md §4, §2.1).
- **Toggle** — "bite-out-of-a-circle" custom radio when selected (playful selection mark).
- **TabBar** — bottom bar (Discover · Match · Profile); active item amber. Responsive on web
  (bottom bar on mobile widths → top/side nav at desktop width).

---

## 8. Munch-specific patterns

- **The Decision Card** — the swipe card: photo header (with distance pill overlay), title
  (restaurant name), rating chip, `price • cuisine` line, decorative food chips, drag/throw
  gesture with button fallback (right = like, left = pass). 32px interior padding, high
  shadow while dragged.
- **Swipe action row** — `pass` (neutral `surface-highest` circle, ✕) and `like` (amber
  circle, ♥). **No third "save/super-like" action** — v1 is like/pass only; the mockup's
  middle bookmark button is dropped (super-like is post-v1, docs/07 §8).
- **Match reveal** — confetti, "It's a Match!" badge, full-bleed photo card, name + meta,
  primary "Get Directions" (opens an external maps app via deep link — no provider API call),
  secondary "Share Match" (OS share sheet).
- **Host resolution** — "Group's Top Pick" Decision Card with an aggregate "N/M friends liked
  this" pill, "Settle for this" (→ accept top), and a "Widen the Search" block (radius slider
  + cuisine chips + "Fetch New Deck" → widen).
- **Squad list (lobby)** — a 2-column grid of avatar tiles with presence dots and a presence
  label (Here/Away), an "Invite more" tile, and the amber shareable-code + QR card (tap to copy
  the join link). The squad count is the number of members joined. (v1 has no per-member status
  text — the mockup's flavor snippets aren't backed by data.)

---

## 9. Invariants the UI must respect (presentation only)

The reskin is visual; it must not move domain logic or weaken the §2/§3 invariants
(CLAUDE.md):

- Components **never declare a match** and **never call the provider**; matching/ranking/
  shuffle stay in `@munch/core`. "Settle for this" / "Fetch New Deck" call `resolve_session`
  (accept_top / widen); a swipe calls `submit_swipe`.
- **Aggregate counts only.** The resolution "N/M friends liked this" pill and any progress UI
  show counts, never which member liked/passed (docs/03 §3.7, CLAUDE.md §3). Avatars shown
  there are decorative, not a per-swipe disclosure.
- The **radius slider** narrows within the host's anchor; filters are **host-controlled** for
  the room (docs/01 §8, invariant §2.2).
- Cuisine selection uses the closed `CUISINES` taxonomy from `@munch/core` — a fixed picker,
  not free text (docs/01 §8).

---

## 10. Accessibility & interaction

- Charcoal-on-amber and charcoal-on-cream meet contrast; never white text on amber.
- The swipe **gesture has a button fallback** (the pass/like buttons) for accessibility and
  web pointer users; both call the same handlers.
- Minimum 44px touch targets; focus-visible states on web; respect reduced-motion for the
  card throw and confetti.
- Labels/headings use semantic roles (RN `accessibilityRole`, web headings/landmarks).
