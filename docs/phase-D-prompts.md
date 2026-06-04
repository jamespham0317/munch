# Phase D — Verify (cross-platform reskin sign-off): Agent Prompts

**Project:** Munch
**Source:** `docs/11-ui-roadmap.md` §5 (Phase D — Verify) — the final gate over the UI reskin
delivered in Phase A (tokens), Phase B (mobile), and Phase C (web).
**Purpose:** Phase D broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Prompts 2 (mobile QA) and 3
(web QA) are independent of each other and may run in parallel once Prompt 1 is green, but both
must land before Prompt 4.

**Prepend the shared preamble to every prompt.**

Phase D is the **holistic, cross-platform verification** that the reskin is *green and faithful*.
The app is **functionally complete through Phase 4.5**; the **"Munch Visual Language"**
(`docs/09-design-system.md`) shipped on mobile (Phase B) and web (Phase C) from the shared
`@munch/ui` tokens (Phase A); and **Phase 4.6** added the Create Room **AnchorMap**. Phase B and
Phase C each met their own exit criteria, and Phase C's Prompt 6 already did a *web* pass — Phase D
is the **combined both-platform sign-off**: it confirms every screen matches its mockup on **both**
platforms, the two platforms are at **parity**, and **no UI change weakened a §2/§3 invariant**.

### Phase D is VERIFY-ONLY (decide once, here)

- Phase D **builds no features** and changes **no domain logic, endpoint, RPC, migration, realtime
  wiring, or contract**. The backend is frozen. The **only** writes Phase D makes are: (a) **small
  fixes for reskin / token drift** it catches (the smallest change that restores fidelity), and
  (b) the **doc updates** that mark Phase D delivered (Prompt 5).
- Anything larger than a minor visual/token fix — a missing screen, a broken flow, a weakened
  invariant — is **STOP-and-flag**, not a rebuild. Report it; do not re-implement a phase.
- Verification **never hits a real provider** (CLAUDE.md §7): use the **fake provider fixture**
  (`PROVIDER=fake`) and local Supabase. Map tiles (OSM) are a separate keyless source and are not
  a provider call.

### What's already in place (verify it, don't rebuild)

- **Tokens (Phase A):** `@munch/ui` (`tokens.ts`) is the single source; mobile re-exports it
  (`apps/mobile/src/theme/index.ts`), web **seeds** its Tailwind v4 `@theme` from it
  (`apps/web/scripts/generate-theme.ts` → `app/theme.generated.css`, guarded by
  `generate-theme:check` as the web `test` gate). No palette is duplicated per app.
- **Mobile (Phase B):** Quicksand loaded; RN primitives in `apps/mobile/src/components/ui/`; the
  `(tabs)` shell (Discover · Match · Profile); every `10-pages.md` §3 screen reskinned; like/pass
  only; distance in km.
- **Web (Phase C):** Tailwind v4 + Quicksand; web primitives in `apps/web/src/components/ui/`; the
  `app/(tabs)/` route group (bottom bar ↔ side nav, centered `.munch-container` 1200px /
  `.munch-column` 36rem); every route reskinned; inline `style={}` removed except the per-frame
  swipe drag transform and a couple of prop-computed dynamic sizes (Card image height, Avatar dim).
- **Create Room AnchorMap (Phase 4.6):** MapLibre + keyless OSM tiles, fixed center pin, amber
  radius circle bound to the RadiusSlider, geolocation centering with safe fallback, OSM
  attribution. Phase 4.6 has its own deep verification (`phase-4.6-prompts.md` Prompt 6) — Phase D
  only confirms the map **sits correctly inside the reskinned Create Room screen** and its
  no-provider-call invariant still holds; it does not re-verify the geo math.

### Phase D maps to the roadmap §5 bullets + exit criteria

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` green **tree-wide** → Prompt 1
- Static token / inline-style / react-native-web / secret-leak / client-side-match audits → Prompt 1
- Visual QA on a **mobile simulator**, screen-by-screen vs the Stitch mockups → Prompt 2
- Visual QA in a **browser**, screen-by-screen at mobile + desktop widths, clean reflow → Prompt 3
- Confirm no UI change weakened an invariant (no provider call on swipe; no client-side match
  declaration; aggregate-only counts; host-controlled filters), end-to-end and cross-platform
  → Prompt 4
- Mark Phase D delivered + reconcile any doc drift the verification surfaced → Prompt 5

**Exit check (after all 5):** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` are green
tree-wide; **every screen in `10-pages.md` §3 visually matches its Stitch mockup on BOTH platforms**
(mobile simulator + browser at mobile and desktop widths) and the web reflows cleanly
(bottom bar ↔ side nav, centered container, no overflow); a **live cross-platform session** (a web
member + a mobile member in one room) reaches a unanimous match announced on both clients, and a
no-match run resolves via host resolution / widen; **one provider call per session start, one per
widen, zero per swipe** (cited from the structured logs); the card **never declares a match**, all
progress/resolution counts are **aggregate**, filters are **host-controlled**, cuisines come from
the `@munch/core` `CUISINES` taxonomy, the swipe **bookmark is gone**, distance is **km** on both
platforms, auth lives on **Profile** not Welcome, and no provider/service-role key appears in
`apps/*` or `packages/*`. `docs/11-ui-roadmap.md` §5 records Phase D as delivered and the docs match
the shipped both-platform reskin.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and, for this phase, docs/11-ui-roadmap.md (§5 Phase D verify, §2–§4 for
  what Phases A/B/C delivered, §7 constraints), docs/09-design-system.md (§4–§8 tokens/primitives/
  patterns, §9 UI invariants, §10 a11y), and docs/10-pages.md (§2 nav shell, §3 screen inventory,
  §4 cross-cutting states).
- This is Phase D (Verify) of the UI reskin. Phases A (tokens in @munch/ui), B (mobile reskin), and
  C (web reskin) are DELIVERED, and Phase 4.6 added the Create Room AnchorMap. Phase D is
  VERIFY-ONLY: it builds no features and changes no domain logic, endpoint, RPC, migration,
  realtime wiring, or contract. The ONLY writes Phase D makes are (a) SMALL fixes for reskin/token
  drift it catches (smallest change that restores fidelity), and (b) the doc updates that mark
  Phase D delivered (Prompt 5). Anything larger — a missing screen, a broken flow, a weakened
  invariant — is STOP-and-flag, not a rebuild.
- Phase D CONFIRMS the reskin did not weaken the §2 invariants or §3 security rules: (§2.1) no
  provider call on a swipe / map pan-zoom / geolocation / radius-slider change — exactly one
  provider fetch at start_session and one per widen; (§2.3) the client never declares a match
  (server-authoritative); aggregate-only counts (never per-member swipe disclosure); (§2.2)
  host-controlled filters; provider/service-role keys never in apps/* or packages/*.
- Verification NEVER hits a real provider (CLAUDE.md §7): use the fake provider fixture
  (PROVIDER=fake) against local Supabase. OSM map tiles are a SEPARATE keyless source, not a
  provider call.
- Locked UI decisions to verify parity on (do not relitigate): tokens live ONCE in @munch/ui and
  are never re-defined per app (the web Tailwind theme is SEEDED from them); no react-native-web;
  like/pass ONLY (the swipe middle bookmark button is dropped); three destinations
  Discover·Match·Profile; auth lives on Profile, not Welcome; Discover is an "Under Construction"
  placeholder; distance shown in km on BOTH platforms.
- Files kebab-case.ts; React components PascalCase.tsx; TypeScript strict; no `any`. Make the
  smallest change that satisfies the task.
- When done, run the stated acceptance checks and report their ACTUAL output. Commit straight to
  main (this repo's convention) with a Conventional Commit; update any doc you contradict in the
  same change (CLAUDE.md §1).
```

---

## Prompt 1 — Tree-wide gates + static token / invariant / secret audit (no app running yet)

```
Goal: get the whole tree green and run the STATIC (non-visual) audits that need no running app.
This is the foundation — the visual QA prompts only matter once the gates are green. Reference:
docs/06-coding-standards.md §4 (lint/format), §9 (security), §10–§11 (testing/CI);
docs/09-design-system.md §3 (tokens single-sourced from @munch/ui), §9 (UI invariants);
docs/11-ui-roadmap.md §5.

Deliver:
- Run and report ACTUAL output, tree-wide: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build`. If any is red, fix ONLY small reskin/config drift (smallest change) and re-run;
  flag anything structural rather than rebuilding.
- Token discipline (both apps): grep apps/mobile and apps/web for hardcoded hex colors and ad-hoc
  font sizes that a @munch/ui token already defines. Confirm the web theme is SEEDED from @munch/ui
  (the generate-theme step runs before dev/build and `pnpm generate-theme:check` is the web test
  gate) with NO palette duplicated; confirm mobile theme re-exports @munch/ui with no dark
  Phase-0 placeholder values left.
- Inline-style audit (web): confirm no inline `style={}` remains for LAYOUT — only the per-frame
  swipe drag transform (swipe-card.tsx) and the documented prop-computed dynamic sizes (Card image
  height, Avatar dimension) are allowed.
- No react-native-web: grep both apps; confirm none.
- Secret-leak guard: confirm the CI secret-leak guard still rejects provider/service-role key
  patterns under apps/* and packages/*, and that no Places/service-role key appears there (OSM
  needs none).
- Static invariant scan: confirm no component under apps/*/src/components or features declares a
  match or calls the provider/Edge Function directly for a swipe — a swipe goes through
  submit_swipe via @munch/api-client, and the ONLY provider fetch is start_session / resolve_session
  (widen). Matching/ranking/shuffle live only in @munch/core.

Done when: all four gates are green tree-wide with the output reported; the audits find no
duplicated palette, no stray inline layout style, no react-native-web import, no client-side
provider/service-role key, and no client-side match declaration; and any change made was a minimal
drift fix (report the diff). List every file touched.
```

---

## Prompt 2 — Mobile visual + runtime QA on a simulator (screen-by-screen vs mockups)

```
Goal: confirm every mobile screen in docs/10-pages.md §3 matches its Stitch mockup on a simulator,
and that the reskin kept the wiring and the §2/§3 invariants. Reference: docs/10-pages.md §3 (screen
inventory) + §2 (tab shell) + §4 (states); docs/09-design-system.md §4–§8 (palette, Quicksand,
primitives, Munch patterns), §9 (invariants), §10 (a11y/reduced-motion); docs/11-ui-roadmap.md §3
(Phase B as delivered). Depends on Prompt 1; may run in parallel with Prompt 3.

Context: the Create Room AnchorMap (MapLibre RN, Phase 4.6) needs native code, so Expo Go will NOT
run it — build a DEV BUILD for the iOS simulator. Use the XcodeBuildMCP tools (session_show_defaults
→ build_run_sim; screenshot / snapshot_ui per screen). Run against local Supabase with PROVIDER=fake.

Deliver:
- Build + run a dev build on the iOS simulator (and an Android emulator if one is available).
  Capture a labelled screenshot of each screen in 10-pages.md §3: Welcome, Join, Create Room (with
  AnchorMap), Auth/Profile, History, Lobby, Swiping Session, Match, Host Resolution, Discover.
- For each screen confirm it matches its mockup: cream/charcoal palette, Quicksand faces, pill
  (radius-full) buttons, xl rounded cards, soft ambient shadows, amber brand moments. Note any
  deviation; fix SMALL visual drift, flag anything larger.
- Navigation: the three-tab shell (Discover · Match · Profile) navigates; active item is amber; the
  room/join/create routes present full-screen ABOVE the tabs; the join deep link (room/join/[code])
  resolves.
- Runtime invariants on device:
    • Swiping Session action row is like/pass ONLY (no middle bookmark); distance shows in km.
    • Create Room map centers on geolocation when granted (a default center otherwise, never
      blocking), the amber radius circle tracks the slider 500 m–20 km and stays visible, the
      "© OpenStreetMap contributors" attribution shows, and NO provider call fires on any
      map/slider interaction (the only provider fetch is start_session).
    • Cuisines come from the @munch/core CUISINES taxonomy (a fixed picker, not free text);
      auth lives on the Profile tab, not Welcome; Discover is the "Under Construction" placeholder.
    • A swipe→match run shows the match reveal; the card never declares the match itself.

Done when: a labelled screenshot exists for every 10-pages.md §3 mobile screen and each matches its
mockup; the tabs + the join deep link work; like/pass-only, km distance, host-controlled filters,
and no-provider-call-on-swipe/map all hold on device; `pnpm --filter @munch/mobile typecheck`
passes; and any change made was a minimal visual fix (report it). Attach the screenshots and per-
screen notes.
```

---

## Prompt 3 — Web visual + runtime QA in a browser (both widths, clean reflow)

```
Goal: confirm every web route in docs/10-pages.md §3 matches its mockup at BOTH a mobile and a
desktop width, reflows cleanly, and keeps its wiring + invariants in-browser. Phase C's Prompt 6
did the first web pass; this is the Phase D holistic sign-off — re-confirm and catch any drift
since. Reference: docs/10-pages.md §2–§4; docs/09-design-system.md §6 (responsive nav, 1200px
container / 36rem column), §7–§8 (primitives/patterns), §9 (invariants), §10; docs/11-ui-roadmap.md
§4 (Phase C as delivered). Depends on Prompt 1; may run in parallel with Prompt 2.

Context: run the web app against local Supabase with PROVIDER=fake (`pnpm dev:web`). QA each route
at a narrow (mobile) and a wide (desktop) viewport.

Deliver:
- Screen-by-screen QA at both widths: Welcome, Join, Create Room (with AnchorMap), Auth/Profile,
  History, Lobby, Swiping Session, Match, Host Resolution, Discover. Confirm each matches its
  Stitch mockup; note deviations; fix SMALL visual drift, flag larger.
- Reflow: the nav is a bottom TabBar at mobile widths and a top/side nav at desktop; content is
  centered in the 1200px `.munch-container`; full-screen room/auth routes use the 36rem
  `.munch-column`; no overflow or layout shift. Confirm the Tailwind v4 t-shirt-scale bug stays
  fixed (page containers use `.munch-container` / `.munch-column`, NOT `max-w-*`, which the seeded
  `--spacing-*` tokens shadow).
- Runtime invariants in-browser (use the network panel / structured logs):
    • A full run (lobby → swipe → match) and a no-match run (→ resolution → settle / widen) each
      complete with ONE provider call per session — verify NO fetch fires per swipe.
    • The card never declares a match; all progress/resolution counts are AGGREGATE (never
      per-member); the swipe row is like/pass only; distance is in km.
    • The Create Room AnchorMap makes no provider call and shows the OSM attribution; the
      join-via-link route resolves; auth is on Profile, not Welcome; cuisines from the @munch/core
      CUISINES taxonomy.

Done when: each web route matches its mockup at both widths and reflows cleanly (bottom bar ↔ side
nav, centered container, no overflow); one provider call per session is confirmed in-browser; the
bookmark is gone, counts are aggregate, distance is km, auth is on Profile; `pnpm --filter
@munch/web build` passes; and any change made was a minimal visual fix (report it). Attach the
mobile-width and desktop-width QA notes per route.
```

---

## Prompt 4 — Cross-platform parity + end-to-end invariant confirmation (one live room, web + mobile)

```
Goal: the load-bearing confirmation — run ONE real session with a web member and a mobile member in
the SAME room and confirm the core mechanic and the §2/§3 invariants hold end-to-end, with the two
platforms at parity. Reference: docs/01-product-specification.md §6–§7 (matching + resolution),
docs/02-system-architecture.md §4–§6 (caching, realtime, state machine), docs/04-api-specification.md
§3.5–§3.10, docs/09-design-system.md §9; CLAUDE.md §2/§3. Depends on Prompts 2 and 3.

Context: local Supabase, PROVIDER=fake (a fixed restaurant fixture — never a real provider). Host on
one platform, member on the other (mobile dev build + browser). Watch the Edge Function structured
logs (start_session.ok, submit_swipe, resolve_session.accept.ok / resolve_session.widen.ok).

Deliver:
- Clean-match run: host starts a session; both members swipe their own shuffled orders against the
  one cached deck; confirm the instant the last member likes a shared restaurant, the match is
  announced LIVE on BOTH clients with the same restaurant.
- No-match run: exhaust the deck with no unanimous like → status moves to awaiting_host_resolution;
  the non-host sees the passive "waiting on host" state; the host sees the closest-to-unanimous
  ranking (fewest passes → rating → distance). Accept-top ends the session on both; on a separate
  run, widen appends only UNSEEN cards (added_round n+1) and resumes, earlier likes still counting.
- Provider-call invariant (cite the logs): provider_calls is 1 at start_session, 1 per widen, 0 on
  accept_top, and 0 on every swipe. No fetch per swipe on either platform.
- Parity audit web ↔ mobile: distance in km on both; like/pass-only on both; three destinations +
  Discover placeholder on both; auth on Profile on both; the SAME closest-to-unanimous order shown
  to the host; aggregate-only counts on both (no per-member swipe disclosure anywhere).
- Host-departure path: the host leaving mid-session ends the session `cancelled` and closes the
  room on BOTH clients (remaining member notified, returned to an ended state); host role is NOT
  transferred.

Done when: a live cross-platform session reaches a unanimous match announced on both clients; the
no-match → resolution → accept/widen paths work; provider_calls is 1 per start and per widen and 0
per swipe (log lines cited); web and mobile are at parity on km / like-pass / tabs / auth-placement /
aggregate-counts / ranking order; and host-leave cancels + closes on both. Report the run timeline,
the cited log lines, and any drift fixed.
```

---

## Prompt 5 — Phase D exit sign-off + doc reconciliation

```
Goal: close Phase D — a final green gate, record Phase D as delivered, and reconcile any doc/code
drift the verification surfaced so the docs match the shipped both-platform reskin (CLAUDE.md §1).
Reference: docs/11-ui-roadmap.md §5 (Phase D exit) + §2–§4 (the A/B/C "Delivered" style to mirror);
docs/10-pages.md; docs/09-design-system.md. Depends on Prompts 1–4.

Deliver:
- Re-run and report ACTUAL output, tree-wide and green: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build`.
- Doc reconciliation (minimal, factual):
    • docs/11-ui-roadmap.md §5: mark Phase D as ✅ Delivered with its exit criteria met, in the same
      voice as the §2–§4 "Delivered" sections (what was verified, on both platforms, green CI).
    • docs/10-pages.md / docs/09-design-system.md: reconcile anything Prompts 1–4 found shipped
      differently from the spec (a primitive name, a state, the Create Room AnchorMap in §3.3) —
      keep edits factual and minimal; do NOT add new rules.
    • RESOLVE the distance-units open decision to KM (the project's decision: distance is shown in
      km on both platforms, not imperial). Drop the "open / revisit if a US-imperial launch is
      decided" framing wherever it appears — docs/11-ui-roadmap.md §3 (Phase B exit note) and §4
      (Phase C locked decisions) — and state km as the settled unit. In CLAUDE.md §9, ADD a
      "Resolved: distance units = km on both platforms" note in the same voice as the existing
      "Resolved: host leaves mid-session" line, and remove any cross-reference that still calls
      units open. This is the one open decision Phase D closes; the provider pricing/ToS §9 item
      stays open.
    • If any other CLAUDE.md §1–§8 statement now mismatches reality, fix it in the same change.
- Verification summary in the report: the per-screen QA result on BOTH platforms (attach the mobile
  screenshots + the web mobile/desktop notes from Prompts 2–3), the cross-platform live-run result
  (Prompt 4), the invariant confirmations (one provider call per session/widen, zero per swipe; no
  client-side match; aggregate-only counts; host-controlled filters; keys absent from apps/*), and
  the exact files changed (should be docs + any minimal drift fixes only).

Done when: all four gates are green tree-wide; docs/11-ui-roadmap.md §5 records Phase D as
delivered; the distance-units decision is RESOLVED to km in the docs (no "open / US-imperial"
framing remains and CLAUDE.md §9 records the resolution); the docs match the shipped reskin on both
platforms; and the report enumerates the per-screen QA (mobile + web), the cross-platform live run,
the invariant checks, and every file changed. This closes the A → B → C → D UI roadmap.
```
