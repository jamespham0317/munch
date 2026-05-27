# API Specification

**Project:** Munch
**Document:** API Specification
**Status:** Draft v1 — for build
**Last updated:** 2026-05-25

---

## 1. Overview

The backend is Supabase. The client interacts with the system three ways:

1. **Auth** — Supabase Auth (anonymous for guests, email/OAuth for accounts).
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
`NOT_HOST`, `SESSION_INVALID_STATE`, `ALREADY_JOINED`, `RATE_LIMITED`, `PROVIDER_ERROR`,
`VALIDATION_ERROR`.

---

## 2. Auth

Handled by Supabase Auth SDK on the client. Verification is by **6-digit email OTP**, which
works identically on web and mobile and keeps the caller on the same client/session — important
on mobile, where the anonymous session is in-memory for the launch (no persistence yet), so a
guest keeps their `auth.uid()` (and room membership) through an upgrade. The api-client owns the
helpers (`packages/api-client/src/auth.ts`); raw auth errors are mapped to the safe `ApiError`
shape, never surfaced.

- **Guest:** `signInAnonymously()` → an anonymous session used to create the
  `room_members` row. No profile created.
- **Account (optional):** email OTP — `signInWithOtp({ email })` → `verifyOtp(type:'email')`
  creates `auth.users` + a `profiles` row. This is for a **fresh** account.
- **Guest → account upgrade:** `updateUser({ email })` links an email to the *current*
  anonymous user (GoTrue converts it in place) → `verifyOtp(type:'email_change')` → a `profiles`
  row is written with the chosen display name. The `user_id` is **unchanged**, so the guest
  keeps their room membership; match history begins accruing from that point. The
  guest/account distinction is the **presence of a `profiles` row**, not the `user_id`.
- **Deferred (post-Phase 1):** OAuth providers and magic-link (tappable-link) verification.
  Magic link would need mobile session persistence to preserve the anonymous identity across the
  redirect; OTP avoids that. See `docs/07-initial-roadmap.md`.

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
    "anchor_label": "Kensington, Calgary",
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
    "room": { "id": "uuid", "code": "428913", "anchor_label": "Kensington, Calgary" },
    "member": { "id": "uuid", "role": "member", "display_name": "Sara" },
    "members": [ { "id": "uuid", "display_name": "Alex", "role": "host", "is_present": true } ]
  }
  ```
- **Errors:** `ROOM_NOT_FOUND`, `ROOM_CLOSED`, `ALREADY_JOINED`, `RATE_LIMITED`.

---

### 3.3 `update_room_filters` (host only)

Updates room anchor/filters/default radius while in `lobby`.

- **Auth:** host member of the room.
- **Request:** same `filters` / `anchor` / `default_radius_m` shape as `create_room`
  (all fields optional; only provided fields change).
- **Response:** `{ "room": { ...updated } }`
- **Errors:** `NOT_HOST`, `SESSION_INVALID_STATE` (cannot edit once a session is active).

---

### 3.4 `set_presence`

Marks the calling member present/away in the lobby or session.

- **Request:** `{ "is_present": true }`
- **Response:** `{ "member": { "id": "uuid", "is_present": true } }`
- **Implementation:** a direct RLS-scoped update of the caller's own `room_members` row (not an
  RPC) — see the §3 implementation note.

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
  inline beyond its size.
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
  `like`, transactionally checks whether the restaurant now has likes from all present
  members. If so, writes `matches`, sets session `matched`, and emits a realtime event.
  When the deck is exhausted for all members with no match, the session moves to
  `awaiting_host_resolution` (may be detected here or by a lightweight check).
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
- **Notes:** ordered by `pass_count asc`, then `rating desc`, then `distance_m asc`
  (closest-to-unanimous). Top item is the suggested pick.

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
    "match": { "restaurant_id": "uuid", "resolution": "host_accepted_top" } }
  ```
- **Response (widen):**
  ```json
  { "session": { "status": "active" }, "new_restaurants": 17 }
  ```
- **Behavior (widen):** one additional provider fetch for restaurants **not already in the
  deck**; appends them to `cached_decks` with `added_round = n+1`; returns session to
  `active`. Existing likes still count.
- **Errors:** `NOT_HOST`, `SESSION_INVALID_STATE`, `PROVIDER_ERROR`.

---

### 3.10 `leave_room` / `end_room`

- `leave_room` — marks the calling member not present and sets `left_at`. **If the host
  leaves, the room ends:** any non-terminal session for the room transitions to `cancelled`,
  the room is soft-closed (`is_active = false`), ephemeral session data is cleaned up, and a
  realtime event notifies remaining members that the host ended the session. Host role is
  **not** transferred (this is the resolved policy for the former CLAUDE.md §9 open decision).
- `end_room` (host) — soft-closes the room (`is_active = false`) and triggers cleanup of
  ephemeral session data. A host leaving via `leave_room` produces the same outcome.
- **Implementation:** both are direct RLS-scoped table writes in the api-client (not RPCs) — see
  the §3 implementation note. `leave_room` updates the caller's own `room_members` row; if that
  caller is the host it also flips `rooms.is_active = false` (same outcome as `end_room`).
  **Phase 1 has no sessions yet**, so the session-cancel/cleanup/realtime-`match` steps above are
  forward-looking — they land in Phase 2; in Phase 1 a host leaving simply closes the room.

---

## 4. Realtime channels

Clients subscribe to per-room channels for live state. Recommended events:

- **`room:{room_id}` presence** — member join/leave/presence changes.
- **`session:{session_id}` changes** — status transitions
  (`lobby → active → awaiting_host_resolution → matched/resolved`, or `→ cancelled` when the
  host leaves/ends the room).
- **`session:{session_id}` progress** — aggregate swipe progress (counts only, never other
  members' individual decisions), used for "X of Y have finished the deck" UI.
- **`match` event** — fired on the session channel when a match/resolution occurs, carrying
  the chosen restaurant for the announcement screen.

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
