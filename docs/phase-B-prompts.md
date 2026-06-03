# Phase B — Mobile (Expo / React Native): Agent Prompts

**Project:** Munch
**Source:** `docs/ui-roadmap.md` §3 (Phase B) — expands the "UI polish" bullet of
`docs/07-initial-roadmap.md` §6 (Phase 4), layered on the Phase A token foundation.
**Purpose:** Phase B broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Prompts 4 and 5 (the screen
reskins) are independent of each other and may be done in either order, but both depend on
Prompts 1–3 and must land before Prompt 6.

**Prepend the shared preamble to every prompt.**

Phase B puts the **"Munch Visual Language"** (`docs/design-system.md`) live on iOS + Android.
The app is **functionally complete through Phase 4.5** and the shared tokens shipped in
**Phase A** (`@munch/ui`); what's missing on mobile is the *look* — today the app loads no
brand font, runs a **dark Phase-0 placeholder theme**, and has no primitive library or tab
shell. This phase is a **reskin, not a rebuild**: every screen keeps its existing hooks,
endpoints, realtime wiring, and the reanimated/gesture swipe. No domain logic moves out of
`@munch/core`; no component declares a match or calls the provider (`design-system.md` §9,
CLAUDE.md §2/§4).

### Phase B maps to the roadmap bullets + exit criteria (`ui-roadmap.md` §3)

- Load **Quicksand** (`expo-font` + `@expo-google-fonts/quicksand`) in `app/_layout.tsx`
  → Prompt 1
- Repoint `apps/mobile/src/theme/index.ts` at `@munch/ui` (light palette replaces the dark
  placeholder) → Prompt 1
- Build the RN primitives in `components/ui/` (Button, Chip/FoodChip, Card, PriceTile, Field,
  Avatar, ProgressPill, Toggle, TabBar) per `design-system.md` §7 → Prompt 2
- Add the **bottom-tab shell** (Discover · Match · Profile) as an `expo-router` tab group
  (`pages.md` §2) → Prompt 3
- Reskin every screen in `pages.md` §3; keep the existing swipe; **drop the bookmark button**
  → Prompts 4 (entry & account) + 5 (room & session core)
- Exit: all mobile screens match the mockups on a simulator; tabs navigate; the
  swipe/match/resolution flows still work end-to-end with one provider call per session
  → Prompt 6

### Decisions locked (from `ui-roadmap.md` §1/§7, do not relitigate)

- Tokens live **once** in **`@munch/ui`** and are **never** re-defined per app. Mobile *adapts*
  them for React Native (StyleSheet, shadow props/elevation, `fontFamily`) — it does not copy
  the values (`design-system.md` §3).
- **No `react-native-web`.** Component *implementations* are mobile-native here; web is Phase C.
- **Presentation only.** Matching/ranking/shuffle stay in `@munch/core`; the swipe still calls
  `submit_swipe`, "Settle for this"/"Fetch New Deck" still call `resolve_session`, and the
  card never declares a match (server-authoritative, CLAUDE.md §2.3).
- **Drop the swipe "save/super-like" (middle bookmark) button** — v1 is like/pass only; the
  mockup's middle button is intentionally not built (`design-system.md` §8, `ui-roadmap.md`
  §7, docs/07 §8).
- **Discover stays a placeholder** ("Under Construction"); a browse feed is post-v1.

### What already exists (build on this, don't rebuild)

- `apps/mobile/src/theme/index.ts` exports a **dark Phase-0 placeholder** palette
  (`background #0f172a`, `text #f8fafc`, `accent`, `danger`, …) plus the Phase-A seam
  `munchBrand = colors.brand`. Phase B **replaces the placeholder** with an adapter over
  `@munch/ui`; existing consumers of the old keys must be migrated in the same change.
- `app/_layout.tsx` wraps the app in `GestureHandlerRootView` + `QueryClientProvider` and
  renders a single `<Stack screenOptions={{ headerShown:false }}>` with `StatusBar style="light"`.
  Phase B loads fonts here, sets the status bar to **dark content on cream**, and (Prompt 3)
  introduces the tab group.
- Routes (existing, keep their paths/params): `app/index.tsx` (Welcome), `app/history.tsx`,
  `app/room/create.tsx`, `app/auth/reset.tsx`, `app/room/[roomId]/lobby.tsx`,
  `app/room/[roomId]/session.tsx`, `app/room/[roomId]/result.tsx`,
  `app/room/join/index.tsx`, `app/room/join/[code].tsx` (deep link — must keep working).
- `src/components/ui/` already holds **functional** pieces: `field.tsx`, `radius-slider.tsx`,
  `swipe-card.tsx`, `member-list.tsx`, `invite-panel.tsx`, `filters-fieldset.tsx`,
  `filters-summary.tsx`. These get **restyled** (Field/RadiusSlider/SwipeCard as primitives;
  the rest as feature components during the screen reskins) — not duplicated.
- `src/features/{room,auth,history,session}/` hold the screen view components the routes
  render; reskin these, leave their hooks/data wiring untouched.
- Auth surface is **outside-a-room only** (`pages.md` §3.2; docs/04 §2): no mid-room sign-in.

**Exit check (after all 6):** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` are
green tree-wide; the app boots on an iOS simulator with Quicksand loaded and the cream/charcoal
palette; the bottom tabs (Discover · Match · Profile) navigate; every screen in `pages.md` §3
visually matches its Stitch mockup; the swipe → match and swipe → resolution flows complete with
**one provider call per session** and the card never declares a match; the swipe bookmark button
is gone; `design-system.md`/`pages.md`/`ui-roadmap.md` describe the app as shipped.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and, for this phase, docs/design-system.md (§4 color, §5 typography,
  §6 spacing/radii/elevation, §7 primitives, §8 Munch-specific patterns, §9 invariants,
  §10 a11y), docs/pages.md (the screen inventory + per-page invariants), and
  docs/ui-roadmap.md (§3 Phase B, §7 constraints).
- This is Phase B (Mobile reskin) of the UI work. The app is FUNCTIONALLY COMPLETE through
  Phase 4.5 and the shared tokens shipped in Phase A (@munch/ui). This phase is a RESKIN,
  NOT A REBUILD and is PRESENTATION-ONLY: do not change any domain logic, endpoint, RPC,
  realtime wiring, hook, or screen behavior. Keep the existing reanimated/gesture swipe; only
  its visuals change. No component declares a match or calls the provider; matching/ranking/
  shuffle stay in @munch/core (design-system.md §9, CLAUDE.md §2/§4).
- Consume tokens from @munch/ui via the mobile theme adapter (apps/mobile/src/theme). NEVER
  hardcode a hex/size that a token already defines, and NEVER re-define the palette in the app
  (design-system.md §3). Use the SEMANTIC ROLES (brand, heat, surface, text, …), not raw hex.
- The mockups are the Stitch "Munch Visual Language" screens (titles match pages.md §3). Where
  a mockup and the docs disagree, the docs win — specifically: build like/pass only and DROP
  the swipe middle bookmark button (design-system.md §8); use three tabs Discover·Match·Profile
  (pages.md §2) regardless of any single mockup's bar.
- Files kebab-case.ts; React components PascalCase.tsx. TypeScript strict; no `any`; no
  react-native-web. Make the smallest change that satisfies the task.
- When done, run the stated acceptance checks and report their ACTUAL output. Commit straight
  to main (this repo's convention) with a Conventional Commit; update any doc you contradict
  in the same change (CLAUDE.md §1).
```

---

## Prompt 1 — Brand font + mobile theme migration (dark placeholder → cream light theme)

```
Goal: load Quicksand app-wide and replace the dark Phase-0 placeholder theme with a React
Native adapter over @munch/ui's light palette, so every screen inherits the cream/charcoal
Munch look. This is the foundation the primitives and reskins build on. No screen is visually
polished yet — but after this, screens render in the brand palette and font without crashing.
Reference: docs/design-system.md §3 (platform mapping: mobile re-exports @munch/ui via
StyleSheet), §4 color, §5 typography, §6 spacing/radii/elevation; ui-roadmap.md §3.

Deliver:
- apps/mobile/package.json: add "expo-font" and "@expo-google-fonts/quicksand" (versions
  compatible with the pinned Expo SDK — use `npx expo install` so the SDK picks them).
- app/_layout.tsx: load Quicksand_500Medium, _600SemiBold, _700Bold via useFonts; gate first
  render until fonts are ready (return null / a splash while loading). Change
  StatusBar style to "dark" (charcoal content over the cream background). Keep
  GestureHandlerRootView and QueryClientProvider exactly as they are.
- apps/mobile/src/theme/index.ts: REMOVE the dark placeholder (background #0f172a, accent,
  danger, etc.) and the standalone munchBrand seam. Export a theme adapter built FROM @munch/ui:
  - `colors` = re-export of @munch/ui colors (semantic roles).
  - `spacing`, `radii` = re-export of @munch/ui spacing/radii.
  - `typography` = the 8 styles mapped to RN text style objects, each carrying the right
    Quicksand fontFamily for its weight (500→Quicksand_500Medium, 600→_600SemiBold,
    700→_700Bold), fontSize, lineHeight resolved to px (multiplier × fontSize), and
    letterSpacing converted from em to px where specified.
  - a `shadow(level)` helper mapping shadow-low/shadow-active to RN shadowColor/shadowOpacity/
    shadowRadius/shadowOffset (+ a matching Android `elevation`), and a `pressTranslateY`
    constant. Do NOT invent new token values; derive everything from @munch/ui.
- Migrate every existing consumer of the old theme keys (search the mobile app for theme
  imports and for `accent`/`danger`/the old color names) to the new semantic roles so the tree
  typechecks. This is a mechanical color/role swap, not a redesign — leave layout/markup alone;
  per-screen polish lands in Prompts 4–5.

Done when: `pnpm --filter @munch/mobile typecheck` and `pnpm --filter @munch/mobile lint`
pass; the app boots on an iOS simulator with Quicksand visibly loaded and a cream background
with charcoal text; no reference to the old dark palette keys remains; theme values are all
sourced from @munch/ui (no duplicated hex/sizes). Report the simulator boot result.
```

---

## Prompt 2 — Build the RN UI primitive library (`components/ui/`)

```
Goal: build the reusable, business-logic-free RN primitives the screen reskins compose, all
from the theme adapter. Primitives hold NO data and read NO hooks (CLAUDE.md §4).
Reference: docs/design-system.md §7 (primitives), §6 (radii/elevation/press affordance),
§10 (44px targets, focus/reduced-motion); pages.md (where each is used). Depends on Prompt 1.

Deliver in apps/mobile/src/components/ui/ (PascalCase components in kebab-case files):
- Button — pill (radius full). Variants: primary (brand fill, on-brand charcoal text),
  secondary (heat fill, on-heat white), ghost/outline (border, transparent), social (white,
  provider logo slot + label). States: default / pressed (apply pressTranslateY + brandPressed)
  / disabled / loading (spinner). Min 44px touch target.
- Chip / FoodChip — cuisine + tag pills. Unselected: cream fill, border outline, muted text.
  Selected: solid heat fill, on-heat text. (Selection state is a prop; the closed CUISINES
  taxonomy is supplied by the caller — do not hardcode cuisines here.)
- Card — radius xl, shadow-low, surface white, 24px padding (expose a `padded`/`tight` or a
  padding prop so the Decision card can use 32px). Optional image header with a bottom-inner
  legibility shadow for overlaid white text.
- PriceTile / SegmentedTile — selectable $-$$$$ tiles; selected = brand fill.
- Avatar — circular; optional `online` presence dot; a "+" variant for "Invite more".
- ProgressPill / Badge — small caption pills ("Waiting…", "1.2 mi", "4.8 ★", "(4/8)");
  the rating star uses brand amber.
- Toggle — the "bite-out-of-a-circle" custom selection mark when on.
- TabBar — the bottom-bar presentation primitive (icon + label, active item amber). Pure
  presentation; the actual navigation wiring is Prompt 3.
- Restyle the EXISTING field.tsx and radius-slider.tsx to match §7 (Field: pill/radius-md,
  2px amber border + soft amber glow on focus, faint placeholder; RadiusSlider: amber thumb +
  amber value pill). Leave swipe-card.tsx for Prompt 5.

Respect reduced-motion for any press/scale animation (design-system.md §10). Export everything
from a barrel (e.g. components/ui/index.ts). Add no new state library.

Done when: `pnpm --filter @munch/mobile typecheck` and lint pass; each primitive renders in
isolation matching design-system.md §7 (verify a couple on a simulator or a scratch screen,
then remove the scratch); primitives import only the theme adapter + react-native, no feature
code, no @munch/core domain logic.
```

---

## Prompt 3 — Bottom-tab navigation shell (Discover · Match · Profile) + Discover placeholder

```
Goal: introduce the three-destination bottom-tab shell from pages.md §2 using an expo-router
tab group and the TabBar primitive, and add the Discover "Under Construction" placeholder.
Room flow screens continue to present full-screen ABOVE the tabs. All existing routes
(including the deep link room/join/[code]) keep working.
Reference: pages.md §2 (navigation shell + tab→destination table) and §3.9 (Discover);
design-system.md §7 (TabBar). Depends on Prompts 1–2.

Tab → destination (pages.md §2):
- Discover → the placeholder screen (§3.9), post-v1 feed.
- Match → the room flow entry: the Welcome/Home screen (app/index.tsx) is the tab root;
  Create/Join push from it; lobby/session/result present full-screen above the tabs.
- Profile → auth (signed-out) or account + history (signed-in); history.tsx lives here.

Deliver:
- Restructure app/ into an expo-router tab group (e.g. an app/(tabs)/ group with _layout.tsx
  using Tabs + the TabBar primitive, and the three tab screens), while KEEPING the existing
  room/[roomId]/* and room/join/* routes as a stack presented above the tabs (full-screen,
  headerShown:false). Preserve every route path and param name; the join deep link must still
  resolve. Move app/index.tsx and app/history.tsx into the tab group without changing what they
  render (their reskin is Prompts 4–5).
- Add the Discover placeholder screen ("Under Construction", decorative amber/heat circles,
  "We're cooking up something special.") per pages.md §3.9 — a styled coming-soon state, no
  data wiring.
- Active tab item uses brand amber; three tabs regardless of any single mockup that shows two.
- Keep app/_layout.tsx's GestureHandlerRootView + QueryClientProvider + font loading wrapping
  the whole tree.

Done when: typecheck/lint pass; on a simulator the bottom tabs render and switch between
Discover (placeholder), Match (Welcome), and Profile (auth/history); creating/joining a room
and the join deep link still navigate correctly; no hook or endpoint was changed. Report the
navigation result.
```

---

## Prompt 4 — Reskin the entry & account screens (Welcome, Join, Create Room, Auth/Profile, History)

```
Goal: reskin the non-room screens to their mockups using the Prompt-2 primitives, leaving all
hooks/endpoints/validation untouched. Define each screen's loading/empty/error states with the
primitives (pages.md §4).
Reference: pages.md §3.1 (Welcome), §3.2 (Auth/Profile + History), §3.3 (Create Room),
§3.4 (Join), §4 (cross-cutting states); design-system.md §4–§8; the Stitch mockups
"Welcome to Munch", "Join with Name and Code", "Create a Room", "Profile & Sign In Updated".
Depends on Prompts 1–3. Independent of Prompt 5.

Deliver (reskin the route + its feature view component; do not change wiring):
- Welcome (app/index.tsx / features as applicable): "Ready to eat?" header; a large amber
  "Create a Room" Card (with the + glyph, "Host a session and invite your crew"); a cream
  "Join with Code" Card with a Field + burnt-orange (secondary) Join Button; the "How Munch
  Works" 3-step list with colored circular icon rows. Wiring: Create → create flow,
  Join → join_room (unchanged).
- Join (room/join/index.tsx + [code].tsx): name Field + 6-digit code Field (code prefilled
  from the deep link/QR when present); Join Button. Map join_room errors (ROOM_NOT_FOUND,
  ROOM_CLOSED, ALREADY_JOINED, RATE_LIMITED) to friendly inline messages (docs/04 §3.2) — never
  raw error text.
- Create Room (room/create.tsx): location Field (with locate affordance), cuisine FoodChips
  (closed CUISINES taxonomy from @munch/core — do not invent cuisines), PriceTiles ($-$$$$),
  the restyled RadiusSlider, amber "Start Room" Button. Filters are HOST-CONTROLLED for the
  room (invariant §2.2) — keep that semantics; this is visual only.
- Auth / Profile (features/auth + the Profile tab): "Sign in to save your history"; a `social`
  "Continue with Google" Button; OR divider; email + password Fields; "Remember me" Toggle +
  "Forgot"; amber "Sign In"; "Create an account" link. Signed-in: Avatar + account + entry to
  history. Guests see the empty/"sign in to save" state, never an error (pages.md §3.2 invariant).
- History (history.tsx / features/history): list styled with Card/Badge primitives; guest empty
  state = the "sign in to save" state (docs/04 §3.11), not an error.
- Each screen: loading = skeletons/spinners in card shapes (no layout shift); errors mapped from
  {error:{code,message}} (pages.md §4).

Done when: typecheck/lint pass; on a simulator each of these screens matches its mockup; the
create/join/auth/history flows still call the same RPCs with the same payloads (no wiring
changed); cuisines come from the @munch/core taxonomy; no raw provider/DB error is shown.
```

---

## Prompt 5 — Reskin the room & session core (Lobby, Swiping Session, Match, Host Resolution)

```
Goal: reskin the product core to its mockups while PRESERVING the swipe gesture, the realtime
wiring, and every §2/§3 invariant. This is the highest-risk reskin — treat the invariants as
load-bearing.
Reference: pages.md §3.5 (Lobby), §3.6 (Session), §3.7 (Match), §3.8 (Host Resolution), §4;
design-system.md §8 (Decision Card, swipe action row, Match reveal, Host resolution, Squad
list), §9 (UI invariants), §10 (reduced-motion); the Stitch mockups "Lobby with QR Code",
"Swiping Session", "It's a Match!", "Host Resolution". Depends on Prompts 1–3. Independent of
Prompt 4.

Deliver (reskin the route + feature view + the noted ui/feature components; keep wiring):
- Lobby (room/[roomId]/lobby.tsx, features/room/member-list, invite-panel): "Waiting for the
  crew" header; an amber Card with the room code + QR + "Tap to copy link"; "The Squad (N/M)"
  with Avatars (green `online` presence dots) + status snippets + an "Invite more" `+` Avatar
  tile; a "Waiting…" ProgressPill; host-only amber "Start Session" Button. Realtime presence,
  start_session, set_presence wiring unchanged; only the host can start; AGGREGATE presence only.
- Swiping Session (room/[roomId]/session.tsx, components/ui/swipe-card.tsx): restyle the
  Decision Card — image header with a distance ProgressPill overlay, restaurant name (title-lg),
  a "4.8 ★" rating Chip, a "$$ • Japanese, Seafood" line, decorative FoodChips; a header
  filter/"Adjust" affordance. Action row = pass (neutral surface-highest circle, ✕) and like
  (amber circle, ♥) ONLY — DROP the middle bookmark button. KEEP the existing reanimated/gesture
  pan + the button fallback; both call the SAME handlers. Each swipe → submit_swipe; NO provider
  call on swipe (§2.1); the card NEVER declares a match (server-authoritative, §2.3); realtime
  session status + AGGREGATE progress drive transitions. Respect reduced-motion for the throw.
- Match (room/[roomId]/result.tsx, features/session/result-view): confetti (reduced-motion
  aware), "It's a Match!" badge + "Everyone agreed!", a full-bleed photo Card with overlaid
  tag Chips + name + "1.2 miles away • $$" + rating; amber "Get Directions" Button (external
  maps deep link — NO provider call) and an outline "Share Match" Button (OS share sheet). Uses
  the match payload we already hold (§3.7 invariant).
- Host Resolution (features/session/resolution-view, shown when status =
  awaiting_host_resolution): "No Unanimous Match Yet"; a "Group's Top Pick" Decision Card; an
  AGGREGATE "N/M friends liked this" ProgressPill (count only — NEVER which member liked/passed;
  any avatars are decorative); amber "Settle for this" Button; a "Widen the Search" block
  (Search Radius RadiusSlider bounded to the host's anchor + cuisine FoodChips from the CUISINES
  taxonomy + amber "Fetch New Deck"). Wiring: get_resolution_ranking, resolve_session
  accept_top/widen unchanged. Ranking is CLOSEST-TO-UNANIMOUS (fewest passes → rating →
  distance, §2.4) — display it, do not re-sort. Non-host members see the passive "waiting on
  host" state. Widen makes EXACTLY ONE extra provider fetch (§2.1).

Done when: typecheck/lint/test pass; on a simulator each screen matches its mockup; a full
run (lobby → swipe → match) and a no-match run (→ resolution → settle/widen) complete with ONE
provider call per session (verify no fetch fires per swipe); the bookmark button is gone; only
the host can start/resolve; all displayed counts are aggregate. Report the end-to-end result.
```

---

## Prompt 6 — Phase B exit verification + doc reconciliation

```
Goal: verify Phase B's exit criteria, confirm no invariant was weakened by the reskin, and
reconcile any doc/code drift so the phase closes green and the docs match reality (CLAUDE.md §1).
Reference: ui-roadmap.md §3 (Phase B exit) + §5 (Phase D verify checklist as the standard);
design-system.md §9 (invariants); pages.md §3 (per-screen expectations). Depends on Prompts 1–5.

Deliver:
- Run the full gate and report ACTUAL output: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build` (whole tree).
- Visual QA on an iOS simulator, screen-by-screen against the Stitch mockups (Welcome, Join,
  Create Room, Auth/Profile, History, Lobby, Session, Match, Host Resolution, Discover). Note
  any deviation and fix or file it explicitly. Confirm Quicksand is loaded and the palette is
  the cream/charcoal light theme.
- Token-discipline audit: grep the mobile app for hardcoded hex colors and ad-hoc font sizes;
  confirm screens consume the theme adapter (which sources @munch/ui), with no palette
  re-defined in the app and no react-native-web import.
- Invariant check (presentation-only, design-system.md §9): confirm NO provider call on swipe
  and exactly one provider fetch per session/widen; the card never declares a match (server-
  authoritative); all progress/resolution counts are AGGREGATE (no per-member swipe disclosure);
  filters are host-controlled; cuisines come from the @munch/core CUISINES taxonomy; the swipe
  bookmark button is dropped; only the host can start/resolve. No domain logic left @munch/core.
- Doc reconciliation: update ui-roadmap.md so Phase B reads as delivered (its exit criteria
  met); reconcile pages.md / design-system.md with anything that shipped differently (e.g. a
  primitive name, a state). Keep edits minimal and factual.

Done when: all four gate commands are green tree-wide; every screen in pages.md §3 visually
matches its mockup on the simulator; the audits find no hardcoded palette, no weakened
invariant, and one provider call per session; and the docs describe the mobile app as it now
exists. Report the command output, the simulator QA notes, and the exact files changed.
```
