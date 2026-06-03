# Phase C — Web (Next.js): Agent Prompts

**Project:** Munch
**Source:** `docs/ui-roadmap.md` §4 (Phase C) — expands the "UI polish" bullet of
`docs/07-initial-roadmap.md` §6 (Phase 4), layered on the Phase A token foundation and
mirroring the Phase B (mobile) reskin on the browser.
**Purpose:** Phase C broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Prompts 4 and 5 (the screen
reskins) are independent of each other and may be done in either order, but both depend on
Prompts 1–3 and must land before Prompt 6.

**Prepend the shared preamble to every prompt.**

Phase C puts the **"Munch Visual Language"** (`docs/design-system.md`) live in the browser and
makes it reflow cleanly between mobile and desktop. The app is **functionally complete through
Phase 4.5**, the shared tokens shipped in **Phase A** (`@munch/ui`), and **Phase B** already
delivered the same language on iOS + Android. What's missing on web is the *look*: today the
web app has **no Tailwind, no design system, and no brand font** — its routes render **bare
semantic HTML** (e.g. `app/page.tsx` is an `<h1>` + `<nav>` + `<AuthPanel>` with no styling).
This phase is a **reskin, not a rebuild**: every route keeps its existing hooks, endpoints,
realtime wiring, and the pointer-based swipe. No domain logic moves out of `@munch/core`; no
component declares a match or calls the provider (`design-system.md` §9, CLAUDE.md §2/§4).

### Phase C maps to the roadmap bullets + exit criteria (`ui-roadmap.md` §4)

- Add **Tailwind v4** to `apps/web`; seed its theme from `@munch/ui` tokens (CSS custom
  properties / `@theme`); load **Quicksand** via `next/font/google`; set the cream `body`
  background + the centered **1200px** desktop container → Prompt 1
- Mirror the **mobile primitives** as web components (`components/ui/`) → Prompt 2
- Responsive nav: bottom **TabBar** at mobile widths → top/side nav at desktop (`pages.md` §2)
  + the Discover placeholder → Prompt 3
- Replace the remaining inline `style={}` usages; reskin every route in `pages.md`
  → Prompts 4 (entry & account) + 5 (room & session core)
- Exit: all web routes match the mockups and reflow cleanly mobile↔desktop; no inline
  `style={}` left for layout; the join-via-link and session flows work in-browser → Prompt 6

### Decisions locked (from `ui-roadmap.md` §1/§7, do not relitigate)

- Web styling is **Tailwind v4**; its theme is **seeded from `@munch/ui` tokens** (CSS custom
  properties / `@theme`). Tokens live **once** in `@munch/ui` and are **never** re-defined per
  app (`design-system.md` §3) — so the `@theme`/CSS-var values must be **derived from
  `@munch/ui`** (a small generation step that imports the tokens and emits the CSS), not
  hand-copied hex. If any value is written literally, it must be checked against `@munch/ui`.
- **No `react-native-web`.** Component *implementations* are web-native (DOM); they mirror the
  Phase B mobile primitives' **API surface and look**, not their RN code (`design-system.md` §3).
- **Presentation only.** Matching/ranking/shuffle stay in `@munch/core`; the swipe still calls
  `submit_swipe`, "Settle for this"/"Fetch New Deck" still call `resolve_session`, and the card
  never declares a match (server-authoritative, CLAUDE.md §2.3).
- **Drop the swipe "save/super-like" (middle bookmark) button** — v1 is like/pass only; the
  mockup's middle button is intentionally not built (`design-system.md` §8, `ui-roadmap.md` §7).
- **Discover stays a placeholder** ("Under Construction"); a browse feed is post-v1.
- **Distance is shown in km** throughout (matching the Phase B mobile decision; the mockups are
  internally inconsistent on units — `ui-roadmap.md` §3, CLAUDE.md §9). Keep web and mobile
  consistent.
- **Auth is outside-a-room only and lives on the Profile destination**, not on the Welcome/Home
  screen (`pages.md` §2/§3.1/§3.2). The current web home renders `<AuthPanel>` inline; Phase C
  moves it to Profile, matching the mockups and the mobile app.

### What already exists (build on this, don't rebuild)

- `apps/web/package.json` already depends on `@munch/ui`, `@munch/core`, `@munch/api-client`
  (all `workspace:*`), `@tanstack/react-query`, `@supabase/supabase-js`, `qrcode.react`, on
  **Next 16 / React 19**. `apps/web/src/lib/tokens.ts` is the **Phase A import seam only**
  (`export const munchBrand = colors.brand`) — Phase C builds the real theme from `@munch/ui`.
- `next.config.ts` uses **Turbopack** and `transpilePackages: ["@munch/core", "@munch/api-client"]`
  (raw-TS workspace packages). If the theme-generation step or Tailwind needs `@munch/ui`
  transpiled too, add it there.
- `app/layout.tsx` is minimal: `<html><body><Providers>{children}</Providers></body></html>`
  with no font, no `className`, no global CSS. `app/providers.tsx` wraps the
  `QueryClientProvider`. **There is no `globals.css`, no Tailwind/PostCSS config, and no
  `next/font` usage yet** — Prompt 1 adds them.
- Routes (existing — keep their paths/params): `app/page.tsx` (Welcome/Home),
  `app/history/page.tsx`, `app/room/create/page.tsx`, `app/room/join/page.tsx` +
  `app/room/join/[code]/page.tsx` (link/QR target — must keep working),
  `app/room/[roomId]/{lobby,session,result}/page.tsx`, `app/auth/callback/page.tsx`
  (web OAuth return), `app/auth/reset/page.tsx`.
- `src/components/` holds **functional** pieces: `filters-fieldset.tsx`, `filters-summary.tsx`,
  `radius-slider.tsx`, `swipe-card.tsx` (these get **restyled**, not duplicated). There is **no
  `components/ui/` primitive library yet** — Prompt 2 creates it.
- `src/features/{auth,room,session,history}/` mirror the mobile feature folders and hold the
  view components the routes render (`auth-panel`, `lobby-view`, `member-list`, `invite-panel`,
  `session-view`, `result-view`, `resolution-view`, `history-view`, the create/join forms, plus
  their hooks). Reskin these; leave their hooks/data wiring untouched.
- Only three files currently use inline `style={}` (`features/history/history-view.tsx`,
  `features/session/result-view.tsx`, `components/swipe-card.tsx`) — the rest is unstyled
  semantic HTML, so most of the reskin is **adding** Tailwind-class structure, not replacing CSS.

**Exit check (after all 6):** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` are
green tree-wide; the web app serves the cream/charcoal palette with Quicksand and a centered
1200px desktop container; the three destinations (Discover · Match · Profile) navigate, as a
bottom bar at mobile widths and a top/side nav at desktop; every route in `pages.md` §3 visually
matches its Stitch mockup and reflows cleanly mobile↔desktop; the join-via-link and
swipe→match / swipe→resolution flows complete in-browser with **one provider call per session**
and the card never declares a match; the swipe bookmark button is gone; no inline `style={}`
remains for layout; and `design-system.md`/`pages.md`/`ui-roadmap.md` describe the web app as
shipped.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and, for this phase, docs/design-system.md (§3 platform mapping/packaging,
  §4 color, §5 typography, §6 spacing/radii/elevation, §7 primitives, §8 Munch-specific patterns,
  §9 invariants, §10 a11y), docs/pages.md (the screen inventory + per-page invariants, esp. §2
  navigation shell and §4 cross-cutting states), and docs/ui-roadmap.md (§4 Phase C, §7
  constraints).
- This is Phase C (Web reskin) of the UI work. The app is FUNCTIONALLY COMPLETE through Phase 4.5,
  the shared tokens shipped in Phase A (@munch/ui), and Phase B already reskinned the mobile app.
  This phase is a RESKIN, NOT A REBUILD and is PRESENTATION-ONLY: do not change any domain logic,
  endpoint, RPC, realtime wiring, hook, or screen behavior. Keep the existing pointer swipe; only
  its visuals change. No component declares a match or calls the provider; matching/ranking/shuffle
  stay in @munch/core (design-system.md §9, CLAUDE.md §2/§4).
- Consume tokens from @munch/ui. The Tailwind v4 theme is SEEDED FROM @munch/ui (CSS custom
  properties / @theme) — NEVER hardcode a hex/size that a token already defines, and NEVER
  re-define the palette in the app (design-system.md §3). Use the SEMANTIC ROLES (brand, heat,
  surface, text, …), not raw hex. Where a literal value is unavoidable in CSS, it must be derived
  from / checked against @munch/ui.
- The mockups are the Stitch "Munch Visual Language" screens (titles match pages.md §3). Where a
  mockup and the docs disagree, the docs win — specifically: build like/pass only and DROP the
  swipe middle bookmark button (design-system.md §8); use three destinations Discover·Match·Profile
  (pages.md §2) regardless of any single mockup's bar; show distance in km; auth lives on Profile,
  not the Welcome/Home screen (pages.md §2/§3.1). Match the Phase B mobile result where the mockup
  is silent.
- Files kebab-case.ts; React components PascalCase.tsx. TypeScript strict; no `any`; no
  react-native-web. Make the smallest change that satisfies the task.
- When done, run the stated acceptance checks and report their ACTUAL output. Commit straight to
  main (this repo's convention) with a Conventional Commit; update any doc you contradict in the
  same change (CLAUDE.md §1).
```

---

## Prompt 1 — Tailwind v4 + Quicksand + theme seeded from `@munch/ui` (cream canvas, 1200px container)

```
Goal: stand up the web visual foundation — Tailwind v4 with a theme SEEDED FROM @munch/ui tokens,
the Quicksand brand font, the cream body background, and the centered 1200px desktop container —
so every route inherits the Munch look. No route is visually polished yet; after this, the app
serves the brand palette and font and the gates stay green. Reference: docs/design-system.md §3
(platform mapping: web seeds Tailwind @theme from @munch/ui), §4 color, §5 typography, §6
spacing/radii/elevation; ui-roadmap.md §4.

Deliver:
- apps/web/package.json: add Tailwind v4 + its PostCSS plugin (tailwindcss, @tailwindcss/postcss)
  as dev deps; ensure the brand font loads via next/font/google (no extra dep needed).
- A theme that DERIVES from @munch/ui — do NOT hand-copy hex/sizes. Preferred: a tiny generation
  step (e.g. apps/web/scripts/generate-theme.ts) that imports @munch/ui and emits a CSS file with
  Tailwind v4 `@theme` custom properties (--color-brand, --color-heat, --color-surface, …, plus
  spacing/radii and the type scale), wired so the theme is regenerated as part of dev/build. If
  @munch/ui must be transpiled for that step, add it to transpilePackages in next.config.ts. (If
  you instead author the @theme block by hand, add a check/test that every value equals its
  @munch/ui counterpart — single source of truth is non-negotiable, design-system.md §3.)
- apps/web/app/globals.css: `@import "tailwindcss";` + the generated/seeded @theme; set the cream
  background (--color-background) and charcoal text on the body; map Quicksand as the default font
  family; define the type scale (display-lg / display-lg-mobile / headline-md / title-lg / body-lg
  / body-md / label-md / caption) and radii (full pill, xl cards) as theme tokens/utilities.
- app/layout.tsx: load Quicksand via next/font/google (weights 500, 600, 700; expose it as a CSS
  variable on <html>/<body>), import globals.css, and apply the cream body + font. Keep <Providers>
  exactly as-is.
- Establish the centered desktop container convention (max-width 1200px, 48px margins,
  design-system.md §6) as a reusable layout utility/class for later prompts to apply — do not yet
  restructure individual pages beyond making the body/container styles available.

Done when: `pnpm --filter @munch/web typecheck`, lint, and `pnpm --filter @munch/web build` pass;
running the web app shows a cream background with charcoal Quicksand text and Tailwind utilities
working; the theme values come from @munch/ui (no duplicated palette — verify the generation/check
step); no route's content/markup was restructured yet. Report the build result and how the theme
is seeded from @munch/ui.
```

---

## Prompt 2 — Build the web UI primitive library (`components/ui/`)

```
Goal: build the reusable, business-logic-free WEB primitives the route reskins compose, all from
the Tailwind theme (which is seeded from @munch/ui). Primitives hold NO data and read NO hooks
(CLAUDE.md §4). They mirror the Phase B mobile primitives' API and look, implemented for the DOM.
Reference: docs/design-system.md §7 (primitives), §6 (radii/elevation/press affordance), §10
(focus-visible, 44px targets, reduced-motion); pages.md (where each is used); the Phase B mobile
primitives in apps/mobile/src/components/ui/ for parity of variants/props. Depends on Prompt 1.

Deliver in apps/web/src/components/ui/ (PascalCase components in kebab-case files):
- Button — pill (radius full). Variants: primary (brand fill, on-brand charcoal text), secondary
  (heat fill, on-heat white), ghost/outline (border, transparent), social (white, provider logo
  slot + label). States: default / hover (brandPressed) / pressed (apply the 2px press translate)
  / disabled / loading (spinner). focus-visible ring; min 44px target.
- Chip / FoodChip — cuisine + tag pills. Unselected: cream fill, border outline, muted text.
  Selected: solid heat fill, on-heat text. Selection is a prop; the closed CUISINES taxonomy is
  supplied by the caller — do not hardcode cuisines here.
- Card — radius xl, shadow-low, white surface, 24px padding (a padding prop so the Decision card
  can use 32px). Optional image header with a bottom-inner legibility shadow for overlaid white text.
- PriceTile / SegmentedTile — selectable $-$$$$ tiles; selected = brand fill.
- Field / Input — pill or radius-md; 2px amber border + soft amber outer glow on focus; faint
  placeholder. (Restyle the look; mirror the mobile Field/Input API.)
- Avatar — circular; optional `online` presence dot; a "+" variant for "Invite more".
- ProgressPill / Badge — small caption pills ("Waiting…", "1.2 km", "4.8 ★", "(4/8)"); the rating
  star uses brand amber.
- Toggle — the "bite-out-of-a-circle" custom selection mark when on.
- TabBar — the responsive nav presentation primitive (icon + label, active item amber). Pure
  presentation; it must support BOTH a bottom-bar layout (mobile widths) and a top/side layout
  (desktop) via props/classes — the actual routing wiring is Prompt 3.
- Restyle the EXISTING src/components/radius-slider.tsx to §7 (amber thumb + amber value pill).
  Leave swipe-card.tsx for Prompt 5.

Respect reduced-motion for any press/scale animation and provide focus-visible states
(design-system.md §10). Export everything from a barrel (components/ui/index.ts). Add no new
state library and no react-native-web.

Done when: typecheck/lint/build pass; each primitive renders matching design-system.md §7 (verify
a few on a scratch page, then remove it); primitives import only Tailwind classes/theme + React,
no feature code and no @munch/core domain logic; variant/prop parity with the Phase B mobile
primitives is preserved.
```

---

## Prompt 3 — Responsive nav shell (Discover · Match · Profile) + Discover placeholder

```
Goal: introduce the three-destination navigation shell from pages.md §2 using the TabBar
primitive and a Next App Router layout — a BOTTOM BAR at mobile widths that becomes a TOP/SIDE
nav at desktop (≥1200px container) — and add the Discover "Under Construction" placeholder. Room
flow and auth routes continue to present FULL-SCREEN (no nav chrome). All existing routes
(including the deep link room/join/[code]) keep working. Reference: pages.md §2 (navigation shell
+ tab→destination table) and §3.9 (Discover); design-system.md §6 (responsive nav, 1200px
container) and §7 (TabBar). Depends on Prompts 1–2.

Destination → route (pages.md §2):
- Discover → the placeholder page (§3.9), post-v1 feed.
- Match → the room-flow entry: the Welcome/Home page (app/page.tsx); Create/Join link from it;
  lobby/session/result present full-screen above the shell.
- Profile → auth (signed-out) or account + history (signed-in); the history route lives here.

Deliver:
- Add a Next App Router ROUTE GROUP (e.g. app/(tabs)/) with a layout.tsx that renders the
  responsive nav (TabBar primitive: bottom bar on mobile → top/side at desktop) and the centered
  1200px container, and move the three destinations under it WITHOUT changing what they render:
  - Welcome/Home (currently app/page.tsx) → the Match tab root.
  - Discover → a NEW placeholder page ("Under Construction", decorative amber/heat circles,
    "We're cooking up something special.") per pages.md §3.9 — styled coming-soon state, no data.
  - Profile → the account/history destination (the existing history route moves here; auth lives
    here too — see Prompt 4).
- KEEP app/room/[roomId]/* , app/room/join/* , app/room/create , and app/auth/* OUTSIDE the (tabs)
  group so they render full-screen without the nav chrome (mirror the mobile shell). Preserve every
  route path and param name; the join deep link (room/join/[code]) must still resolve.
- Active destination uses brand amber; three destinations regardless of any single mockup that
  shows two. Keep app/providers.tsx (QueryClientProvider) wrapping the whole tree.

Done when: typecheck/lint/build pass; in a browser the nav renders as a bottom bar at narrow
widths and a top/side nav at desktop, switching between Discover (placeholder), Match (Welcome),
and Profile; creating/joining a room and the join deep link still navigate correctly; room/auth
routes render full-screen with no nav chrome; no hook or endpoint changed. Report the navigation
+ reflow result.
```

---

## Prompt 4 — Reskin the entry & account routes (Welcome, Join, Create Room, Auth/Profile, History)

```
Goal: reskin the non-room routes to their mockups using the Prompt-2 primitives, leaving all
hooks/endpoints/validation untouched, and reflow each cleanly mobile↔desktop. Define each route's
loading/empty/error states with the primitives (pages.md §4). Reference: pages.md §3.1 (Welcome),
§3.2 (Auth/Profile + History), §3.3 (Create Room), §3.4 (Join), §4 (cross-cutting states);
design-system.md §4–§8; the Stitch mockups "Welcome to Munch", "Join with Name and Code",
"Create a Room", "Profile & Sign In Updated". Depends on Prompts 1–3. Independent of Prompt 5.

Deliver (reskin the route + its feature view component; do not change wiring):
- Welcome (app/page.tsx): "Ready to eat?" header; a large amber "Create a Room" Card (with the +
  glyph, "Host a session and invite your crew"); a cream "Join with Code" Card with a Field +
  burnt-orange (secondary) Join Button; the "How Munch Works" 3-step list with colored circular
  icon rows. MOVE <AuthPanel> off this page — auth now lives on Profile (pages.md §2/§3.1). Wiring:
  Create → create flow, Join → join_room (unchanged).
- Join (room/join/page.tsx + [code]/page.tsx): name Field + 6-digit code Field (code prefilled
  from the deep link/QR when present); Join Button. Map join_room errors (ROOM_NOT_FOUND,
  ROOM_CLOSED, ALREADY_JOINED, RATE_LIMITED) to friendly inline messages (docs/04 §3.2) — never
  raw error text.
- Create Room (room/create/page.tsx + features/room/create-room-form): location Field (with locate
  affordance), cuisine FoodChips (closed CUISINES taxonomy from @munch/core — do not invent
  cuisines), PriceTiles ($-$$$$), the restyled RadiusSlider, amber "Start Room" Button. Filters are
  HOST-CONTROLLED for the room (invariant §2.2) — keep that semantics; this is visual only.
- Auth / Profile (features/auth/auth-panel, the Profile destination, app/auth/callback +
  app/auth/reset): "Sign in to save your history"; a `social` "Continue with Google" Button; OR
  divider; email + password Fields; "Remember me" Toggle + "Forgot"; amber "Sign In"; "Create an
  account" link. Signed-in: Avatar + account + entry to history. Guests see the empty/"sign in to
  save" state, never an error (pages.md §3.2 invariant). Reskin the callback/reset views to match.
- History (history route / features/history/history-view): list styled with Card/Badge primitives;
  REPLACE its inline style={} with Tailwind classes; guest empty state = the "sign in to save"
  state (docs/04 §3.11), not an error.
- Each route: loading = skeletons/spinners in card shapes (no layout shift); errors mapped from
  {error:{code,message}} (pages.md §4); centered 1200px container at desktop, full-width at mobile.

Done when: typecheck/lint/build pass; in a browser each of these routes matches its mockup and
reflows mobile↔desktop; the create/join/auth/history flows still call the same RPCs with the same
payloads (no wiring changed); auth no longer appears on Welcome; cuisines come from the @munch/core
taxonomy; no raw provider/DB error is shown and no inline style={} remains on these routes.
```

---

## Prompt 5 — Reskin the room & session core (Lobby, Swiping Session, Match, Host Resolution)

```
Goal: reskin the product core to its mockups while PRESERVING the pointer swipe, the realtime
wiring, and every §2/§3 invariant, reflowing cleanly mobile↔desktop. This is the highest-risk
reskin — treat the invariants as load-bearing. Reference: pages.md §3.5 (Lobby), §3.6 (Session),
§3.7 (Match), §3.8 (Host Resolution), §4; design-system.md §8 (Decision Card, swipe action row,
Match reveal, Host resolution, Squad list), §9 (UI invariants), §10 (reduced-motion); the Stitch
mockups "Lobby with QR Code", "Swiping Session", "It's a Match!", "Host Resolution". Depends on
Prompts 1–3. Independent of Prompt 4.

Deliver (reskin the route + feature view + the noted components; keep wiring):
- Lobby (room/[roomId]/lobby/page.tsx, features/room/lobby-view, member-list, invite-panel):
  "Waiting for the crew" header; an amber Card with the room code + QR (qrcode.react) + "Tap to
  copy link"; "The Squad (N/M)" with Avatars (green `online` presence dots) + an "Invite more" `+`
  Avatar tile; a "Waiting…" ProgressPill; host-only amber "Start Session" Button. Realtime
  presence, start_session, set_presence wiring unchanged; only the host can start; AGGREGATE
  presence only (no per-member status text — v1, design-system.md §8).
- Swiping Session (room/[roomId]/session/page.tsx, components/swipe-card.tsx): restyle the Decision
  Card — image header with a distance ProgressPill overlay (km), restaurant name (title-lg), a
  "4.8 ★" rating Chip, a "$$ • Japanese, Seafood" line, decorative FoodChips; a header
  filter/"Adjust" affordance. Action row = pass (neutral surface-highest circle, ✕) and like
  (amber circle, ♥) ONLY — DROP the middle bookmark button. KEEP the existing pointer/drag swipe +
  the button fallback; both call the SAME handlers; REPLACE swipe-card's inline style={} with
  Tailwind/theme styling (the dynamic drag transform may stay inline as it is computed per-frame).
  Each swipe → submit_swipe; NO provider call on swipe (§2.1); the card NEVER declares a match
  (server-authoritative, §2.3); realtime session status + AGGREGATE progress drive transitions.
  Respect reduced-motion for the throw.
- Match (room/[roomId]/result/page.tsx, features/session/result-view): confetti (reduced-motion
  aware), "It's a Match!" badge + "Everyone agreed!", a full-bleed photo Card with overlaid tag
  Chips + name + "1.2 km away • $$" + rating; amber "Get Directions" Button (external maps deep
  link — NO provider call) and an outline "Share Match" Button (Web Share API / copy fallback).
  Uses the match payload we already hold (§3.7 invariant). REPLACE its inline style={}.
- Host Resolution (features/session/resolution-view, shown when status =
  awaiting_host_resolution): "No Unanimous Match Yet"; a "Group's Top Pick" Decision Card; an
  AGGREGATE "N/M friends liked this" ProgressPill (count only — NEVER which member liked/passed;
  any avatars are decorative); amber "Settle for this" Button; a "Widen the Search" block (Search
  Radius RadiusSlider bounded to the host's anchor + cuisine FoodChips from the CUISINES taxonomy +
  amber "Fetch New Deck"). Wiring: get_resolution_ranking, resolve_session accept_top/widen
  unchanged. Ranking is CLOSEST-TO-UNANIMOUS (fewest passes → rating → distance, §2.4) — display
  it, do not re-sort. Non-host members see the passive "waiting on host" state. Widen makes EXACTLY
  ONE extra provider fetch (§2.1).

Done when: typecheck/lint/test/build pass; in a browser each screen matches its mockup and reflows
mobile↔desktop; a full run (lobby → swipe → match) and a no-match run (→ resolution → settle/widen)
complete with ONE provider call per session (verify no fetch fires per swipe); the bookmark button
is gone; only the host can start/resolve; all displayed counts are aggregate; no inline style={}
remains except the per-frame drag transform. Report the end-to-end result.
```

---

## Prompt 6 — Phase C exit verification + doc reconciliation

```
Goal: verify Phase C's exit criteria, confirm no invariant was weakened by the reskin and that the
web matches both the mockups and the Phase B mobile result, and reconcile any doc/code drift so
the phase closes green and the docs match reality (CLAUDE.md §1). Reference: ui-roadmap.md §4
(Phase C exit) + §5 (Phase D verify checklist as the standard); design-system.md §9 (invariants);
pages.md §2–§4 (nav shell, per-screen expectations, cross-cutting states). Depends on Prompts 1–5.

Deliver:
- Run the full gate and report ACTUAL output: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build` (whole tree).
- Visual QA in a browser, screen-by-screen against the Stitch mockups (Welcome, Join, Create Room,
  Auth/Profile, History, Lobby, Session, Match, Host Resolution, Discover) AT BOTH a mobile width
  and a desktop width — confirm clean reflow (bottom bar → top/side nav; centered 1200px container;
  no overflow/layout shift). Note any deviation and fix or file it explicitly. Confirm Quicksand is
  loaded and the palette is the cream/charcoal light theme.
- Token-discipline audit: grep apps/web for hardcoded hex colors and ad-hoc font sizes, and for
  inline `style={}` (confirm none remains for layout — only the per-frame swipe drag transform is
  allowed); confirm the Tailwind theme is seeded from @munch/ui with no palette re-defined in the
  app and no react-native-web import.
- Invariant check (presentation-only, design-system.md §9): confirm NO provider call on swipe and
  exactly one provider fetch per session/widen; the card never declares a match (server-
  authoritative); all progress/resolution counts are AGGREGATE (no per-member swipe disclosure);
  filters are host-controlled; cuisines come from the @munch/core CUISINES taxonomy; the swipe
  bookmark button is dropped; only the host can start/resolve; the join-via-link flow works
  in-browser. No domain logic left @munch/core.
- Doc reconciliation: update ui-roadmap.md so Phase C reads as delivered (its exit criteria met);
  reconcile pages.md / design-system.md with anything that shipped differently (e.g. a primitive
  name, the responsive nav structure, a state). Keep edits minimal and factual.

Done when: all four gate commands are green tree-wide; every route in pages.md §3 visually matches
its mockup at both widths and reflows cleanly; the audits find no hardcoded palette, no leftover
inline style={} for layout, no weakened invariant, and one provider call per session; and the docs
describe the web app as it now exists. Report the command output, the browser QA notes (mobile +
desktop), and the exact files changed.
```
