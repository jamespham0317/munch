# Initial Roadmap

**Project:** Munch
**Document:** Initial Roadmap
**Status:** Draft v1 — for build
**Last updated:** 2026-05-25

---

## 1. How to read this

This roadmap is sequenced for a **solo developer** shipping to a public launch. Phases are
ordered so each one produces something testable and de-risks the next. Time estimates are
deliberately omitted — they depend on your ramp-up on the stack; the *order* is the
valuable part. Treat each phase as "done" only when its exit criteria are met.

The riskiest, most product-defining piece (the real-time unanimous match) is brought
forward deliberately, because if that mechanic doesn't feel good, everything else is moot.

---

## 2. Phase 0 — Foundations

**Goal:** a working monorepo and backend skeleton you can build on.

- Set up the monorepo (pnpm/Turborepo), `tsconfig.base`, ESLint/Prettier, CI.
- Scaffold `apps/mobile` (Expo) and `apps/web` (Next.js) with a shared `@munch/core`.
- Stand up Supabase: project, auth (anonymous + email), first migrations (enums + tables),
  RLS policies.
- Wire `@munch/api-client` to Supabase; prove a trivial authed read end-to-end on both apps.

**Exit criteria:** both apps build and run, can create an anonymous session, and read a
seeded row under RLS.

---

## 3. Phase 1 — Rooms & identity

**Goal:** people can create and join private rooms as guests or signed-in users.

- `create_room`, `join_room`, `update_room_filters`, `set_presence`, `leave_room`.
- Guest flow (name only) and optional account flow; guest→account upgrade path.
  *(The OTP account flow and in-place upgrade are superseded in Phase 4.5 — email+password &
  Google OAuth, no mid-room sign-in.)*
- Room lobby UI with live presence via Realtime.
- 6-digit code generation + join, and the link/QR join path resolving to the same code.
- Rate-limit room creation/joins.

**Exit criteria:** a host creates a room on web, a friend joins via code on mobile and via
link on web, and both see each other present in the lobby in real time.

---

## 4. Phase 2 — The core mechanic (highest priority)

**Goal:** the real-time unanimous match works and feels good. This is the product.

- Provider abstraction + `GooglePlacesProvider` (server-side, key protected).
- `start_session`: single provider fetch, normalize, cache deck (`cached_decks`).
- `get_deck` + deterministic client-side shuffle (`@munch/core/shuffle`).
- Swipe UI (cards: photo, name, rating, price, distance) + radius slider.
- `submit_swipe` with the **authoritative transactional match check**.
- Realtime match event → match announcement screen.
- Thorough tests on the unanimous check (incl. member-leaves-mid-session).

**Exit criteria:** 3 devices in one room swipe their own orders against one cached deck, and
the instant the last person likes a shared restaurant, all three see the match announced —
with only one provider call having been made for the whole session.

---

## 5. Phase 3 — Deck exhaustion & host resolution

**Goal:** sessions always end cleanly, never get stuck.

- Detect deck exhaustion with no unanimous match → `awaiting_host_resolution`.
- "Waiting on host" state for non-host members.
- `get_resolution_ranking` (closest-to-unanimous; tiebreaks: rating, distance).
- `resolve_session`: **accept top pick** and **widen criteria** (one extra provider fetch
  for unseen restaurants, appended; existing likes still count).

**Exit criteria:** a session with no unanimous match presents the host the correct
closest-to-unanimous ranking; accepting ends the session, and widening appends only unseen
restaurants and resumes swiping.

---

## 6. Phase 4 — Filters, polish & persistence

**Goal:** the v1 feature set and the retention hook.

- Host-controlled filters wired end-to-end: open-now, cuisine, price range.
- Match history for signed-in users (`match_history`) + a simple history screen.
- Empty/edge states: sparse areas, tiny rooms, everyone-passes, host leaves mid-session
  (session ends as `cancelled`, room closes — no host transfer).
- UI polish on the swipe feel, match reveal, and lobby. The full visual reskin to the
  "Munch Visual Language" is planned in detail in `docs/11-ui-roadmap.md` (tokens in `@munch/ui`,
  Quicksand, Tailwind v4 on web), against `docs/09-design-system.md` and `docs/10-pages.md`.

**Exit criteria:** filters visibly shape the deck; signed-in users see past matches; guests
remain ephemeral; common edge cases have defined, non-broken behavior.

---

## 6.5 Phase 4.5 — Account auth: email+password & Google OAuth

**Goal:** replace OTP-based accounts with email+password and Google sign-in, and confine
authentication to outside a room.

- Replace email OTP with **email + password** registration and sign-in
  (`signUp` / `signInWithPassword`), with **email confirmation** on register and a
  **password-reset** path (`resetPasswordForEmail` → `updateUser`).
- **Google OAuth** sign-in (`signInWithOAuth({ provider: 'google' })`) on web and mobile
  (Expo auth-session redirect).
- **No mid-room sign-in:** the auth surface is available only on the home/landing screen.
  Once a member joins a room (lobby **or** session), auth is hidden and their identity is fixed
  for that room. The in-place guest→account upgrade — and its `updateUser` /
  `verifyOtp(type:'email_change')` machinery — is **removed**; a guest who joined as a guest
  stays a guest for that room.
- Update `@munch/core` auth validation (password rules), the api-client auth helpers, and the
  auth-panel placement on both apps.

**Exit criteria:** a user can register with email+password (confirming via email) or sign in
with Google from the home screen, then create/join a room as a signed-in user; the auth surface
is absent inside a room; a guest cannot upgrade mid-room; match history accrues for the
signed-in account.

**Supersedes:** the Phase 1 OTP account flow and the guest→account upgrade path (§3).

---

## 6.6 Phase 4.6 — Map-based anchor & radius selection

**Goal:** replace manual latitude/longitude entry on the Create Room flow with an interactive
map and device geolocation, with a fixed-size radius ring on the map whose represented radius is
driven by the radius slider (via the map zoom).

- Replace the manual `anchor_lat`/`anchor_lng` text inputs on **Create Room** with an
  interactive **MapLibre** map (free **OpenStreetMap** raster tiles, no paid key) on both
  apps; a **fixed center pin** sets the anchor (anchor = current map center, read on move-end).
- On open, request **device geolocation** (web `navigator.geolocation`, mobile `expo-location`)
  and center the map on it as the default anchor; on denial/unavailable, fall back to a neutral
  default center with manual pan — geolocation is opt-in and **never blocks room creation**.
- A translucent **amber radius ring** rendered as a **fixed-size overlay** centered on the map —
  it never moves or resizes. The existing `RadiusSlider` (`RADIUS_MIN_M` 500 … `RADIUS_MAX_M`
  20 000, default 3 000) drives the **map zoom** instead (`zoomForRadius`, using the center
  latitude), so a ground circle of the selected radius projects to exactly that fixed ring:
  dragging the slider zooms the map in/out while the ring stays stationary, the same visual size,
  and **always fully visible**. The slider is the **only** zoom control: every user zoom gesture
  (scroll, pinch, double-tap, keyboard `+`/`-`) is disabled so the map can only **pan** and the
  ring can never desync from the selected radius; programmatic zoom (slider re-fit, geolocation
  recenter) is unaffected.
- **Map-pick only** — no geocoding/search; keep an **optional** free-text `anchor_label`
  (removed in Phase 4.8 — §6.8).
- **Client/presentation only:** no change to the `create_room` contract, DB schema, RPCs, or
  migrations — the map populates the existing `anchor_lat`/`anchor_lng`/`default_radius_m`/
  `anchor_label`, still validated by `@munch/core` (`latSchema`/`lngSchema`). Map and slider
  interactions make **no provider call** (invariant §2.1); the OSM tile source is separate from
  the restaurant provider and needs no key, and the server-only Places key never reaches a
  client. Anchor + radius stay **host-controlled** (§2.2); the lobby shows the anchor/radius
  read-only and the host keeps the lobby radius edit.
- Shared meters↔map geo math (the radius→zoom fit `zoomForRadius` and the fixed ring's
  `circleDiameterPx`) lives in `@munch/core`, unit-tested; ring/pin styling comes from
  `@munch/ui` tokens; map implementation is **per-platform** (no `react-native-web`).

**Exit criteria:** on both apps a host sets the room anchor by panning a map (centered on their
device location when permission is granted, a sensible default otherwise), a fixed-size amber
ring stays stationary and fully visible while the radius slider (500 m to 20 km) zooms the map
in/out to represent the selected radius, room creation still succeeds via the **unchanged**
`create_room` contract, and no restaurant-provider call fires on any map or slider interaction.

**Reverses (by explicit decision, CLAUDE.md §8):** the post-v1 "map view" deferral for the
**anchor-selection** map (docs/08 §"Maps/geo"; docs/01 deferred list). The restaurant-card
**"map preview"** stays deferred.

---

## 6.7 Phase 4.7 — Presence/membership split

**Goal:** make activity status **purely cosmetic** and base matchmaking on **room
membership**, so every member's swipes count and members control their participation by
joining/leaving — not by whether their app happens to be focused.

- **Split presence from the match cohort.** Today `room_members.is_present` is *both* the
  cosmetic "Here/Away" indicator and the unanimous-match cohort. Separate them: **presence**
  becomes cosmetic-only (never read by matchmaking) and the **match cohort** becomes the set of
  **active members** (`room_members.left_at IS NULL`). The unanimous check
  (`check_unanimous_match`), deck-exhaustion (`is_deck_exhausted`), and ranking
  (`get_resolution_ranking`) swap their `is_present = true` predicate for `left_at IS NULL`;
  every member's swipes count regardless of presence.
- **Cosmetic Here/Away** via Supabase Realtime **Presence** on `room:{room_id}` (a `focused`
  flag from `visibilitychange` / `AppState`) — zero DB writes, no effect on the cohort. Drop the
  `is_present` column; add `last_seen_at` for liveness.
- **Explicit leave removes you from the cohort.** A non-host "Leave room" (host: "End room")
  sets `left_at`, deletes the member's swipes for non-terminal sessions, and **immediately**
  re-runs the authoritative match check across the remaining active members — a leave can
  complete a unanimous match the instant the last blocker leaves. `leave_room` becomes a
  security-definer RPC; **host-leave keeps the resolved policy** (cancel session, close room, no
  transfer).
- **Auto-remove on disconnect.** A client heartbeat (`last_seen_at`) plus a server sweeper
  (`prune_absent_members`, pg_cron) removes any active member whose heartbeat goes stale past a
  grace window: a closed app/tab or lost connection leaves the room (and its swipes stop
  counting) after grace, while a brief blip within grace never removes them. A
  backgrounded-but-connected member stays in the cohort (just shows "Away").
- **Min cohort = 1; roster freezes at start.** A solo remaining active member matches on their
  first like; if every member leaves, the session ends `cancelled` and the room closes. Joining
  is **lobby-only** — once a session has started, `join_room` rejects new *and* returning members
  with `ROOM_IN_SESSION`, so the cohort can only shrink once swiping begins.
- Update `@munch/core` (cohort logic + the new constants), the api-client (`leave_room` RPC,
  presence/heartbeat helpers, `ROOM_IN_SESSION` mapping), the SQL functions above, and both apps
  (leave control, presence dots driven by Realtime Presence, removed-state routing). Update the
  lockstep docs in the same change (CLAUDE.md §2.3/§9, docs/01–04, docs/09).

**Exit criteria:** activity status is visibly cosmetic — a backgrounded member shows "Away" yet
their like is still required and still completes a match; closing the app removes the member
after the grace window and their swipes stop counting; a member tapping "Leave" is removed
immediately and, if that makes the remaining likes unanimous, the match fires at once; a solo
remaining member can match and an emptied room ends `cancelled`; no one can join or re-join
after the session has started; and no matchmaking path reads presence. `pnpm typecheck`, `lint`,
`test`, `build` are green tree-wide.

**Supersedes:** the present-member-scoped cohort definition (CLAUDE.md §2.3, docs/02 §5,
docs/03 §5–§6, docs/04 §3.4/§3.7/§3.8) — "every member" becomes **every active member**, and
activity status is reclassified as presentation-only (docs/09 §9). **Preserves** the host-leave
policy and all four CLAUDE.md §2 invariants (per-session caching, shared deck + host-controlled
filters, server-authoritative match check, closest-to-unanimous ranking).

---

## 6.8 Phase 4.8 — Remove the free-text anchor label

**Goal:** drop the vestigial "Where are we eating?" **text field** on Create Room and move
that prompt onto the components that actually set the anchor — the **map + radius slider** —
removing a false-search affordance left over from Phase 4.6.

Since Phase 4.6 made the anchor **map-pick only** (no geocoding), the `anchor_label` input has
been decorative: typing in it never moves the pin or shapes the deck; it only fed
`rooms.anchor_label`, shown read-only in the lobby. This phase removes the field **and** the
column end-to-end (the "full removal" option, not a UI-only hide), so no dead schema lingers
(CLAUDE.md §8 — smallest change that fully satisfies the task, applied to the whole column's
blast radius rather than half of it).

- **UI (both apps).** Delete the `anchor_label` `Input` from `create-room-form.tsx` (web +
  mobile); re-head the existing **AnchorMap + RadiusSlider** group with the "Where are we
  eating?" prompt. The anchor is still `map.getCenter()` on move-end (Phase 4.6, unchanged); the
  radius slider still drives the map zoom. No new map/search behavior.
- **Lobby.** `AnchorSummary` (both apps) drops its `anchorLabel` prop and shows a static
  "Pinned location" (+ radius); `lobby-filters-panel` stops passing the label. Anchor/filters
  stay **host-controlled** and read-only to non-hosts (invariant §2.2).
- **Contract + core.** Remove `anchor_label` from the `@munch/core` schemas
  (`createRoomRequestSchema`, `joinRoomResponseSchema`, `updateRoomFiltersRequest/Response`) and
  the `Room` type, and from the api-client (request mapping, raw/result shapes, `mapRoomRow` /
  `ROOM_COLUMNS`, integration-test payloads).
- **DB (rewrite migrations in place).** `anchor_label` is removed by **editing the existing
  migrations in place** (the standard workflow, CLAUDE.md §6 — no additive migration), as if the
  column never existed: drop the column from `0002`; drop the `p_anchor_label` parameter from
  `create_room` / `update_room_filters` in `0005` (with their `REVOKE`/`GRANT` signatures) and
  `anchor_label` from every `join_room` return JSON across `0005`, `0017`, and `0019`. All four
  files change together (a stale `v_room.anchor_label` reference would fail `db reset`).
- **Presentation only.** No matchmaking, caching, provider, or realtime change; all four §2
  invariants untouched. The `create_room` contract changes only by the removal of one optional,
  always-decorative field.

**Exit criteria:** Create Room (web + mobile) shows **no** location text field, with "Where are
we eating?" heading the map/radius group; a room still creates via the (now `anchor_label`-free)
`create_room` contract; the lobby shows "Pinned location"; the `rooms.anchor_label` column and
every code reference to it are gone (incl. the rewritten migrations); `supabase db reset` applies
the edited migration set on a fresh DB and `pnpm typecheck`, `lint`, `test`, `build` are green
tree-wide.

**Reverses (by explicit decision, CLAUDE.md §8):** the Phase 4.6 choice to "keep an **optional**
free-text `anchor_label`" (§6.6; docs/10 §3.3) — the field and column are removed, not retained.
Update the lockstep docs in the same change (docs/03 §3.2, docs/04 §3.1/§3.2, docs/09, docs/10
§3.3, this §6.6 bullet).

---

## 7. Phase 5 — Hardening for public launch

**Goal:** safe, observable, store-ready.

- Abuse mitigation: guest-name moderation, room/join rate limits verified under load.
- Observability: structured logs, provider-calls-per-session metric, billing alerts at
  50/75/90%.
- Data retention/cleanup jobs: purge expired `restaurants`, end-of-session purge of
  `swipes`/`cached_decks`.
- App Store / Play Store prep via Expo (icons, store listings, builds, review).
- Privacy basics: privacy policy, data-deletion path for accounts.
- Verify current provider pricing & caching ToS on the provider's own page before launch.

**Exit criteria:** apps submitted to both stores, web deployed, cost per session
instrumented and bounded, and no table without RLS.

---

## 8. Explicitly deferred to post-v1

Tracked so they don't creep into v1 scope:

- Rich cards (menu links, review excerpts, multiple photos, map preview).
- Dietary filters (vegetarian/vegan/halal/gluten-free).
- "Hybrid" filters: members narrow within (never expand beyond) the host's set.
- Personalization from swipe history (would require enabling swipe logging + consent).
- Monetization mechanics (premium rooms, larger groups, super-like).
- Provider #2 (Yelp/Foursquare) behind the existing abstraction, if cost/quality warrants.

---

## 9. Cross-cutting risks to keep visible

- **Provider pricing/ToS volatility** — re-verify before launch; abstraction limits blast
  radius.
- **Cost regressions** — the per-session-call metric is the early-warning system.
- **Sparse-area UX** — widen flow is the mitigation; watch real usage in low-density areas.
- **Solo-dev scope discipline** — the deferred list above is a commitment, not a wishlist.
