# Pages

**Project:** Munch
**Document:** Pages / Screens map (UI)
**Status:** Draft v1 — for build
**Last updated:** 2026-06-02

---

## 1. Purpose

The screen inventory for the reskin: each page's route on both platforms, what it does, the
mockup it matches, the primitives it composes (see `09-design-system.md`), the data it is wired
to, and the invariants it must honor. This is layered on the existing, functionally complete
app (through Phase 4.5) — pages are **reskinned**, not rebuilt; their hooks/endpoints are
unchanged. Build order is in `11-ui-roadmap.md`.

Endpoint/RPC contracts live in `docs/04-api-specification.md`; this doc only references them.

---

## 2. Navigation shell

A bottom **TabBar** (Discover · Match · Profile) wraps the in-app experience.

- **Mobile:** an `expo-router` tab group. Tabs render once a member is in the app surface
  (outside an active room flow, the room screens present full-screen above the tabs).
- **Web:** the same three destinations as a bottom bar at mobile widths, promoted to a
  top/side nav at desktop width (≥1200px container, docs 09-design-system §6).

| Tab | Destination |
|---|---|
| **Discover** | Placeholder ("Under Construction") — see §3.9. Browse/feed is **post-v1**. |
| **Match** | The room flow: lobby → session → result/resolution (the product core). |
| **Profile** | Auth (signed-out) or account + match history (signed-in). |

The auth surface is only reachable **outside a room** (docs/04 §2: no mid-room sign-in).

---

## 3. Screens

Mockup titles in parentheses. Mobile/web routes are existing (docs/05 §3–§4).

### 3.1 Welcome / Home  ("Welcome to Munch")
- **Routes:** mobile `app/index.tsx` · web `app/page.tsx`.
- **Purpose:** entry. "Ready to eat?" → **Create a Room** (large amber card) or **Join with
  Code** (name + code + Join). "How Munch Works" 3-step explainer.
- **Primitives:** Card, Button (primary/secondary), Field, list rows with colored icons.
- **Wiring:** Create → create-room flow. Join joins **inline here for everyone** — no redirect
  to the join screen. A **guest** types a name + code; a **signed-in** user (resolved `profiles`
  name via `useOwnProfile`) skips the name field ("Joining as {name}"). Both call `join_room` and
  route straight to the lobby on success, with the pending state and inline code-mapped errors on
  this card. The gate is the **resolved name**, not the signed-in flag, so an unresolved/missing
  profile name safely falls back to name entry. Manual code entry no longer hands off to
  `room/join` — that route is the **invite-link target only** now (§3.4). No auth required (guests
  welcome); the sign-in surface lives on the Profile tab (§2/§3.2), not here. There is no mid-room
  sign-in — this only chooses how the name is supplied (docs/04 §2).

### 3.2 Auth / Profile  ("Profile & Sign In Updated")
- **Routes:** mobile `app/auth/*` + `app/history.tsx` (Profile tab) · web `app/auth/*` +
  `app/history/page.tsx`. Reset at `auth/reset`; web OAuth return at `auth/callback`.
- **Purpose:** "Sign in to save your history." **Continue with Google**; OR; email + password
  with **Remember me** / **Forgot**; **Create an account** link. Signed-in: profile + history.
- **Primitives:** Button (`social`, `primary`), Field, divider, Avatar.
- **Wiring:** `signInWithOAuth({google})`, `signUp` / `signInWithPassword`,
  `resetPasswordForEmail` → `updateUser`; history via `get_match_history` (docs/04 §2, §3.11).
- **Invariant:** outside-a-room only; guests have no profile and see the empty/"sign in" state
  (docs/04 §3.11), never an error.

### 3.3 Create Room  ("Create a Room")
- **Routes:** mobile `app/room/create.tsx` · web `app/room/create/page.tsx`.
- **Purpose:** host sets anchor ("Where are we eating?"), cuisine chips, price range tiles,
  radius slider → **Start Room**.
- **Primitives:** AnchorMap (anchor), FoodChip (cuisines), PriceTile, RadiusSlider, Button.
- **Anchor:** set via the **AnchorMap** (MapLibre + OSM tiles, Phase 4.6), **not** manual
  lat/lng. A fixed center pin marks the anchor (= `map.getCenter()` on move-end); device
  geolocation centers the map on open (opt-in, never blocks — falls back to a default center
  with manual pan). A fixed-size amber radius ring sits centered on the map and never moves or
  resizes; the RadiusSlider is the **only** zoom control so the ring represents the selected
  radius and stays fully visible — the map **pans but does not zoom on gesture** (every user
  zoom gesture is disabled). Map-pick only (no geocoding/search); "Where are we eating?" heads the
  map + radius group (no free-text label field — removed in Phase 4.8). OSM "© OpenStreetMap
  contributors" attribution is shown.
- **Name:** a **guest** types it in the "Your name" Field. A **signed-in** host (resolved
  `profiles` name via `useOwnProfile`) skips the field and sees a read-only "Creating as {name}"
  readout instead — they cannot change their name (mirrors §3.4's "Joining as {name}"). The gate
  is the resolved NAME, so a guest and the rare signed-in-but-no-profile state both fall back to
  the editable field; while the profile resolves, a "Loading your profile…" readout shows and
  **Start Room** is disabled. There is no mid-room sign-in (docs/04 §2).
- **Wiring:** `create_room` (then lobby). Filters snapshot into the room. The map only populates
  `anchor_lat`/`anchor_lng`; the `create_room` contract is unchanged — a signed-in host's
  `host_display_name` is sourced from their profile, not retyped.
- **Validation:** on **Start Room**, an empty (or whitespace-only) name shows a friendly inline
  message under the "Your name" Field ("What should we call you? …") and blocks the call — the
  name is the only realistically-reachable failure (the map auto-emits an anchor, the slider
  defaults), and it applies only to the typed-name (guest) path since a signed-in name is
  read-only and non-empty. Any residual anchor/radius failure falls back to a single catch-all
  alert above the button. On-submit only; no live validation.
- **Cancel:** a low-emphasis `text`-variant Button below **Start Room** abandons creation and
  routes to the Match tab (`"/"`, `useCancelCreateRoom`) — matching the room-exit convention
  (`useRoomExit` routes home to `/`). No room exists until **Start Room**, so it is a pure
  client-side discard — no RPC, no cleanup, no invariant impact — and it is disabled while a
  create is in flight.
- **Invariant:** filters are **host-controlled** for the whole room; cuisines from the closed
  `CUISINES` taxonomy (docs/01 §8, invariant §2.2). No provider call fires on any map pan,
  geolocation, or radius-slider change (invariant §2.1).

### 3.4 Join  ("Join with Name and Code") — invite-link target only
- **Routes:** mobile `[code].tsx` (deep link) · web `[code]/page.tsx`. This screen is reached
  **only via an invite link/QR** now — manual code entry joins inline on the Match home (§3.1).
  The bare `app/room/join/index.tsx` / `page.tsx` (blank code) still render the form but nothing
  routes to them.
- **Purpose:** confirm a name and join a room from an invite link. The code is prefilled from the
  link and **locked** (`lockCode`, read-only): a host shared this exact code, so the invitee can't
  edit it. The `JoinRoomForm` is **auth-aware**: a **guest** sees the name field; a **signed-in**
  user sees a "Joining as {name}" readout instead (name field hidden) and joins with their
  `profiles` display name (`useOwnProfile`) — never asked to re-type their name. The gate is the
  resolved name, so a guest and the rare signed-in-but-no-profile state both fall back to name
  entry. No mid-room sign-in: the form only chooses how the name is supplied (docs/04 §2).
- **Primitives:** Field, Button (`secondary` Join, `text` Cancel).
- **Wiring:** `join_room`. Errors: `ROOM_NOT_FOUND`, `ROOM_CLOSED`, `ALREADY_JOINED`,
  `ROOM_IN_SESSION`, `RATE_LIMITED` (docs/04 §3.2) → friendly inline messages. Because the locked
  code can't be edited, a **rejected** code is a dead end: the action switches to a **Cancel**
  button back to Match (`"/"`) rather than a retry (the code stays locked).

### 3.5 Lobby  ("Lobby with QR Code")
- **Routes:** mobile `app/room/[roomId]/lobby.tsx` · web `app/room/[roomId]/lobby/page.tsx`.
- **Purpose:** "Waiting for the crew." Shareable code + QR + tap-to-copy link; **The Squad**
  member grid with presence dots and a presence label (Here/Away); "Invite more"; host sees
  **Start Session**. The squad count is the number of members joined (no per-member status text
  in v1).
- **Primitives:** Card (amber code panel), QR, MemberList (Avatar + `online` dot),
  ProgressPill, Button, LobbyFiltersButton/LobbyFiltersSummary, Sheet, RadiusSlider,
  LeaveRoomControl (ConfirmModal).
- **Wiring:** realtime `room:{room_id}` presence; host `start_session`; `set_presence`.
- **Leave/End:** non-host "Leave room" / host "End room" (`useRoomExit`) confirm via the
  branded **ConfirmModal** (docs/09 §7) — not an OS alert. In the lobby the leave copy notes the
  member can still rejoin (the roster freezes only once a session starts — docs/04 §3.2).
- **Anchor/filters:** the host-set anchor ("Pinned location" + radius) and filters show
  **read-only** to all members (a `LobbyFiltersSummary` card in the column). The host instead gets
  a **"Filters" toggle** (`tune`/sliders pill, on the Squad heading row — Stitch "Lobby") that
  opens the editable anchor-summary + filters + **radius slider** (the same `RadiusSlider` as
  Create Room, not a text field) in a bottom **Sheet** (docs/09 §7). **"Apply filters"** saves via
  `update_room_filters` and closes the sheet on success; an error keeps it open; dismissing
  (X/backdrop/back) discards unsaved edits. The snapshot still flows into `start_session`. No
  editable map in the lobby — the anchor is set on Create Room (§3.3, Phase 4.6).
- **Invariant:** only the host can start; aggregate presence only.

### 3.6 Swiping Session  ("Swiping Session")
- **Routes:** mobile `app/room/[roomId]/session.tsx` · web `app/room/[roomId]/session/page.tsx`.
- **Purpose:** the core loop. The Decision Card (photo, distance pill, name, rating, price •
  cuisine, food chips) + pass/like action row. Header shows the Munch brand only — radius is
  host-controlled (set on Create Room, editable in the lobby), not adjustable while swiping.
- **Primitives:** Decision Card (existing `swipe-card`), swipe action row, ProgressPill,
  LeaveRoomControl (ConfirmModal — the session leave copy warns the roster is frozen, so
  leaving can't be undone with a rejoin).
- **Wiring:** `get_deck` + client `shuffle` (`@munch/core`); each swipe → `submit_swipe`;
  realtime `session:{id}` status + aggregate progress; match event → result.
- **Invariants:** **no provider call on swipe** (§2.1); the card **never declares a match**
  (server-authoritative, §2.3); **drop the middle bookmark button** — like/pass only (v1).

### 3.7 Match  ("It's a Match!")
- **Routes:** mobile `app/room/[roomId]/result.tsx` · web `app/room/[roomId]/result/page.tsx`.
- **Purpose:** "Everyone agreed!" confetti reveal — full photo card, name, distance • price,
  rating; **Get Directions** (external maps deep link), **Share Match** (OS share sheet).
- **Primitives:** Card, Chip, Button (primary/outline), confetti (reduced-motion aware).
- **Wiring:** the match payload from `submit_swipe` / realtime `match` event; signed-in users
  get a `match_history` row (written server-side, docs/03 §3.9).
- **Invariant:** Get Directions/Share use data we already hold — **no provider API call**.

### 3.8 Host Resolution  ("Host Resolution")
- **Routes:** rendered by the session route's resolution view (mobile
  `features/session/resolution-view.tsx`; web equivalent) when status is
  `awaiting_host_resolution`.
- **Purpose:** "No Unanimous Match Yet." **Group's Top Pick** Decision Card + "N/M friends
  liked this"; **Settle for this**; **Widen the Search** (radius slider + cuisine chips +
  price tiles + **Fetch New Deck**).
- **Primitives:** Card, ProgressPill, RadiusSlider, FoodChip, PriceTile, Button.
- **Wiring:** `get_resolution_ranking` (host); `resolve_session` accept_top / widen
  (docs/04 §3.8–§3.9). Non-host members see a passive **"waiting on host"** state.
- **Invariants:** ranking is **closest-to-unanimous** (fewest passes → rating → distance,
  §2.4); the pill is an **aggregate count, never per-member identity** (§3); widen makes
  **exactly one** extra provider fetch for unseen places (§2.1). Widen is **broaden-only**
  (feature spec §5): the radius slider is floored at the session radius (only increases);
  the session's cuisines/prices are **locked-on** and the host may only **add** more or tap
  **Any** to clear a restriction; a filter that is already "all" shows disabled ("already
  included"); open-now is not adjustable here. The shared `@munch/core` `isNonNarrowingWiden`
  rule disables a narrowing submit, and the server rejects one (`VALIDATION_ERROR`).

### 3.9 Discover  ("Discover - Under Construction")
- **Routes:** new placeholder under the Discover tab (both platforms).
- **Purpose:** intentional placeholder. A browse/discovery feed is **post-v1** (docs/07 §8);
  v1 is room-based. Ships as a styled "coming soon" state so the tab isn't empty.

---

## 4. Cross-cutting page states

Every data-backed screen defines, using the design-system primitives:

- **Loading** — skeletons/spinners in card shapes (not layout shift).
- **Empty** — e.g. empty initial deck routes straight to resolution/widen (docs/04 §3.5);
  guest history shows the "sign in to save" state (§3.11).
- **Error** — friendly copy mapped from the standard `{error:{code,message}}` shape; never
  raw provider/DB text (docs/04 §1, docs/06).
- **Realtime transitions** — status changes (`active → awaiting_host_resolution →
  matched/resolved`, or `→ cancelled` on host leave) are driven by the session channel, not
  polling, and route the screen accordingly (docs/02 §6, docs/04 §4).
