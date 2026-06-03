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
`design-system.md`) onto the existing screens (`pages.md`) without changing any domain logic,
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
  `design-system.md` §4–§6). No React Native, no DOM imports, no runtime dependency. Mirrors
  `@munch/core` packaging (source export, no build step).
- Wired into the pnpm workspace via `"@munch/ui": "workspace:*"` in both apps (the `packages/*`
  glob and symlink resolution; `tsconfig.base.json` needs no `paths` map).

**Exit criteria — met:** both apps import `@munch/ui` tokens and typecheck (the import seams in
`apps/mobile/src/theme/index.ts` and `apps/web/src/lib/tokens.ts`); token values match
`design-system.md` §4–§6 exactly; `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` are
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
  `design-system.md` §7. The restyled functional pieces (`swipe-card`, `member-list`,
  `invite-panel`, `filters-fieldset`, `filters-summary`) live in `components/`.
- Added the **bottom-tab shell** (Discover · Match · Profile) as an `expo-router` `(tabs)`
  group (`pages.md` §2); the room/join routes still present full-screen above the tabs and the
  join deep link still resolves.
- Reskinned every screen in `pages.md` §3. The existing reanimated/gesture swipe is kept; only
  the Decision Card visuals changed. The swipe bookmark button is dropped (like/pass only).

**Exit criteria — met:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` are green
tree-wide; the app uses the cream/charcoal light theme with Quicksand; the three tabs navigate;
every screen in `pages.md` §3 matches its Stitch mockup; the swipe/match/resolution flows keep
their wiring (a swipe calls `submit_swipe`, resolution calls `resolve_session`) with one
provider call per session and the card never declares a match; no hardcoded palette, ad-hoc
font size, or `react-native-web` import remains in the app. Distance is displayed in **km**
throughout (session/match/resolution); the Stitch mockups are internally inconsistent on units
(the radius slider shows km, the cards show mi), so the app standardized on km — revisit if a
US-imperial launch is decided (open, see CLAUDE.md §9).

---

## 4. Phase C — Web (Next.js)

**Goal:** the same language on the browser, responsive to desktop.

- Add **Tailwind v4** to `apps/web`; seed its theme from `@munch/ui` tokens (CSS custom
  properties / `@theme`). Load **Quicksand** via `next/font/google`. Set the cream `body`
  background and the centered **1200px** desktop container (`design-system.md` §6).
- Mirror the mobile primitives as web components.
- Replace the remaining inline `style={}` usages; reskin every route in `pages.md`.
- Responsive nav: bottom TabBar at mobile widths → top/side nav at desktop.

**Exit criteria:** all web routes match the mockups and reflow cleanly mobile↔desktop;
no inline `style={}` left for layout; the join-via-link and session flows work in-browser.

---

## 5. Phase D — Verify

**Goal:** green and faithful.

- `pnpm typecheck`, `pnpm lint`, `pnpm build` pass for the whole tree.
- Visual QA: mobile on a simulator and web in a browser, screen-by-screen against the Stitch
  screenshots.
- Confirm no UI change weakened an invariant (no provider call on swipe; no client-side match
  declaration; aggregate-only counts; host-controlled filters) — `design-system.md` §9.

**Exit criteria:** CI is green and every screen in `pages.md` visually matches its mockup on
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
  (`design-system.md` §3).
- **Scope discipline** — Discover stays a placeholder; the swipe "save/super-like" button is
  dropped; rich cards, dietary filters, and a browse feed remain post-v1 (docs/07 §8).
- **Docs stay in lockstep** — if a token/component/screen changes, update `design-system.md`
  / `pages.md` in the same change (CLAUDE.md §1).
