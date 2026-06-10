# API Specification

**Project:** Munch
**Document:** API Specification
**Status:** Draft v1 — for build
**Last updated:** 2026-05-25

---

## 1. Overview

The backend is Supabase. The client interacts with the system three ways:

1. **Auth** — Supabase Auth (anonymous for guests; email + password or Google OAuth for
   accounts, signed in only outside a room).
2. **Realtime** — Supabase Realtime subscriptions for live room/session state.
3. **RPCs / Edge Functions** — for all writes that need server authority (joining,
   starting sessions, swiping + match check, resolution, provider calls).

Direct table reads happen through the Supabase client under RLS. Mutations that must be
authoritative go through the endpoints below. All endpoints assume an authenticated
Supabase session (anonymous sessions count). Errors use a consistent shape:

```json
{ "error": { "code": "ROOM_NOT_FOUND", "message": "No room for that code." } }
```

Common error codes: `UNAUTHENTICATED`, `FORBIDDEN`, `ROOM_NOT_FOUND`, `ROOM_CLOSED`,
`ROOM_IN_SESSION`, `NOT_HOST`, `SESSION_INVALID_STATE`, `ALREADY_JOINED`, `RATE_LIMITED`,
`PROVIDER_ERROR`, `VALIDATION_ERROR`. `ROOM_IN_SESSION` (Phase 4.7) is raised by `join_room`
when a session already exists for the room — the roster freezes at session start, so no new or
returning member can join once swiping has begun (§3.2).

---

## 2. Auth

Handled by the Supabase Auth SDK on the client. There are three identity paths — an
anonymous guest and two account methods (email + password, Google OAuth). The api-client owns
the helpers (`packages/api-client/src/auth.ts`); raw auth errors are mapped to the safe
`ApiError` shape, never surfaced.

- **Guest:** `signInAnonymously()` → an anonymous session used to create the
  `room_members` row. No profile created. A guest joins with a name only and **stays a guest**
  for the life of any room they join (see "No mid-room sign-in" below).
- **Account — email + password:** `signUp({ email, password })` registers a new account and,
  with email confirmation enabled, sends a confirmation email; after the user confirms,
  `signInWithPassword({ email, password })` establishes the session. A `profiles` row is
  written with the chosen display name on first sign-in. Returning users sign in directly with
  `signInWithPassword`.
- **Account — Google OAuth:** `signInWithOAuth({ provider: 'google' })` returns an
  authenticated session via the provider redirect (web: standard OAuth redirect; mobile: open
  the provider URL with `expo-web-browser`, capture the `munch://` deep link, then
  `exchangeCodeForSession` for the PKCE round-trip). A `profiles` row is written on first sign-in.
- **Password reset (email accounts):** `resetPasswordForEmail(email)` sends a recovery link;
  the user sets a new password via `updateUser({ password })` on the recovery session. Google
  accounts manage their own credentials.

**No mid-room sign-in.** Authentication (register, sign in, Google) is available **only outside
a room** — on the home/landing surface. Once a member has joined a room (lobby **or** active
session), the auth surface is hidden and their identity is **fixed for that room**. There is
**no in-place guest→account upgrade**: a guest who joined with a name remains a guest for that
room, and signing in is always a fresh/existing real account (its own `auth.uid()`) established
**before** creating or joining a room. This removes the earlier OTP design's in-place
anonymous-upgrade machinery (`updateUser`/`verifyOtp(type:'email_change')`); because no flow
converts an anonymous identity in place, OAuth/password redirects never need to preserve the
anonymous session. The guest-vs-account distinction remains the **presence of a `profiles`
row**, not a null `user_id`.

- **Deferred (post-v1):** additional OAuth providers (e.g. Apple) and magic-link (tappable-link)
  verification. See `docs/07-initial-roadmap.md`.

---

## 3. RPC / Edge Function endpoints

Naming below is logical; implement as Supabase RPC (`rpc/<name>`) or Edge Function
(`functions/v1/<name>`) as convenient. All take/return JSON.

**Implementation note (Phase 1).** A privileged write needs a `security definer` RPC **only**
when it crosses an RLS boundary. `create_room`, `join_room`, and `update_room_filters` do
(`rooms` / `room_members` have no insert policy on purpose, and `join_room` must read a room by
code that the caller is not yet a member of), so they are RPCs (`supabase/migrations/0005`).
`set_presence`, `leave_room`, and `end_room` do **not**: they only touch the caller's own
`room_members` row or, for the host, `rooms.is_active` — both already permitted by the 0003
policies (`room_members_update_own`, `rooms_update_host`). So they are implemented as **direct
RLS-scoped table writes in the api-client** (`packages/api-client/src/endpoints/rooms.ts`), not
RPCs — the smallest change that satisfies the contract.

### 3.1 `create_room`

Creates a room and the host member row.

- **Auth:** any authenticated session (guest or user).
- **Request:**
  ```json
  {
    "host_display_name": "Alex",
    "anchor_lat": 51.053,
    "anchor_lng": -114.085,
    "filters": {
      "open_now": true,
      "cuisines": ["italian", "japanese"],
      "price_levels": ["1", "2", "3"]
    },
    "default_radius_m": 3000
  }
  ```
- **Response:**
  ```json
  {
    "room": { "id": "uuid", "code": "428913" },
    "member": { "id": "uuid", "role": "host", "display_name": "Alex" }
  }
  ```
- **Notes:** generates a unique 6-digit code; sets `host_member_id`. Rate-limited.

---

### 3.2 `join_room`

Joins an existing room by code (the link/QR resolves to the same code).

- **Auth:** any authenticated session.
- **Request:**
  ```json
  { "code": "428913", "display_name": "Sara" }
  ```
- **Response:**
  ```json
  {
    "room": { "id": "uuid", "code": "428913" },
    "member": { "id": "uuid", "role": "member", "display_name": "Sara" },
    "members": [ { "id": "uuid", "display_name": "Alex", "role": "host", "left_at": null } ]
  }
  ```
- **Roster freeze (Phase 4.7).** After the `ROOM_CLOSED` check and before the insert, the RPC
  raises `ROOM_IN_SESSION` if a `sessions` row already exists for the room — joining is
  lobby-only, so the cohort can only shrink once a session starts. A member who left **in the
  lobby** (no session yet) may still re-join: the same `room_members` row is reactivated
  (`left_at = NULL`, fresh `joined_at`) rather than tripping `ALREADY_JOINED`.
- **Errors:** `ROOM_NOT_FOUND`, `ROOM_CLOSED`, `ROOM_IN_SESSION`, `ALREADY_JOINED`,
  `RATE_LIMITED`.

---

### 3.3 `update_room_filters` (host only)

Updates room anchor/filters/default radius while in `lobby`.

- **Auth:** host member of the room.
- **Request:** same `filters` / `anchor` / `default_radius_m` shape as `create_room`
  (all fields optional; only provided fields change).
- **Response:** `{ "room": { ...updated } }`
- **Errors:** `NOT_HOST`, `SESSION_INVALID_STATE` (cannot edit once a session is active).

---

### 3.4 Cosmetic presence (Here/Away) + liveness heartbeat

There is **no `set_presence` write** anymore (Phase 4.7 dropped `room_members.is_present`).
Activity status is split into two mechanisms, **neither of which matchmaking ever reads**:

- **Cosmetic Here/Away — Supabase Realtime Presence.** The client tracks
  `{ memberId, focused }` on the `room:{room_id}` channel via `channel.track()` (the api-client
  helpers `trackPresence` / `setFocused` / `onPresenceSync`). `focused` comes from
  `visibilitychange` (web) / `AppState` (mobile). **Here** = present-and-focused, **Away** =
  present-but-not-focused, **no dot** = absent from the channel. Ephemeral, zero DB writes, never
  read by any matchmaking code. See §4.
- **Authoritative liveness — `heartbeat`.** The client upserts its own `member_heartbeats` row
  (`{ member_id, last_seen_at: now() }`) every `HEARTBEAT_INTERVAL_S` (10s) while it has a room
  surface open. RLS scopes the upsert to the caller's own member row. This is the input to the
  disconnect sweeper (`prune_absent_members`, §3.10), **not** a presence indicator: an Away member
  keeps heart­beating and stays in the cohort; only a member who stops heartbeating past
  `MEMBER_ABSENCE_GRACE_S` (45s) is removed.

---

### 3.5 `start_session` (host only)

Transitions room to `active`, fetches the deck once via the provider, caches it.

- **Auth:** host member.
- **Request:**
  ```json
  { "radius_m": 3000 }
  ```
- **Response:**
  ```json
  {
    "session": { "id": "uuid", "status": "active", "radius_m": 3000 },
    "deck_size": 42
  }
  ```
- **Behavior:** snapshots current room filters into the session; calls the provider
  abstraction **once**; normalizes and writes `restaurants` + `cached_decks`
  (`added_round = 0`). The deck itself is read via subscription/table read, not returned
  inline beyond its size. **Empty initial pool:** if the (filtered) provider call returns
  zero restaurants, the session starts in **`awaiting_host_resolution`** rather than `active`
  — the response carries `deck_size: 0` and that status, routing the host straight to the
  widen control via the existing resolution path instead of stranding the room on a swipe
  screen with no cards (a Phase-4 decision; no new empty-state mechanic). The single provider
  call still happens (`provider_calls` is `1`).
- **Implementation:** an **Edge Function** (`supabase/functions/start-session/`), not an RPC,
  because the provider key is server-only (CLAUDE.md §2.1, §3) and must never reach a client
  bundle — only an Edge Function can hold it. It is the **only** Phase-2 endpoint that touches
  the provider; it emits a structured `start_session.ok` log line carrying `provider_calls`
  (must be `1`) as the §2.1 invariant verifier.
- **Errors:** `NOT_HOST`, `SESSION_INVALID_STATE`, `PROVIDER_ERROR`.

---

### 3.6 `get_deck`

Returns the cached deck for a session (the client derives its own shuffle order).

- **Auth:** member of the session's room.
- **Request:** `{ "session_id": "uuid" }`
- **Response:**
  ```json
  {
    "restaurants": [
      {
        "id": "uuid",
        "name": "Pizzeria Libretto",
        "lat": 51.05, "lng": -114.08,
        "rating": 4.4,
        "price_level": "2",
        "cuisines": ["italian"],
        "photo_url": "https://...",
        "is_open_now": true,
        "distance_m": 540
      }
    ]
  }
  ```
- **Notes:** `distance_m` computed from the room anchor. Shuffle order is deterministic
  client-side (seed = member id + session id), so it is not part of the response.

---

### 3.7 `submit_swipe`

Records a like/pass and runs the authoritative match check. This is the hot path.

- **Auth:** member of the session's room.
- **Request:**
  ```json
  { "session_id": "uuid", "restaurant_id": "uuid", "decision": "like" }
  ```
- **Response (no match):**
  ```json
  { "recorded": true, "match": null }
  ```
- **Response (match):**
  ```json
  {
    "recorded": true,
    "match": {
      "restaurant_id": "uuid",
      "restaurant_name": "Pizzeria Libretto",
      "resolution": "unanimous"
    }
  }
  ```
- **Behavior:** upserts the swipe (idempotent on `(session, member, restaurant)`); on a
  `like`, transactionally checks whether the restaurant now has likes from all **active**
  members (`left_at IS NULL`). If so, writes `matches`, sets session `matched`, emits a realtime
  event, and records `match_history` for every signed-in active member (see §3.9). When the swipe
  produces **no** match, a lightweight exhaustion check runs: if every active
  member has now swiped every card in the session's `cached_decks`, the session moves
  `active → awaiting_host_resolution` (non-terminal — no `ended_at`). The match check runs
  **first**, so a swipe that is simultaneously the last card and the last unanimous like ends
  `matched`, never `awaiting_host_resolution`. The client learns of the transition via the
  realtime status event, not this response (whose shape is unchanged).
- **Implementation:** a **security-definer RPC** (`submit_swipe`, migration 0010, replaced via
  `create or replace` in migration 0014 to add the exhaustion tail, and again in 0016 to call
  `record_match_history` on a unanimous match). It is security definer because the
  authoritative match check must read **all** members' swipes in one transaction, which the
  per-member `swipes_select_own` RLS policy would otherwise block (CLAUDE.md §2.3).
  The exhaustion check is the `is_deck_exhausted(session)` helper (0014), active-member-scoped
  like the match check (`left_at IS NULL`; both cohort predicates swapped from `is_present` in
  migration 0017). Failures are raised as the bare error code in the exception message
  (`UNAUTHENTICATED` / `FORBIDDEN` / `SESSION_INVALID_STATE` / `VALIDATION_ERROR`); the
  api-client maps them and never surfaces raw DB text.
- **Errors:** `SESSION_INVALID_STATE`, `VALIDATION_ERROR`.

---

### 3.8 `get_resolution_ranking` (host)

Returns the closest-to-unanimous ranking for the host resolution prompt.

- **Auth:** host member.
- **Request:** `{ "session_id": "uuid" }`
- **Response:**
  ```json
  {
    "ranking": [
      {
        "restaurant_id": "uuid",
        "name": "Pizzeria Libretto",
        "pass_count": 1,
        "like_count": 4,
        "member_count": 5,
        "rating": 4.4,
        "distance_m": 540
      }
    ]
  }
  ```
- **Notes:** ordered by `pass_count asc`, then `rating desc` (nulls last), then `distance_m asc`
  (closest-to-unanimous, CLAUDE.md §2.4). Top item is the suggested pick.
- **Implementation:** a **security-definer RPC** (`get_resolution_ranking`, migration 0015,
  replacing the 0004 stub). Security definer because it must read **all** active members'
  swipes (broader than `swipes_select_own`, like `submit_swipe`). **Host-only:** the internal
  host check raises `NOT_HOST` for a non-host (and `UNAUTHENTICATED` if unauthenticated) as the
  bare exception message; non-host members never call it — their UI is the passive
  "waiting on host" state keyed off the realtime status. **Active-member-scoped:** `pass_count`
  / `like_count` count only active members (`left_at IS NULL`; swapped from `is_present` in
  migration 0017) and `member_count` is the active-member count. `distance_m` is computed in SQL
  via `haversine_m` against the room anchor (not deferred to the app).
- **Errors:** `UNAUTHENTICATED`, `NOT_HOST`.

---

### 3.9 `resolve_session` (host only)

Host accepts the top pick or widens criteria.

- **Auth:** host member; session in `awaiting_host_resolution`.
- **Request (accept):**
  ```json
  { "session_id": "uuid", "action": "accept_top", "restaurant_id": "uuid" }
  ```
- **Request (widen):**
  ```json
  {
    "session_id": "uuid",
    "action": "widen",
    "radius_m": 6000,
    "filters": { "price_levels": ["1","2","3","4"] }
  }
  ```
- **Response (accept):**
  ```json
  { "session": { "status": "resolved" },
    "match": { "restaurant_id": "uuid", "restaurant_name": "Pizzeria Libretto",
               "resolution": "host_accepted_top" } }
  ```
- **Response (widen):**
  ```json
  { "session": { "status": "active" }, "new_restaurants": 17 }
  ```
- **Behavior (accept):** writes `matches` (`resolution = 'host_accepted_top'`, idempotent on
  `session_id`), sets the session `resolved` with `matched_restaurant_id` + `ended_at`, records
  `match_history` for every signed-in active member (via the service-role `record_match_history`
  rpc — the same writer `submit_swipe` uses, see §3.9 of the schema), and announces it to all
  members via the realtime status/match events. **Zero** provider calls. The `restaurant_id`
  must be a card already in the session's deck (`VALIDATION_ERROR` else).
- **Behavior (widen):** **exactly one** additional provider fetch for restaurants **not already
  in the deck** (`excludeProviderRefs` = every deck `provider_ref`); appends them to
  `cached_decks` with `added_round = n+1`; persists the widened `radius_m`/`filters` onto the
  session snapshot (omitted fields keep their current value); returns the session to `active`.
  Earlier swipes/likes are never deleted — they still count toward a later unanimous match.
- **Implementation:** a single **Edge Function** (`resolve-session/`) handling **both** actions.
  It lives server-side because `widen` requires the server-only provider key (CLAUDE.md §2.1/§3);
  `accept_top` rides along in the same function (service-role writes to `matches` + `sessions`)
  so there is one endpoint and the host check + `awaiting_host_resolution` state guard are shared.
  Both actions are **host-only** (`NOT_HOST` otherwise) and reject unless the session is in
  `awaiting_host_resolution` (`SESSION_INVALID_STATE`). It mirrors `start_session`: a user JWT
  identifies the caller, a service-role client does the privileged work, the provider call is
  counted at the boundary, and a structured log line (`resolve_session.accept.ok` with
  `provider_calls: 0`, or `resolve_session.widen.ok` with `provider_calls: 1`) is the §2.1
  invariant verifier. The restaurant-upsert / cached-deck-insert helpers are shared with
  `start_session` via `supabase/functions/_shared/deck.ts`.
- **Errors:** `NOT_HOST`, `SESSION_INVALID_STATE`, `VALIDATION_ERROR`, `PROVIDER_ERROR`.

---

### 3.10 `leave_room` / `end_room` + auto-removal

Removing a member changes the **active cohort**, so it must read all members' swipes and write
matches/sessions transactionally. Phase 4.7 promoted `leave_room` from a direct table write to a
**security-definer RPC** (migration 0018).

- `leave_room(p_room_id)` — resolves the caller's own member row, sets `left_at = now()`, and
  **deletes that member's swipes** for the room's non-terminal sessions (so they stop counting
  and can't resurrect). Then:
  - **Host caller →** the room ends: `cancel_active_session(p_room_id)` cancels any non-terminal
    session (`cancelled`) and `rooms.is_active = false` soft-closes the room. Host role is **not**
    transferred (the resolved policy for the former CLAUDE.md §9 open decision).
  - **Non-host caller →** for each non-terminal session: if the removal leaves **zero** active
    members, cancel the session + close the room (an emptied room ends `cancelled`); otherwise
    call `recheck_unanimous_on_membership_change(session)` so a leave that makes the remaining
    likes unanimous fires the match **immediately**, with no further swipe (min cohort = 1).
  - **Returns** `{ member: { id, left_at }, room_ended: bool }`. Errors are the bare codes
    `UNAUTHENTICATED` / `FORBIDDEN` (non-member caller).
- `end_room` (host) — soft-closes the room (`is_active = false`) and cancels any non-terminal
  session. A host leaving via `leave_room` produces the same outcome.
- **Immediate recheck — `recheck_unanimous_on_membership_change(p_session_id)`** (security
  definer, migration 0018). For a non-terminal session (`active` or `awaiting_host_resolution`),
  it finds any cached-deck restaurant liked by **all** active members (active count > 0); if one
  or more qualify it picks by closest-to-unanimous order (rating desc nulls last, distance asc —
  all have 0 active passes) and declares the match: insert `matches` (`resolution = 'unanimous'`,
  `on conflict (session_id) do nothing`), flip the session `matched` (guarded on a non-terminal
  status), and call `record_match_history`. Idempotent, so a swipe-path check and a leave-path
  recheck racing collapse to exactly one match.
- **Auto-removal — `prune_absent_members()`** (security definer, migration 0018). Removes every
  active member whose `COALESCE(member_heartbeats.last_seen_at, room_members.joined_at)` is older
  than `MEMBER_ABSENCE_GRACE_S` (45s — duplicated in SQL with a keep-in-sync comment pointing at
  `@munch/core`), applying the **same** removal path as `leave_room` (delete swipes → host-close
  OR empty-cancel OR recheck). A disconnected host is removed exactly like any member (no special
  longer grace). Scheduled on **`pg_cron`** every `SWEEP_INTERVAL_S` (15s); if `pg_cron` is
  unavailable in the target environment, a scheduled Edge Function calling the same RPC is the
  documented fallback.
- `cancel_active_session(p_room_id)` — the **security-definer RPC** (migration 0011) the
  host-close and empty-cohort paths call to move any non-terminal session to `cancelled`. It is
  the only path that mutates `sessions.status` outside of `start_session`, `submit_swipe`, the
  membership recheck, and `resolve_session`, because `sessions` has no update RLS policy by
  design. It is a no-op (no raise) when the room has no non-terminal session, so a host leaving
  from the lobby still succeeds.

---

### 3.11 `get_match_history` (signed-in users)

Returns the caller's own saved match outcomes for the history screen.

- **Auth:** any authenticated caller. A **guest** (anonymous, no `profiles` row) simply has no
  rows and gets `[]` — the history screen keys the "sign in to save your matches" state off the
  auth/profile state, not off an error from this read.
- **Request:** none (scoped to the caller).
- **Response:**
  ```json
  {
    "history": [
      { "id": "uuid", "match_id": "uuid", "restaurant_name": "Pizzeria Libretto",
        "restaurant_photo_url": "https://...", "participant_names": ["Ada", "Grace"],
        "decided_at": "2026-06-01T12:00:00Z", "created_at": "2026-06-01T12:00:01Z" }
    ]
  }
  ```
- **Implementation:** a **direct RLS-scoped table read** in the api-client (`getMatchHistory`),
  not an RPC — the `match_history_select_own` policy (migration 0003) scopes it to
  `user_id = auth.uid()` rows, ordered `decided_at desc`. Rows are mapped snake→camel at the
  api-client boundary (docs/06 §5). Rows are written only by `record_match_history` (schema §3.9),
  never by the client.
- **Errors:** mapped via the standard shape; an RLS denial surfaces as `FORBIDDEN`, never raw DB
  text.

---

## 4. Realtime channels

Clients subscribe to per-room channels for live state. Recommended events:

- **`room:{room_id}` — membership (`postgres_changes` on `room_members`)** — authoritative
  join/leave/role changes; this is what tells a client the **active roster** changed (and routes
  a removed member out). `subscribeRoom` invalidates the members query on these. The cohort lives
  in the row (`left_at IS NULL`), not in presence.
- **`room:{room_id}` — cosmetic Presence (`channel.track()`)** — the **ephemeral** Here/Away
  layer carrying `{ memberId, focused }` (Phase 4.7). Drives the green dot + "Here"/"Away" label
  only. **Zero DB writes; never read by matchmaking.** A member absent from the Presence state
  shows no dot but may still be an active member (e.g. mid-reconnect) until the heartbeat sweeper
  removes them.
- **`session:{session_id}` changes** — status transitions
  (`lobby → active → awaiting_host_resolution → matched/resolved`, or `→ cancelled` when the
  host leaves/ends the room **or the last active member leaves**). A `matched` transition can now
  be triggered by a **membership change** (a leave that completes unanimity), not only a swipe.
- **`session:{session_id}` progress** — aggregate swipe progress (counts only, never other
  members' individual decisions), used for "X of Y have finished the deck" UI.
- **`match` event** — fired on the session channel when a match/resolution occurs, carrying
  the chosen restaurant for the announcement screen.

Separately from Realtime, each client upserts a **liveness heartbeat** (`member_heartbeats`,
§3.4) every `HEARTBEAT_INTERVAL_S`; the server-side sweeper `prune_absent_members` (§3.10) uses
it to auto-remove members who disconnect past `MEMBER_ABSENCE_GRACE_S`. The heartbeat table is
**not** in the realtime publication (a per-10s write there would storm `subscribeRoom`).

Realtime is for *notification of state*, authoritative reads still come from RPC/table
reads under RLS.

---

## 5. Provider abstraction (internal, server-side only)

Not a public client endpoint. Single interface used by Edge Functions.

```ts
interface RestaurantProvider {
  // Fetch the pool for an anchor + filters + radius. Called once per session start
  // and once per widen round.
  fetchRestaurants(params: {
    lat: number;
    lng: number;
    radiusM: number;
    openNow: boolean;
    cuisines: string[];
    priceLevels: PriceLevel[];
    excludeProviderRefs?: string[]; // for widen: skip already-seen places
  }): Promise<NormalizedRestaurant[]>;
}
```

- v1 implementation: `GooglePlacesProvider`. API key server-side only.
- Returns the app's `NormalizedRestaurant` shape, never the raw provider payload.
- The widen call passes `excludeProviderRefs` so re-fetches only yield unseen restaurants.

---

## 6. Rate limiting & abuse

- `create_room` and `join_room` are rate-limited **per auth identity**, enforced inside the
  RPCs (`supabase/migrations/0005`) by counting the caller's recent activity in the existing
  tables over a rolling window — no new table. `create_room` counts rooms the identity created
  (`rooms.host_member_id → room_members.user_id`); `join_room` counts the identity's recent
  member joins (`room_members.user_id`, role `member`). Defaults: **10 per hour** each (tunable
  via the constants in 0005); the next call raises `RATE_LIMITED`.
- **IP-based** rate limiting is **deferred to the edge/gateway** — it belongs at the network
  boundary, not in an RPC that only sees the auth identity. (Supabase already rate-limits
  anonymous sign-ins per IP; see `supabase/config.toml [auth.rate_limit]`.)
- Guest display names are length-limited and lightly moderated.
- `submit_swipe` is idempotent and cheap (no provider call), but still rate-limited to
  guard against scripted abuse.

---

## 7. Validation

- All request bodies validated against shared schemas (see coding standards doc — Zod
  schemas live in the shared TS core and are reused client- and server-side).
- Coordinates bounded to valid lat/lng ranges; radius clamped to a sane min/max.
