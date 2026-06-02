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

## 2. Phase A — Shared token foundation

**Goal:** one platform-agnostic source of truth for the visual language.

- Create `packages/ui` with `tokens.ts` (colors, typography, spacing, radii, shadows from
  `design-system.md` §4–§6). No React Native, no DOM imports. Mirror `@munch/core` packaging
  (source export, no build step).
- Wire it into the pnpm workspace + base tsconfig.

**Exit criteria:** both apps can import `@munch/ui` tokens and typecheck; values match
`design-system.md` exactly.

---

## 3. Phase B — Mobile (Expo / React Native)

**Goal:** the mockups, live on iOS + Android.

- Load **Quicksand** (`expo-font` + `@expo-google-fonts/quicksand`) in `app/_layout.tsx`.
- Repoint `apps/mobile/src/theme/index.ts` at `@munch/ui` (light palette replaces the dark
  placeholder).
- Build RN primitives in `components/ui/` (Button, Chip/FoodChip, Card, PriceTile, Field,
  Avatar, ProgressPill, Toggle, TabBar) per `design-system.md` §7.
- Add the **bottom-tab shell** (Discover · Match · Profile) as an `expo-router` tab group
  (`pages.md` §2).
- Reskin every screen in `pages.md` §3. The existing reanimated/gesture swipe is kept; only
  the Decision Card visuals change. **Drop the swipe bookmark button.**

**Exit criteria:** all mobile screens match the mockups on a simulator; tabs navigate;
the swipe/match/resolution flows still work end-to-end with one provider call per session.

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
