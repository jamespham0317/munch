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
  Code** (name + code + Join). "How Munch Works" 3-step explainer. No inline Munch brand row here
  — it now heads the room-flow screens (Create Room, Match, Host Resolution).
- **Primitives:** Card, Button (primary/secondary), Field, list rows with colored icons.
- **Wiring:** Create → create-room flow. Join joins **inline here for everyone** — no redirect
  to the join screen. A **guest** types a name + code; a **signed-in** user (resolved `profiles`
  name via `useOwnProfile`) skips the name field, seeing their name in a locked, lock-iconed
  read-only field instead. Both call `join_room` and
  route straight to the lobby on success, with the pending state and inline code-mapped errors on
  this card. The gate is the **resolved name**, not the signed-in flag, so an unresolved/missing
  profile name safely falls back to name entry. Manual code entry no longer hands off to
  `room/join` — that route is the **invite-link target only** now (§3.4). No auth required (guests
  welcome); the sign-in surface lives on the Profile tab (§2/§3.2), not here. There is no mid-room
  sign-in — this only chooses how the name is supplied (docs/04 §2).

### 3.2 Auth / Profile  ("Profile & Sign In Updated")
- **Routes:** mobile `app/auth/*` + `app/history.tsx` (Profile tab) · web `app/auth/*` +
  `app/history/page.tsx`. Reset at `auth/reset`; account-created success at `auth/welcome`; web
  OAuth return at `auth/callback`.
- **Purpose:** "Sign in to save your history." **Continue with Google**; OR; email + password
  with **Remember me** / **Forgot**; **Create an account** link. Signed-in: profile + history.
- **Primitives:** Button (`social`, `primary`), Field, divider, Avatar.
- **Wiring:** `signInWithOAuth({google})`, `signUp` / `signInWithPassword`,
  `resetPasswordForEmail` → `updateUser`; history via `get_match_history` (docs/04 §2, §3.11).
- **Forgot password (`auth/reset`, Stitch "Forgot Password"):** the `PasswordResetView` styling
  mirrors the Join-via-link page. The two **form steps** (request, set-new-password) put a
  tonal-circle `IconBadge` (info → request, lock → set-new-password) + headline ("Lost your way?" /
  "Set a new password") in a centered **hero above** a full-width `Card` that holds the form; the
  **message states** (mail-check → "sent", error) keep the icon + message inside the `Card`. The
  email `Input` has **no** leading icon (the password field keeps its lock); the primary Button is
  **flat** (not `elevated`) with a trailing arrow. A **"Back"** control (the Join page's `text`
  Button with a leading arrow) `router.replace`s to the Profile tab (`/history`) — on mobile that
  carries `/history` in **from the left** via the `(tabs)` `animationTypeForReplace: "pop"`. The
  route passes the shell **no** title/subtitle — the view owns its per-state headline, so
  `FullScreenView`/`Screen` contributes only the brand row + cream canvas. On **mobile** the screen
  is **vertically centred** (the `Screen` scroll content is `flexGrow`-centred, falling back to
  scroll on overflow — e.g. with the keyboard up).
- **Account created (`auth/welcome`, Stitch "Account Created Successfully"):** the celebratory
  success screen shown after `AuthPanel` registers an email+password account (`register` `onSuccess`
  → `router.push("/auth/welcome")`, replacing the old inline "check your email" line). Standalone
  full-screen (`AccountCreatedView` inside the shared shell — web `FullScreenView`, mobile `Screen`,
  the brand row + cream canvas, no tab nav), like the Forgot Password page, and **vertically centred
  on mobile** (the `Screen` scroll content is `flexGrow`-centred, falling back to scroll on overflow).
  A centered hero (tonal-circle `IconBadge` with a party-popper glyph, `display-lg-mobile` "Welcome to
  the Feast!", `body-lg` subcopy), then a single **"Go to Sign In"** button — the mockup's secondary
  "Go to Profile" and the earlier "Back" control are both dropped. **Email confirmation stays ON**
  (`supabase/config.toml`), so the user is **not** signed in here: the copy points them to confirm
  their email, the CTA is "Go to Sign In" (not the mockup's "Start a Session"), and it
  `router.replace("/history")` to the Profile sign-in surface. Presentation only — no mutation, no
  provider call (CLAUDE.md §4).
- **Invariant:** outside-a-room only; guests have no profile and see the empty/"sign in" state
  (docs/04 §3.11), never an error.

### 3.3 Create Room  ("Create a Room")
- **Routes:** mobile `app/room/create.tsx` · web `app/room/create/page.tsx`.
- **Purpose:** host sets anchor ("Where are we eating?"), cuisine chips, price range tiles,
  radius slider → **Start Room**. Topped by the **Munch brand row** (mobile).
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
  `profiles` name via `useOwnProfile`) skips the field and sees their name in a locked, lock-iconed
  read-only "Your name" field instead — they cannot change it (identical to §3.4's locked code field). The gate
  is the resolved NAME, so a guest and the rare signed-in-but-no-profile state both fall back to
  the editable field; while the profile resolves, a "Loading your profile…" readout shows and
  **Start Room** is disabled. There is no mid-room sign-in (docs/04 §2).
- **Wiring:** `create_room` (then lobby). Filters snapshot into the room. The map only populates
  `anchor_lat`/`anchor_lng`; the `create_room` contract is unchanged — a signed-in host's
  `host_display_name` is sourced from their profile, not retyped.
- **Validation:** on **Start Room**, an empty (or whitespace-only) name shows a terse inline
  message under the "Your name" Field ("Enter your name") and blocks the call; the form also
  **scrolls the name field into view and focuses it** (opening the mobile keyboard) so the host
  can correct it immediately — the name is the only realistically-reachable failure (the map
  auto-emits an anchor, the slider defaults), and it applies only to the typed-name (guest) path
  since a signed-in name is read-only and non-empty. Any residual anchor/radius failure falls
  back to a single catch-all alert above the button (no scroll). On-submit only; no live
  validation.
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
  link and **locked** (`lockCode`, read-only, shown bold but at the name field's body size as the
  raw 6 digits — no grouping dash — so the value submitted to `join_room` matches what's displayed
  and validation is
  unchanged): a host shared this exact code, so the invitee can't edit it. The `JoinRoomForm` is
  **auth-aware**: a **guest** sees the name field; a **signed-in** user sees their name in a locked,
  lock-iconed read-only "Your name" field instead and joins with their `profiles` display name (`useOwnProfile`)
  — never asked to re-type their name. The gate is the resolved name, so a guest and the rare
  signed-in-but-no-profile state both fall back to name entry. No mid-room sign-in: the form only
  chooses how the name is supplied (docs/04 §2).
- **Style:** mirrors the Sign In page (`HistoryView` signed-out state). A centered **hero** — an
  80×80 round amber circle (utensils glyph) with the `title` + `subtitle` centered below it — sits
  **above** a **full-width** `Card` (the icon is no longer inside the card). The `title`/`subtitle`
  copy is passed into `JoinRoomForm` by each route (so the form owns the hero, like `HistoryView`):
  "Join with Code" (manual) / "Join the Squad" (invite link). The Inputs are plain bordered fields
  (default `radii.md` corners, matching Sign In); the **name** field is labelled "Your name" with no
  leading icon, and the **room-code** field carries a leading lock icon; the primary action is a
  **flat** "Join the Squad" Button (not
  elevated) with a trailing groups icon, followed by a low-emphasis `text` "Back" Button (leading
  back-arrow) that routes to `"/"`; a lightbulb `tip` sits centered below the card. The locked
  invite-code field keeps a dimmed read-only fill (`surface-highest`, muted, bold body-sized type) to signal
  it can't be edited, on the same plain base. The page keeps the shared `FullScreenView`/`Screen`
  shell (the form supplies the title/subtitle hero, so `FullScreenView` renders only its brand row +
  column). Web adds ambient blur-blobs; mobile omits them.
- **Primitives:** Field, Input (plain), Card, Button (`primary` "Join the Squad", `text` "Back").
- **Wiring:** `join_room`. Errors: `ROOM_NOT_FOUND`, `ROOM_CLOSED`, `ALREADY_JOINED`,
  `ROOM_IN_SESSION`, `RATE_LIMITED` (docs/04 §3.2) → friendly inline messages. The persistent
  "Back" Button (`router.replace("/")`) is always the exit; because the locked code can't be edited,
  a **rejected** code is a dead end, so the primary Join button is **disabled** and Back is the way
  out rather than a futile retry.

### 3.5 Lobby  ("Lobby with QR Code")
- **Routes:** mobile `app/room/[roomId]/lobby.tsx` · web `app/room/[roomId]/lobby/page.tsx`.
- **Purpose:** "Waiting for the crew." Shareable code + QR + tap-to-copy link; **The Squad**
  member grid with presence dots and a presence label (Here/Away); "Invite more"; host sees
  **Start Swiping**. The squad count is the number of members joined (no per-member status text
  in v1).
- **Primitives:** Card (amber code panel), QR, MemberList (Avatar + `online` dot),
  ProgressPill, Button, LobbyFiltersButton/LobbyFiltersSummary, Sheet, AnchorMap, RadiusSlider,
  LeaveRoomControl (ConfirmModal).
- **Wiring:** realtime `room:{room_id}` presence; the `rooms` settings channel
  (`subscribeRoomSettings`) that pushes a host's anchor/filter edits to every member
  live; host `start_session`; `set_presence`.
- **Leave/End:** non-host "Leave room" / host "End room" (`useRoomExit`) confirm via the
  branded **ConfirmModal** (docs/09 §7) — not an OS alert. In the lobby the leave copy notes the
  member can still rejoin (the roster freezes only once a session starts — docs/04 §3.2).
- **Anchor/filters:** the host-set anchor and filters show to all members; the anchor
  is a **map** (the `AnchorMap`), not a "Pinned location" caption. **Non-hosts** see a
  **read-only, non-interactive** map (centered on the anchor with the radius ring, pan + zoom
  disabled) plus a `… km radius` caption and the read-only filter summary (a `LobbyFiltersSummary`
  card in the column). The **host** gets a **"Filters" toggle** (`tune`/sliders pill, on the Squad
  heading row — Stitch "Lobby") that opens, in a bottom **Sheet** (docs/09 §7): an **editable
  `AnchorMap`** (the same map as Create Room — pan to set the anchor) headed "Where are we eating?",
  the **radius slider** (drives the map zoom, the same `RadiusSlider` as Create Room) + filters.
  **"Apply filters"** saves the staged anchor + radius + filters via `update_room_filters`
  (anchor sent as `anchor_lat`/`anchor_lng`, already in the contract — docs/04 §3.3) and closes the
  sheet on success; an error keeps it open; dismissing (X/backdrop/back) discards unsaved edits.
  Edits propagate live to every member via the `rooms` channel; the snapshot still flows into
  `start_session`. The lobby map requests **no** geolocation — it seeds from the room's current
  anchor (Create Room is where device location centers the map, §3.3).
- **Invariant:** only the host can start; anchor + filters stay **host-controlled** (§2.2); a map
  pan / slider / live update makes **no** provider call (§2.1); aggregate presence only.

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
- **Purpose:** "Everyone agreed!" confetti reveal — a top bar with the **Munch brand row** (left)
  beside the close ✕ (right; mobile), then a **centered** header block (an amber
  "It's a Match!" badge with a party-popper glyph, headline, subcopy), then a full photo card
  with name, distance • price, rating, and **Get Directions** (external maps deep link) as the
  primary action **inside** the card; **Share Match** (OS share sheet) is a secondary button
  below the card.
- **Primitives:** Card, Chip, Button (primary/ghost), ProgressPill (`tone="match"`),
  confetti (reduced-motion aware).
- **Wiring:** the match payload from `submit_swipe` / realtime `match` event; signed-in users
  get a `match_history` row (written server-side, docs/03 §3.9).
- **Invariant:** Get Directions/Share use data we already hold — **no provider API call**.

### 3.8 Host Resolution  ("Host Resolution")
- **Routes:** rendered by the session route's resolution view (mobile
  `features/session/resolution-view.tsx`; web equivalent) when status is
  `awaiting_host_resolution`.
- **Purpose:** "No Unanimous Match Yet." **Group's Top Pick** Decision Card + "N/M friends
  liked this"; **Settle for this**; **Widen the Search** (radius slider + cuisine chips +
  price tiles + **Fetch New Deck**). The **Munch brand row** heads both the host view and the
  non-host "waiting on host" state (mobile).
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
