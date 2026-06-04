# UI Roadmap

**Project:** Munch
**Document:** UI Implementation Roadmap (reskin)
**Status:** Draft v1 — for build
**Last updated:** 2026-06-02

---

## 1. How to read this

The functional app is complete through Phase 4.5 (rooms, the real-time match, host
resolution, filters, match history, account auth). What's missing is the **look**: mobile
ships a tiny dark placeholder theme; web has no design system (inline styles only); neither
loads the brand font. This roadmap layers the **"Munch Visual Language"** (see
`09-design-system.md`) onto the existing screens (`10-pages.md`) without changing any domain logic,
endpoints, or realtime wiring.

It expands the "UI polish" bullet of the product roadmap's Phase 4 (docs/07 §6) into a
concrete, sequenced plan. Treat a phase as done only when its exit criteria are met.

**Decisions locked:** web styling is **Tailwind v4** (theme seeded from shared tokens);
scope is a **full reskin of both apps**; tokens live once in **`@munch/ui`** and are not
duplicated per app.

---

## 2. Phase A — Shared token foundation — ✅ Delivered

**Goal:** one platform-agnostic source of truth for the visual language.

- Created `packages/ui` with `tokens.ts` (colors, typography, spacing, radii, shadows from
  `09-design-system.md` §4–§6). No React Native, no DOM imports, no runtime dependency. Mirrors
  `@munch/core` packaging (source export, no build step).
- Wired into the pnpm workspace via `"@munch/ui": "workspace:*"` in both apps (the `packages/*`
  glob and symlink resolution; `tsconfig.base.json` needs no `paths` map).

**Exit criteria — met:** both apps import `@munch/ui` tokens and typecheck (the import seams in
`apps/mobile/src/theme/index.ts` and `apps/web/src/lib/tokens.ts`); token values match
`09-design-system.md` §4–§6 exactly; `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` are
green tree-wide. The reskin of any screen is deferred to Phase B (mobile) / Phase C (web).

---

## 3. Phase B — Mobile (Expo / React Native) — ✅ Delivered

**Goal:** the mockups, live on iOS + Android.

- Loaded **Quicksand** (`expo-font` + `@expo-google-fonts/quicksand`) in `app/_layout.tsx`,
  gating first render until the faces are ready; the status bar is dark content on cream.
- Repointed `apps/mobile/src/theme/index.ts` at `@munch/ui` (a RN adapter over the light
  palette replaced the dark Phase-0 placeholder); typography carries the right Quicksand face
  per weight and `shadow()`/`pressTranslateY` are derived from the tokens — no value re-defined.
- Built the RN primitives in `components/ui/` (Button, Chip/FoodChip, Card, PriceTile/
  SegmentedTile, Field, Input, Avatar, ProgressPill/Badge, RadiusSlider, Toggle, TabBar) per
  `09-design-system.md` §7. The restyled functional pieces (`swipe-card`, `member-list`,
  `invite-panel`, `filters-fieldset`, `filters-summary`) live in `components/`.
- Added the **bottom-tab shell** (Discover · Match · Profile) as an `expo-router` `(tabs)`
  group (`10-pages.md` §2); the room/join routes still present full-screen above the tabs and the
  join deep link still resolves.
- Reskinned every screen in `10-pages.md` §3. The existing reanimated/gesture swipe is kept; only
  the Decision Card visuals changed. The swipe bookmark button is dropped (like/pass only).

**Exit criteria — met:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` are green
tree-wide; the app uses the cream/charcoal light theme with Quicksand; the three tabs navigate;
every screen in `10-pages.md` §3 matches its Stitch mockup; the swipe/match/resolution flows keep
their wiring (a swipe calls `submit_swipe`, resolution calls `resolve_session`) with one
provider call per session and the card never declares a match; no hardcoded palette, ad-hoc
font size, or `react-native-web` import remains in the app. Distance is displayed in **km**
throughout (session/match/resolution); the Stitch mockups are internally inconsistent on units
(the radius slider shows km, the cards show mi), so the app standardized on km — revisit if a
US-imperial launch is decided (open, see CLAUDE.md §9).

---

## 4. Phase C — Web (Next.js) — ✅ Delivered

**Goal:** the same language on the browser, responsive to desktop.

- Added **Tailwind v4** to `apps/web` (`tailwindcss` + `@tailwindcss/postcss`); its theme is
  **seeded from `@munch/ui`** by `apps/web/scripts/generate-theme.ts`, which emits
  `app/theme.generated.css` (a `@theme` block of `--color-*`/`--text-*`/`--radius-*`/
  `--spacing-*`/`--shadow-*` plus a `:root` of layout constants) and runs before `dev`/`build`;
  `pnpm generate-theme:check` is the web `test` gate, so a hand-edited palette fails CI (no
  values duplicated in the app, `09-design-system.md` §3). **Quicksand** loads via
  `next/font/google` in `app/layout.tsx`, mapped to `--font-sans`; the `body` is cream/charcoal.
- Built the web primitives in `apps/web/src/components/ui/` (Button, Chip/FoodChip, Card,
  PriceTile, Field, Input, Avatar, ProgressPill/Badge, Toggle, TabBar) from the theme; the
  restyled RadiusSlider stays at `src/components/radius-slider.tsx` and the Decision card at
  `src/components/swipe-card.tsx`.
- Added the three-destination nav as a Next App Router **`app/(tabs)/` route group** with a
  `tabs-nav.tsx`: a **bottom bar at mobile widths → left side-nav at desktop** inside the
  centered **1200px** `.munch-container`. Welcome → Match root, Discover → "Under Construction"
  placeholder, Profile → auth/history. The room/join/create and `auth/*` routes stay **outside**
  `(tabs)` and present full-screen via `FullScreenView`; the join deep link (`room/join/[code]`)
  still resolves.
- Reskinned every route in `10-pages.md` §3 and replaced the inline `style={}` usages; the only
  remaining inline style is the per-frame swipe drag transform (`swipe-card.tsx`) plus a couple
  of prop-computed dynamic sizes (Card image height, Avatar dimension). Full-screen routes use a
  narrower centered **reading column** (`.munch-column`, 36rem) since a 1200px-wide form/card
  reads poorly; the cream/charcoal palette, Quicksand, and the like/pass-only swipe (no bookmark)
  match the mobile result. Distance is shown in **km** (≥1 km) / **m** (<1 km), as on mobile.

**Exit criteria — met:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` are green
tree-wide; every web route in `10-pages.md` §3 matches its Stitch mockup at both a mobile and a
desktop width and reflows cleanly (bottom bar ↔ side nav, centered container, no overflow); the
join-via-link and the swipe→match / swipe→resolution flows complete in-browser with **one
provider call per session** (the single `start-session` Edge Function; no fetch per swipe) and
the card never declares a match; auth lives on Profile, not Welcome; cuisines come from the
`@munch/core` `CUISINES` taxonomy; no hardcoded palette or `react-native-web` import remains.
Verification (Phase D, web) caught and fixed a Tailwind v4 theming bug — the seeded named
`--spacing-{sm,md,lg,xl}` tokens shadow the `max-w-{sm,md,lg,xl}` t-shirt scale, collapsing
`max-w-xl` to 64px; the page containers now use the var-backed `.munch-container`/`.munch-column`
utilities instead.

---

## 5. Phase D — Verify

**Goal:** green and faithful.

- `pnpm typecheck`, `pnpm lint`, `pnpm build` pass for the whole tree.
- Visual QA: mobile on a simulator and web in a browser, screen-by-screen against the Stitch
  screenshots.
- Confirm no UI change weakened an invariant (no provider call on swipe; no client-side match
  declaration; aggregate-only counts; host-controlled filters) — `09-design-system.md` §9.

**Exit criteria:** CI is green and every screen in `10-pages.md` visually matches its mockup on
both platforms.

---

## 6. Sequencing & dependencies

`A → B → C → D`. Phase A unblocks everything. After A, mobile (B) and web (C) are
independent and could be done in parallel; D follows both.

---

## 7. Constraints carried throughout

- **Presentation only** — no matching/ranking/shuffle logic leaves `@munch/core`; no
  component declares a match or calls the provider (CLAUDE.md §2, §4).
- **No `react-native-web`** — tokens are shared; component implementations stay per-app
  (`09-design-system.md` §3).
- **Scope discipline** — Discover stays a placeholder; the swipe "save/super-like" button is
  dropped; rich cards, dietary filters, and a browse feed remain post-v1 (docs/07 §8).
- **Docs stay in lockstep** — if a token/component/screen changes, update `09-design-system.md`
  / `10-pages.md` in the same change (CLAUDE.md §1).
