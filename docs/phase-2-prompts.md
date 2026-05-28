# Phase 2 — The Core Mechanic: Agent Prompts

**Project:** Munch
**Source:** `docs/07-initial-roadmap.md` §4 (Phase 2)
**Purpose:** Phase 2 broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Prompts 5 and 6 (web and
mobile swipe UIs) can run in parallel once Prompt 4 is done.

**Prepend the shared preamble to every prompt.**

Phase 2 is the product. The matching mechanic — one cached deck, independent shuffled
orders, server-authoritative unanimous match — is what everything else exists to support.
Treat its correctness and the per-session-call invariant as load-bearing.

### What Phase 1 already left in place (build on this, don't rebuild)

- `@munch/core` already has the Zod schemas + `z.infer` types for `start_session`,
  `get_deck`, `submit_swipe`, plus the `DeckRestaurant` / `MatchInfo` shapes and
  `PROVIDER_ERROR` in the `ErrorCode` enum (`src/validation/{sessions,swipes,matches}.ts`).
  `Restaurant` / `Swipe` / `Match` camelCase types exist in `src/types/`. **Do not
  duplicate these.**
- `packages/core/src/domain/shuffle.ts` is fully implemented; `matching.ts` has
  `isUnanimousLike` as the client-side optimistic mirror. `ranking.ts` is the Phase 3
  surface — leave it alone here.
- `packages/api-client/src/endpoints/{sessions,swipes}.ts` hold typed **stubs** that
  `notImplemented(..., "Phase 2")`. `realtime.ts` has `subscribeRoom` implemented and
  `subscribeSession` stubbed. The error-mapping convention in `src/errors.ts` (RPC message
  → `ErrorCode`; `42501` → `FORBIDDEN`) is the contract Phase 2 RPCs must keep.
- Migrations `0001`–`0008` created the tables, RLS on every table, and the membership
  helpers (`auth_is_room_member`, `auth_is_room_host`, `auth_owns_member`).
  `0004_functions.sql` has `check_unanimous_match` and `get_resolution_ranking` as
  `raise exception` stubs — Phase 2 implements `check_unanimous_match` via
  `create or replace`; `get_resolution_ranking` stays stubbed until Phase 3.
- The Phase-1 lobby already has a **disabled** "Start session (Phase 2)" affordance on the
  host's view, on both apps. That's the entry point Prompts 5 and 6 light up.
- `restaurants` has RLS enabled with **no select policy** after `0007` (the Phase-0 smoke
  was torn down); Phase 2 adds the deck-scoped read policy. `cached_decks`, `swipes`, and
  `matches` already have member-scoped read policies (0003). `swipes_insert_own` already
  permits per-member self-inserts, but the swipe path goes through a security-definer RPC
  so the **authoritative** match check can read all members' swipes in one transaction.
- Resolved host-leave policy (was CLAUDE.md §9): the room soft-closes and any non-terminal
  session moves to `cancelled`. Phase 1 only soft-closed the room (no sessions yet); Phase
  2 extends the host-leave path to also cancel the active session (see Prompt 2).

### Which operations are RPCs vs. Edge Functions vs. direct RLS writes

Decide once, here, so the agent doesn't reinvent it per prompt:

- **Edge Function (server-only, provider key required):** `start_session`. The provider
  fetch must not run on the client (CLAUDE.md §2.1, §3). Lives at
  `supabase/functions/start-session/`; uses the service-role key + the provider key from
  Edge Function env. **The only Phase-2 endpoint that touches the provider.**
- **Security-definer RPC (crosses an RLS boundary):** `submit_swipe` (idempotent insert +
  authoritative match check + session status transition in one transaction; needs to read
  ALL members' swipes, which the per-member RLS in `swipes_select_own` would block).
  `cancel_active_session` (host-leave session cancel; `sessions` has no update policy by
  design).
- **Direct RLS-scoped table reads (no RPC):** `get_deck` reads `cached_decks` joined with
  `restaurants` under the existing `cached_decks_select_member` plus a NEW
  `restaurants_select_deck_member` policy added in Prompt 2.

### Pinned Phase 2 decisions (so the agent doesn't relitigate them)

- **Distance** in `DeckRestaurant.distance_m` is computed **server-side** at `get_deck`
  time via a SQL helper (Haversine over WGS-84, returns metres rounded to int) — keeps the
  doc-04 §3.6 response shape exact and avoids dragging the room anchor into every client.
- **Deck exhaustion → `awaiting_host_resolution`** is **Phase 3**, not here. If the deck
  runs out with no unanimous match, the session stays `active` and the UI shows a neutral
  "no match yet" state. Do NOT detect or transition to `awaiting_host_resolution` in this
  phase; the roadmap §5 owns that.
- **`get_resolution_ranking` / `resolve_session` stay stubbed** until Phase 3. Phase 2
  must not call them.
- **Provider key (`GOOGLE_PLACES_API_KEY` or equivalent) is server-only.** Document the
  env var in `supabase/functions/.env.example`. Never reference it from `apps/*` or
  `packages/*` (the CI guard from Phase 0 already enforces this).
- **Realtime publications added this phase:** `sessions` and `matches`. NOT
  `cached_decks` (widen is Phase 3) and NOT `swipes` (raw per-member swipes are never
  exposed — CLAUDE.md §3; only aggregate progress is, derived from non-realtime reads).
- **The unanimous match check is "every currently PRESENT member"** (CLAUDE.md §2.3; doc
  02 §5). A member toggling `is_present` mid-session changes the cohort; the RPC must
  re-evaluate against the live set, not a snapshot.

### Phase 2 maps to the roadmap §4 bullets + the exit criterion

- Provider abstraction + `GooglePlacesProvider` → Prompt 3
- `start_session` (single provider fetch + cache deck) → Prompt 3 (Edge Function),
  Prompt 4 (api-client wrapper)
- `get_deck` + deterministic shuffle → Prompt 2 (RLS policy + distance helper),
  Prompt 4 (api-client read), Prompts 5/6 (uses `@munch/core` `shuffleDeck`, already
  implemented)
- Swipe UI + radius slider → Prompts 5, 6
- `submit_swipe` with authoritative transactional match check → Prompt 2 (RPC),
  Prompt 4 (api-client wrapper)
- Realtime match event → match announcement → Prompt 2 (publications), Prompt 4
  (`subscribeSession`), Prompts 5/6 (result screen)
- Thorough tests on the unanimous check (incl. member-leaves-mid-session) → Prompt 7
- Host-leave cancels in-flight session (forward-looking note in Phase 1; lands here) →
  Prompt 2 (`cancel_active_session` RPC), Prompt 4 (wire into existing
  `leaveRoom` / `endRoom`)

**Exit check (after all 7):** three devices (web + 2 mobile, or 3 browsers) in one room
swipe their own deterministic shuffled orders against ONE cached deck; the instant the
last person likes a restaurant all three see the match announced; verify exactly ONE
provider call was made for the whole session (server log / metric). CI is green.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and the docs/ files it points to that are relevant to this task.
- Honor the §2 invariants and §3 security rules at all times: provider/service-role keys
  are server-only and must never appear in apps/* or packages/*; RLS on every table; a
  member can only read/write rows for rooms they belong to; domain rules live in
  packages/core and are never duplicated.
- This is Phase 2 (The core mechanic) per docs/07-initial-roadmap.md. Do NOT build Phase 3+:
  no host-resolution UI, no get_resolution_ranking implementation, no resolve_session, no
  widen, no awaiting_host_resolution transition. If the deck exhausts with no match this
  phase, the session stays `active` and the UI shows a neutral "no match yet" state.
- PER-SESSION CACHING IS LOAD-BEARING (CLAUDE.md §2.1): the provider is fetched exactly
  ONCE at session start. No code path on a swipe, on a card render, or on a deck read may
  call the provider. The provider key lives only in the Edge Function env, never in any
  client bundle (CI guards this).
- SERVER-AUTHORITATIVE MATCH (CLAUDE.md §2.3): the unanimous check runs in a single
  transactional RPC. Clients may compute optimistic UI via @munch/core matching.ts, but
  the server is the only thing that declares a match. "Every member" = currently PRESENT
  members; re-evaluate against the live cohort.
- HOST-LEAVE POLICY (resolved): when the host leaves, the room soft-closes AND any
  non-terminal session transitions to `cancelled`. Phase 1 only did the room half; Phase 2
  adds the session-cancel half. Host role is NOT transferred.
- Database changes are NEW migrations under supabase/migrations/ — never edit an applied
  one. The next migration number is 0009.
- Map snake_case DB columns to camelCase at the @munch/api-client boundary (docs/06 §5).
- Make the smallest change that satisfies the task. TypeScript strict everywhere.
- If you change behavior a doc describes, update that doc in the same change (CLAUDE.md §1).
- When done, run the stated acceptance checks and report their actual output.
```

---

## Prompt 1 — Core: finish the swipe/match/session contracts

```
Goal: add only the contracts Phase 2 needs that Phase 1 did not create. Small, foundational
change so api-client and both apps share one typed source of truth.
Reference: docs/04-api-specification.md (§3.5–§3.7, §4 realtime), docs/03-database-schema.md
(restaurants, sessions, swipes, matches), docs/06-coding-standards.md (§3 Zod-as-source-of-truth).

Context: @munch/core already has Zod schemas + z.infer types for start_session, get_deck,
submit_swipe, plus DeckRestaurant / MatchInfo / Restaurant / Swipe / Match. Do NOT restate
those — only add what's missing.

Deliver:
- src/validation/sessions.ts: if the start_session request omits a body field the Edge
  Function needs (it should NOT — the host's radius is the only body field per doc 04
  §3.5), leave the schema as-is. Verify nothing is missing; do not gold-plate.
- src/validation/realtime.ts (new): Zod schemas + z.infer types for the session-channel
  event payloads delivered by subscribeSession (doc 04 §4):
    • SessionStatusChange  — { session_id, status }
    • SessionMatchEvent    — { session_id, match: MatchInfo, restaurant: <minimal card> }
  Keep these snake_case (wire shapes); the api-client maps them to camelCase. Reuse
  matchInfoSchema (do not redefine MatchInfo).
- src/domain/matching.ts: expand the JSDoc to be explicit that "currently present
  members" means rooms_members.is_present = true at the moment of the check, and that a
  member toggling presence mid-session changes the cohort. The function itself stays
  pure; no behavioral change. The authoritative check is server-side regardless.
- src/domain/matching.test.ts (new): cover the "every present member liked" happy path,
  the empty-present-set case (returns false — guards "every of nothing" being vacuously
  true), a single member who liked, and a member-leaves-mid-session reframing where the
  same likers + a smaller present cohort now is unanimous. Keep tests fast and pure.
- Export everything new via the existing src/validation/index.ts barrel.
- Do not add anything for ranking / resolution / widen here — Phase 3 owns those.

Done when: `pnpm --filter @munch/core typecheck` and `pnpm --filter @munch/core test` pass,
the new realtime event types are importable from "@munch/core", and matching.test.ts
covers the four cases above.
```

---

## Prompt 2 — Supabase: restaurants RLS, distance helper, swipe + match-check RPC, session-cancel RPC, realtime

```
Goal: the server-authoritative SQL surface for the core mechanic — the deck-scoped
read policy, the distance helper, the transactional submit_swipe RPC with the
unanimous match check, the host-leave session-cancel RPC, and the realtime
publications. Provider work is NOT here; it's Prompt 3.
Reference: docs/03-database-schema.md (§3.5–§3.8, §5 match check, §7 retention),
docs/04-api-specification.md (§3.7 submit_swipe, §3.10 host-leave cancel, §4 realtime),
docs/02-system-architecture.md (§5 real-time match detection, §6 state machine), CLAUDE.md
§2.1–§2.4. The membership helpers (auth_is_room_member/host/owns_member) already exist in
0003; reuse them.

All new work is NEW migrations (start at 0009_*; never edit 0001–0008).

Deliver:
- 0009_phase2_reads_and_helpers.sql:
  • Add `restaurants_select_deck_member` policy: a row is selectable iff it appears in
    cached_decks for a session whose room the caller is a member of. Mirror the structure
    of cached_decks_select_member (0003). Keep RLS on. Do NOT grant `anon` anything.
  • Add an immutable SQL helper `haversine_m(lat1, lng1, lat2, lng2) returns integer` that
    returns the great-circle distance in metres rounded to an int. Pure function; mark
    `immutable parallel safe`. This is what get_deck uses for `distance_m`.

- 0010_submit_swipe.sql:
  • Implement check_unanimous_match via `create or replace function ...` (replaces the
    0004 stub) per docs/03 §5: for the given (session, restaurant), unanimous iff every
    PRESENT member of the session's room has a 'like' swipe for the restaurant, and
    there is at least one present member. Stays `security definer` (broader read scope
    than swipes_select_own). Pure SQL function body where practical.
  • Implement submit_swipe(p_session_id, p_restaurant_id, p_decision) as a
    security-definer RPC matching docs/04 §3.7:
      1. Reject UNAUTHENTICATED if auth.uid() is null.
      2. Look up the caller's room_members row for this session's room; if none,
         FORBIDDEN. Cache the member_id locally.
      3. Reject SESSION_INVALID_STATE if the session isn't `active`.
      4. Reject VALIDATION_ERROR if the restaurant isn't in this session's cached_decks.
      5. Idempotent insert into swipes (`on conflict (session_id, member_id,
         restaurant_id) do nothing`). The pre-existing decision wins — do NOT overwrite.
      6. If decision is 'like', call check_unanimous_match for this (session, restaurant).
         If unanimous, INSIDE THE SAME TRANSACTION:
           - insert into matches (session_id, restaurant_id, resolution = 'unanimous'),
             on conflict on the session_id unique constraint do nothing (idempotent under
             a near-simultaneous tie).
           - update sessions set status = 'matched', matched_restaurant_id = p_restaurant_id,
             ended_at = now() where id = :session and status = 'active' (the where-clause
             keeps an already-matched session from regressing).
         Return { recorded: true, match: { restaurant_id, restaurant_name, resolution } }
         using the matches row + restaurants.name. Otherwise return { recorded: true,
         match: null }.
  • Error convention (same as 0005): every failure is `raise exception` whose MESSAGE is
    EXACTLY one of the doc-04 codes (UNAUTHENTICATED, FORBIDDEN, SESSION_INVALID_STATE,
    VALIDATION_ERROR). The api-client maps the message; raw text is never surfaced.
  • Phase-2 swipe rate limiting: keep the existing per-member uniqueness as the primary
    abuse guard; doc 04 §6 notes submit_swipe is cheap (no provider call). Add a brief
    comment that a real rate-limit lands at the edge if scripted abuse appears — do NOT
    add a new table here.
  • `revoke execute ... from public; grant execute ... to authenticated;` on both
    functions, mirroring 0005.

- 0011_cancel_active_session.sql:
  • Implement cancel_active_session(p_room_id) as a security-definer RPC. The host-leave
    path (api-client leaveRoom when caller is host, and endRoom) calls it to flip any
    non-terminal session for the room to `cancelled` + set ended_at = now(). NOT_HOST if
    the caller is not the room host. No-op (returns gracefully) if no non-terminal
    session exists — host-leave in lobby must not raise. `sessions` has no update policy
    on purpose, so this RPC is the only path that mutates session.status outside of
    submit_swipe / start_session (Prompt 3) / resolve_session (Phase 3).
  • grant execute to authenticated; revoke from public.

- 0012_realtime_sessions_matches.sql:
  • `alter publication supabase_realtime add table sessions;`
  • `alter publication supabase_realtime add table matches;`
  • Comment: RLS still applies to Realtime postgres_changes — sessions_select_member /
    matches_select_member (0003) scope subscriptions to rooms the caller belongs to. Raw
    per-member swipes are NEVER published (CLAUDE.md §3); we did not add `swipes` to the
    publication, and Phase 2 does not need it (the lobby/session UI does not show other
    members' raw decisions; only the match event matters).
  • Do NOT add cached_decks to the publication — widen lands in Phase 3.

Done when: `supabase db reset` applies cleanly; manual checks confirm:
  (a) a non-member SELECT on a deck restaurant is denied;
  (b) submit_swipe is idempotent under repeated calls with the same (session, member,
      restaurant);
  (c) the second-to-last like returns { match: null }, the last like returns the match
      payload and the session moves to `matched` atomically;
  (d) a present member toggling is_present=false then a remaining-cohort unanimous call
      returns the match (the "currently present" semantics);
  (e) cancel_active_session by a non-host raises NOT_HOST; by the host flips a single
      `active` session to `cancelled` and is a no-op when there isn't one;
  (f) `select * from pg_publication_tables where pubname='supabase_realtime'` now
      contains sessions and matches (in addition to room_members from 0006).
```

---

## Prompt 3 — Supabase: provider abstraction + start_session Edge Function

```
Goal: the only place that ever calls the restaurant data provider — a clean
RestaurantProvider interface, a GooglePlacesProvider implementation, and the
start_session Edge Function that fetches the deck exactly ONCE and caches it.
Reference: docs/02-system-architecture.md (§4 per-session caching, §3.3 provider
abstraction), docs/04-api-specification.md (§3.5 start_session, §5 provider abstraction),
docs/03-database-schema.md (§3.5 restaurants, §3.6 cached_decks), docs/05-folder-structure.md
(§7), docs/08-tech-stack.md (§5 secrets), CLAUDE.md §2.1, §3, §4 (provider code lives
only in supabase/functions/_shared/provider).

Deliver:
- supabase/functions/_shared/provider/index.ts:
  • Export the RestaurantProvider interface exactly as in doc 04 §5: a single
    `fetchRestaurants(params)` returning Promise<NormalizedRestaurant[]>. Define
    NormalizedRestaurant as the app's normalized shape (NOT a re-import of @munch/core's
    Restaurant — Edge Functions are Deno; pin a flat type here with snake_case fields
    that match the restaurants table columns excluding id/fetched_at/expires_at).
  • Export a factory `getProvider()` that returns the configured provider implementation
    (Phase 2: always GooglePlacesProvider). Future providers swap here, nowhere else.

- supabase/functions/_shared/provider/google-places.ts:
  • GooglePlacesProvider implementing RestaurantProvider. Use Places API v1 Nearby Search
    (or whichever current Google Places endpoint the agent verifies is in scope; if v1
    pricing/availability is uncertain, leave a TODO and use the legacy Nearby Search +
    Details fallback — the abstraction means the choice can change without touching
    callers). Key from env: PROVIDER_GOOGLE_API_KEY.
  • Pass through the room's filters: openNow, cuisines (mapped to Places categories or
    keyword as appropriate), priceLevels, and `excludeProviderRefs` for the future widen
    round (Phase 3 will use this; Phase 2 passes through unchanged).
  • Wrap fetch in try/catch — any non-2xx or thrown error becomes a thrown
    PROVIDER_ERROR, never surfaces the raw provider response (CLAUDE.md §3, docs/06 §8).
  • Map to NormalizedRestaurant: provider='google', provider_ref=place id, name, lat/lng,
    rating (nullable), price_level (mapped to the '1'..'4' enum or null), cuisines as a
    string[], photo_url (first photo if any), is_open_now (nullable).

- supabase/functions/_shared/normalize.ts: helpers used by the provider — price-level
  mapping, photo-URL construction, cuisine normalization. Pure, no I/O.

- supabase/functions/start-session/index.ts: the Edge Function for docs/04 §3.5.
  Validate the body with the @munch/core schema (import via the shared Deno-safe path
  the monorepo already uses, or duplicate the minimal shape with a comment pointing back
  to the schema if cross-runtime imports are messy — pick once and explain in a header
  comment). Behavior:
  1. Authenticate via the user JWT; reject UNAUTHENTICATED if missing.
  2. Resolve the caller's room + host membership via a service-role client (NOT_HOST
     unless caller is the room host). The provider key + service role come from Edge env;
     never the client.
  3. Reject SESSION_INVALID_STATE if a non-terminal session already exists for this room.
  4. Insert a new sessions row in `lobby` snapshotting the room's filters and the
     requested radius_m; capture its id.
  5. Call getProvider().fetchRestaurants(...) EXACTLY ONCE with the snapshot filters +
     radius + the room's anchor. Wrap in try/catch → PROVIDER_ERROR.
  6. Upsert into restaurants (on conflict on (provider, provider_ref) update minimally —
     name/lat/lng/rating/photo/is_open_now; preserve expires_at if larger than the new
     value). Compute expires_at = now() + provider TTL window (default 24h, conservative
     under provider caching terms; pin the constant in a comment).
  7. Insert one cached_decks row per fetched restaurant for this session with
     added_round = 0. `on conflict (session_id, restaurant_id) do nothing` for safety.
  8. Update sessions.status = 'active' and sessions.started_at = now().
  9. Return { session: { id, status: 'active', radius_m }, deck_size } per doc 04 §3.5.
  Emit one structured log line at success: session id + deck_size + provider call count
  (must be exactly 1 per session start; this is the Phase-5 observability hook landing
  early because it directly verifies the §2.1 invariant).

- supabase/functions/.env.example: document SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  PROVIDER_GOOGLE_API_KEY with non-secret placeholders. Note in a header comment that
  these are server-only — never in apps/* or packages/* (the Phase-0 CI guard already
  enforces this; the agent should not weaken it).

- Update supabase/config.toml to register the start-session function if the local CLI
  needs explicit declaration (depends on the CLI version pinned in the repo).

Done when: `supabase functions serve start-session` runs locally; invoking it from a
host-authenticated session creates the sessions row, caches the deck (visible in
restaurants + cached_decks), and transitions sessions.status to 'active'; a NON-host gets
NOT_HOST; the provider is called EXACTLY once per invocation (verify via the structured
log or a fixture provider in tests later); no provider key appears anywhere in apps/* or
packages/* (grep cleanly).
```

---

## Prompt 4 — api-client: implement startSession / getDeck / submitSwipe / subscribeSession + extend host-leave

```
Goal: turn the Phase-0 stubs into working, typed endpoints — startSession via the Edge
Function, getDeck as a deck-scoped RLS read, submitSwipe via the new RPC, subscribeSession
for the realtime status/match channel — and extend the host-leave path so it now also
cancels the active session.
Reference: docs/04-api-specification.md (§3.5–§3.7, §3.10, §4 realtime), docs/06-coding-standards.md
(§5 snake↔camel, §8 error shape, §9 no leaked DB errors).
Depends on Prompts 1, 2, 3.

Deliver:
- src/endpoints/sessions.ts:
  • Implement startSession by calling `client.functions.invoke('start-session', { body })`.
    Pass through the Phase-1 ClientResult<T> envelope; map snake_case response to the
    StartSessionResponse shape. Map a non-2xx body or invoke error through toApiError,
    favoring PROVIDER_ERROR when the Edge Function surfaced that code (we DO want
    PROVIDER_ERROR to reach UI for retry copy; never the raw response).
  • Implement getDeck as a direct table read joining cached_decks → restaurants under
    RLS. Project the columns DeckRestaurant expects, calling the new SQL helper for
    distance: write the query as an `.rpc('get_deck_for_session', { p_session_id })`
    OR as a plain `.from('cached_decks').select(... restaurants(...))` with distance
    computed via a small `create function get_deck_for_session(p_session_id uuid) ...`
    you add in 0009 if PostgREST embedding makes the distance column awkward. Pick the
    smaller approach (a thin SQL RPC is fine — it's a read, not a privileged write, and
    keeps the JS side dumb). Map snake_case to DeckRestaurant[].
    Note: a thin read RPC stays `security invoker` so RLS still applies — only the swipe
    + cancel RPCs are security definer.
  • Keep startSession's call signature so the host UI can pass radius_m; the room
    anchor + filters come from the row, not the client.

- src/endpoints/swipes.ts:
  • Implement submitSwipe by calling `client.rpc('submit_swipe', { p_session_id,
    p_restaurant_id, p_decision })`. Map snake_case response → SubmitSwipeResponse
    (`{ recorded, match: MatchInfo | null }`). On error, map via toApiError; the existing
    RPC_ERROR_CODES set already includes SESSION_INVALID_STATE and VALIDATION_ERROR —
    keep that intact.

- src/endpoints/realtime.ts:
  • Implement subscribeSession(client, sessionId, handlers): subscribe to
    postgres_changes on `sessions` filtered to `id=eq.${sessionId}` (delivers status
    transitions) AND on `matches` filtered to `session_id=eq.${sessionId}` (delivers the
    match payload). Surface a typed event union to the caller, mapping snake_case → the
    SessionStatusChange / SessionMatchEvent shapes from @munch/core. Return the channel
    so the caller can `client.removeChannel` on teardown — same pattern as subscribeRoom.

- src/endpoints/rooms.ts:
  • Extend leaveRoom: when the caller is host (existing branch), after soft-closing the
    room, also call `client.rpc('cancel_active_session', { p_room_id: roomId })`. Fold
    the result into the existing LeaveRoomResult; do NOT add new fields beyond what is
    needed — `roomEnded` already covers the user-facing signal. Surface mapped errors;
    do not crash the leave on a NOT_HOST race (the post-leave host membership flip is
    inside the RPC).
  • Extend endRoom symmetrically: after flipping rooms.is_active, call
    cancel_active_session.
  • The Phase-1 comment in rooms.ts that says "Phase 2 will additionally cancel any
    in-flight session" — replace it with the implementation and remove the forward note.

Done when: `pnpm --filter @munch/api-client typecheck` passes; `pnpm test` (api-client)
passes including a new test that submitSwipe maps its known RPC error messages onto the
right ErrorCode and never surfaces raw DB text; manual round-trip against local
Supabase: start_session returns a sessions id + deck_size; get_deck returns the
DeckRestaurant[]; submit_swipe is idempotent and declares the match on the last like;
subscribeSession delivers the match event to a co-member subscriber; a host calling
leaveRoom now flips both rooms.is_active and any active session to `cancelled`.
```

---

## Prompt 5 — Web: host start-session, swipe UI, radius slider, match announcement

```
Goal: the Next.js side of the Phase 2 exit criterion — host starts a session from the
lobby, every member sees the same cached deck in their own shuffled order, swipes through
it, and the instant a unanimous like lands, all members see the match announced.
Reference: docs/05-folder-structure.md (§4 web routes), docs/01-product-specification.md
(§5 user flow, §6 matching mechanic, §9 cards), docs/04-api-specification.md (§3.5–§3.7,
§4 realtime), docs/08-tech-stack.md (§4 TanStack Query). Depends on Prompt 4. Can run in
parallel with Prompt 6.

Deliver (App Router, per the doc-05 §4 layout):
- app/room/[roomId]/lobby/page.tsx: enable the existing "Start session" control for the
  host only; on click, call startSession via @munch/api-client with the room's
  default_radius_m, then route to app/room/[roomId]/session/page.tsx with the new
  session id (path or query — pick one consistently with the mobile flow in Prompt 6).
  Non-host members in the lobby auto-route to the session screen on the subscribeRoom
  / subscribeSession event indicating the session is `active`.

- app/room/[roomId]/session/page.tsx: the swipe screen.
  • Reads the cached deck via getDeck once, then derives this member's order via
    @munch/core/shuffle.ts (`shuffleDeck`, seed = memberId + sessionId). Do NOT refetch
    on swipes — the deck is static for the session (per-session caching, CLAUDE.md §2.1).
  • Renders a SwipeCard with: photo, name, rating, price level ($–$$$$), distance.
    Distance comes from DeckRestaurant.distance_m (computed server-side; do NOT
    recompute in the client).
  • Like / Pass interaction: drag gesture is nice-to-have on web but the minimum
    acceptable is two buttons. Call submitSwipe with the right decision; advance to the
    next card on success; on submitSwipe returning a `match`, navigate to the result
    screen with the match payload.
  • Radius slider: a control bound to a local UI state. v1 spec (§8) says the radius is
    "user-adjustable within the host's anchor"; in Phase 2 keep the slider visible and
    functional but its effect is local to the card sort/filter (do not refetch the
    provider on radius change — that violates CLAUDE.md §2.1). A widen-style refetch is
    Phase 3 work. Document this in a code comment.

- app/room/[roomId]/result/page.tsx: the match announcement screen.
  • Reads the match payload from route state (set by the navigation in the session
    screen) OR re-derives it by reading `matches` for the session under RLS. Display the
    restaurant name + photo + a "session ended" affordance routing back home.
  • Members who weren't the last to like get here via the subscribeSession match event,
    not via their own submitSwipe response — make sure both entry points land on the
    same screen with the same data.

- A thin SwipeCard component under src/components/ that takes a DeckRestaurant and the
  two handlers; no business rules inside (CLAUDE.md §4). The shuffle and the optimistic
  match mirror (matching.ts) live in @munch/core.

- subscribeSession lifecycle: subscribe on mount of the session screen, unsubscribe on
  unmount and on result-screen mount. Reuse the TanStack Query patterns from Phase 1.

- Env: no new client-public vars. Provider key MUST NOT appear here.

Done when: `pnpm dev:web` runs end-to-end: a host on one browser starts a session, a
guest joins from another browser, both see the same set of cards but in different orders
(verifiable by inspection); the instant the second guest's like matches one the host
already liked, both browsers navigate to the result screen with the same restaurant; no
provider call happens on a swipe (server log shows exactly one provider call for the
session); `pnpm --filter @munch/web build` passes.
```

---

## Prompt 6 — Mobile: host start-session, swipe UI, radius slider, match announcement

```
Goal: the Expo side of the Phase 2 exit criterion — the same flow as web (host starts a
session, members swipe their own shuffled order through one cached deck, unanimous like
ends the session in real time) on iOS/Android.
Reference: docs/05-folder-structure.md (§3 mobile routes), docs/01-product-specification.md
(§5, §6, §9), docs/04-api-specification.md (§3.5–§3.7, §4), docs/08-tech-stack.md (§2.1,
§4). Depends on Prompt 4. Can run in parallel with Prompt 5.

Deliver (expo-router, per the doc-05 §3 layout):
- app/room/[roomId]/lobby.tsx: enable the existing "Start session" control for the host
  only; on press call startSession and route to app/room/[roomId]/session.tsx with the
  new session id. Non-host members auto-route to the session screen via the realtime
  status transition (same as web).

- app/room/[roomId]/session.tsx: the swipe screen.
  • Reads the cached deck once via getDeck, derives this member's order via
    @munch/core/shuffle.ts. Static deck; no refetch on swipe (CLAUDE.md §2.1).
  • Renders the same SwipeCard content as web: photo, name, rating, price level,
    distance (from DeckRestaurant.distance_m — do not recompute).
  • Gesture: pan-to-swipe via react-native-gesture-handler + reanimated, falling back to
    two on-screen buttons if a gesture lib isn't already in the workspace (do not add a
    heavy dep just for this — the buttons are acceptable for the exit criterion; gesture
    polish is Phase 4). No <form> semantics that conflict with RN (docs/06 §6).
  • Radius slider: a Slider control bound to local UI state; same Phase-2 caveat as web
    — the radius is informational this phase and does not refetch the provider.
  • Calls submitSwipe; on a `match` response, routes to result.tsx with the payload.
  • subscribeSession on mount; unsubscribe on unmount.

- app/room/[roomId]/result.tsx: the match announcement screen, mirroring the web layout:
  restaurant name + photo + "session ended" affordance routing back home. Entry from
  either the submitSwipe response or the subscribeSession match event — both must
  resolve to the same UI / data.

- src/components/swipe-card.tsx (mobile): a thin presentational component taking a
  DeckRestaurant and the two handlers. No business rules in it.

- Reuse @munch/core types + @munch/api-client; no duplicated logic or row mapping. Reuse
  EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. No new secrets, no provider
  key anywhere.

Done when: `pnpm dev:mobile` boots in Expo; two devices (or one device + one simulator)
in the same room can swipe; both see the same cards in different orders; the instant the
last like lands, both devices navigate to the result screen with the same restaurant;
the app typechecks.
```

---

## Prompt 7 — Tests, doc reconciliation, and Phase 2 exit verification

```
Goal: lock down the highest-risk Phase 2 behavior with tests, reconcile docs with the
choices made, and verify the exit criterion + green CI.
Reference: docs/06-coding-standards.md (§10 testing, §11 CI), docs/07-initial-roadmap.md
(§4 Phase 2 exit), CLAUDE.md §1 (code/doc parity), §7 (testing). Depends on Prompts 1–6.

Deliver:
- Unit tests in packages/core (expand src/domain/matching.test.ts from Prompt 1 if
  anything was missed): cover the empty-present-set, single-member-room, every-present-
  member-liked, and member-leaves-mid-session-flips-to-unanimous cases. Shuffle
  determinism tests already exist from Phase 0 — leave them alone unless they regress.

- Integration tests against local Supabase (provider replaced by a fixture set in the
  Edge Function — do NOT call the real provider in tests):
  • A FakeProvider in supabase/functions/_shared/provider/fake.ts that returns a fixed
    NormalizedRestaurant[] from a JSON fixture. Wire it via an env flag
    (PROVIDER=fake) read by getProvider(). Document the flag in the Edge Function env
    example. This must NOT be reachable from production deployment env.
  • start_session test: invoking the Edge Function calls the provider EXACTLY ONCE per
    session (assert via a call-counter on FakeProvider), inserts the expected number of
    restaurants + cached_decks rows, and transitions sessions.status from 'lobby' to
    'active'. PROVIDER_ERROR is surfaced when FakeProvider is configured to throw.
  • submit_swipe test against a 3-member session: the first 2 likes return { match:
    null }; the 3rd like on the same restaurant returns the match payload and the
    sessions row is now `matched`. Re-submitting any of the 3 likes is idempotent (no
    duplicate match row, no status regression). Member-leaves-mid-session: with 3
    present, 2 have liked card X; the 3rd toggles is_present=false; a re-evaluation
    (next submit_swipe by either remaining member, or a fresh check_unanimous_match
    call) declares the match against the 2-member present cohort.
  • cancel_active_session test: a host who calls leaveRoom (api-client path) ends the
    room AND moves a single `active` session to `cancelled`; a non-host calling the RPC
    directly raises NOT_HOST.

- A focused api-client test that subscribeSession delivers a SessionMatchEvent to a
  co-member subscriber when a match is inserted (use the local Supabase realtime; allow
  a short timeout for the broadcast).

- CI: confirm .github/workflows/ci.yml still gates on typecheck → lint → test → build;
  confirm the Phase-0 secret-leak guard still rejects the provider-key pattern under
  apps/* and packages/* (it should — the key only lives under supabase/functions/).

- Doc reconciliation (same PR, per CLAUDE.md §1):
  • docs/04-api-specification.md: note that start_session is implemented as an Edge
    Function (not an RPC) because the provider key is server-only; submit_swipe is a
    security-definer RPC; cancel_active_session is a new RPC introduced this phase for
    the host-leave session-cancel half of the resolved §3.10 policy. Update §3.10 to
    drop the "Phase 1 has no sessions yet … land in Phase 2" forward note now that
    those steps have landed.
  • docs/02-system-architecture.md and docs/03-database-schema.md: cross-reference the
    new haversine_m helper and the restaurants_select_deck_member policy from 0009.
  • Note in CLAUDE.md §9 (or wherever the open-decisions list lives) that the host-leave
    policy's session-cancel half is now implemented (the room-only half landed in
    Phase 1).

Done when: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green; the
integration tests against local Supabase pass with FakeProvider; the docs reflect the
implemented behavior; the manual exit check holds — three sessions in one room (e.g. web
+ 2 mobile) swipe their own deterministic shuffled orders against ONE cached deck and
the instant the last unanimous like lands, all three see the match announced. Verify
the structured Edge-Function log shows exactly one provider call for the whole session.
```
