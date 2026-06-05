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
  and **always fully visible**.
- **Map-pick only** — no geocoding/search; keep an **optional** free-text `anchor_label`.
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
