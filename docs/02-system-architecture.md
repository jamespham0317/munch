# System Architecture

**Project:** Munch
**Document:** System Architecture
**Status:** Draft v1 — for build
**Last updated:** 2026-05-25

---

## 1. Architectural goals

- Support a hard **real-time** requirement: detect a unanimous match and broadcast it to a
  room the instant the last member likes a restaurant.
- Keep third-party data cost **bounded per session, not per swipe**.
- Be buildable and maintainable by a **solo developer** across iOS, Android, and web.
- Isolate the restaurant data provider so it can be **swapped** without rewriting the app.
- Stay lean for a small launch while leaving room to scale to a public launch.

---

## 2. High-level diagram

```
                 +---------------------------------------------------+
                 |                    Clients                        |
                 |                                                   |
                 |  Expo (React Native)            Next.js Web App    |
                 |  iOS app   Android app          (browser)         |
                 |        \        |                  /              |
                 |         \       |                 /               |
                 |          +------+--------+--------+               |
                 |                 | shared TS core  |               |
                 |                 | (types, logic,  |               |
                 |                 |  API client)    |               |
                 +-----------------+--------+--------+----------------+
                                            |
                                   HTTPS + WebSocket
                                            |
            +-------------------------------+-------------------------------+
            |                         Supabase                              |
            |                                                               |
            |  Auth (guest + optional account)                             |
            |  Postgres (rooms, members, sessions, swipes, matches,        |
            |            cached_decks, match_history)                       |
            |  Realtime (Postgres changes / broadcast channels)            |
            |  Edge Functions (session start, swipe, match check,          |
            |                  resolution, provider calls)                  |
            |  Storage (optional cached images / assets)                   |
            +-------------------------------+-------------------------------+
                                            |
                                    Provider Abstraction
                                    (server-side only)
                                            |
                          +-----------------+-----------------+
                          |                                   |
                   Google Places API              (future: Yelp / Foursquare)
```

---

## 3. Components

### 3.1 Clients

- **Mobile (Expo / React Native, TypeScript):** true installable iOS and Android apps from
  one codebase. Handles location permission, the swipe/card UI, the radius slider, the
  room lobby, and live session state.
- **Web (Next.js, TypeScript):** browser app sharing the core TypeScript logic and types
  with mobile. Good for joining via link on desktop and for the marketing/landing surface.
- **Shared TS core:** a workspace package holding domain types, the matching/ranking logic
  that can run client-side for optimistic UI, the Supabase client wrapper, and validation
  schemas. Maximizes code reuse across the three targets.

### 3.2 Backend (Supabase)

- **Auth.** Anonymous sessions for guests; **email + password or Google OAuth** for optional
  accounts, established **outside a room** (no mid-room sign-in). Guest identities are scoped to
  a room and not persisted beyond the session.
- **Postgres.** System of record for rooms, members, sessions, swipes, matches, cached
  decks, and (for signed-in users) match history. See the database schema doc.
- **Realtime.** Room and session state changes are pushed to all members over WebSocket
  subscriptions, so lobby presence, swipe progress, match events, and the
  "waiting on host" state stay in sync without polling.
- **Edge Functions.** Server-side logic for actions that must not run on the client:
  starting a session (which triggers the provider fetch), recording a swipe and running
  the match check, and host resolution. All provider API calls happen here so the API key
  never reaches the client.
- **Storage.** Optional, for caching restaurant images or static assets if needed.

### 3.3 Provider abstraction layer

- A server-side module with a single interface (e.g. `RestaurantProvider`) implemented by
  a `GooglePlacesProvider` for v1. Future `YelpProvider` / `FoursquareProvider` implement
  the same interface.
- All restaurant fetching goes through this interface. The rest of the system speaks only
  in the app's normalized restaurant model, never a provider's raw shape.
- This isolates pricing/ToS changes and makes provider swaps a config + one-class change.

---

## 4. The per-session caching model (load-bearing)

This is the single most important design decision and the reason the app is economically
viable.

1. When the host **starts a session**, an Edge Function calls the provider **once** for the
   room's anchor + filters, normalizes the results, and writes them to a `cached_decks`
   record tied to the session.
2. Every member's swipe operates against this **cached deck**, in their own shuffled order.
   No swipe triggers a provider call. Members read the deck through the
   `restaurants_select_deck_member` RLS policy (migration `0009`), which scopes visibility to
   restaurants in a cached deck for a session in one of the caller's rooms; the per-card
   `distance_m` is computed server-side at read time by the `haversine_m` SQL helper against the
   room anchor, so the client never needs the anchor coordinates.
3. The app is therefore billed roughly **per session created**, not per swipe — orders of
   magnitude cheaper for a swipe-heavy app.
4. **Widening** the criteria during host resolution triggers exactly one additional
   provider fetch for the *new* (previously unseen) restaurants, which are appended to the
   cached deck.

**Caching and ToS note.** Cached restaurant data must be treated as session-scoped and
short-lived to respect provider terms (some providers limit caching to ~24 hours). The
cache is for the running session, not a long-term local copy of the provider's database.
Match history persists only the app's own outcome (which restaurant, with whom, when), not
a durable copy of provider content.

---

## 5. Real-time match detection

- Each swipe is written via an Edge Function (or a transactional RPC) that records the
  like/pass and, for a like, checks whether that restaurant now has a like from **every**
  current member of the session.
- The match check runs server-side to be authoritative and avoid race conditions when
  multiple members like the same place near-simultaneously. The write + check should be
  transactional so exactly one match event is emitted.
- On match, a `matches` row is written and the session is marked ended; Realtime broadcasts
  the change to all members, which drives the match-announcement UI.
- Membership changes mid-session (someone leaves) must re-evaluate the unanimous condition,
  since "every member" is relative to current membership. The exception is the **host**
  leaving: that ends the session (status `cancelled`) and closes the room rather than
  re-evaluating, since only the host can start/resolve sessions (see §6 and product spec §7).

---

## 6. Session state machine

```
   lobby
     |  host starts session
     v
   active  ---- restaurant reaches unanimous likes ----> matched (end)
     |
     |  deck exhausted, no unanimous match
     v
   awaiting_host_resolution
     |                         \
     | host accepts top pick    \ host widens criteria
     v                           v
   resolved (end)              active (fresh unseen cards appended)

   (any non-terminal state) ---- host leaves the room ----> cancelled (end)
```

- `lobby` — members joining; no deck yet.
- `active` — deck cached; members swiping.
- `awaiting_host_resolution` — deck exhausted; members in "waiting on host" state. The
  `active → awaiting_host_resolution` transition is detected in `submit_swipe` (migration 0014)
  via the present-member-scoped `is_deck_exhausted(session)` helper, after a swipe that produced
  no match. It is **non-terminal** (no `ended_at`).
- `matched` / `resolved` — terminal states with a chosen restaurant. `resolved` is reached when
  the host accepts the top pick via the `resolve_session` Edge Function (`host_accepted_top`).
- The `awaiting_host_resolution → active` edge is a **widen**: `resolve_session` makes exactly
  one additional provider fetch for unseen restaurants and appends them to `cached_decks` with
  `added_round = n+1`. Earlier swipes/likes are never deleted — they still count toward a later
  unanimous match (a like recorded before the widen can complete a unanimous match after it).
- `cancelled` — terminal state with no decision; entered when the **host leaves**
  mid-session (or ends the room). The room is soft-closed and ephemeral session data is
  purged. Host role is not transferred.

---

## 7. Trust and security boundaries

- **Provider API keys live only server-side** (Edge Functions). Never shipped to clients.
- **Row-Level Security (RLS)** on all Postgres tables: a member can only read/write rows
  for rooms they belong to. Guests are constrained to their room.
- **Match checks are authoritative server-side**; clients may compute optimistic UI but
  cannot declare a match.
- **Rate-limit room creation and joins** to mitigate spam/abuse on public rooms.
- Clients never receive other members' raw swipe history beyond what the UI needs
  (e.g. progress counts), aligning with the no-swipe-logging stance.

---

## 8. Scaling considerations

- Supabase comfortably covers a small private beta and an early public launch.
- The likely first bottleneck is provider cost and rate limits, controlled by the
  per-session cache and by rate-limiting session creation.
- Realtime fan-out is small (rooms are 2–10 members), so per-room load is light; total load
  scales with concurrent sessions.
- **When you'd outgrow this:** very high concurrent session volume, need for custom
  matchmaking infrastructure, or provider contracts that demand a dedicated caching tier.
  At that point, candidates include a dedicated Node + WebSocket service with Redis for
  live room/deck state, fronting the same Postgres. The provider abstraction and the
  session-cache concept carry over unchanged.

---

## 9. Observability

- Structured logs from Edge Functions (session start, provider fetch counts, match events,
  resolutions).
- A simple per-day metric on **provider calls per session** to catch cost regressions early.
- Billing alerts on the provider account (e.g. at 50/75/90% of budget).
