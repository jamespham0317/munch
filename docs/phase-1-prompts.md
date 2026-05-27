# Phase 1 — Rooms & Identity: Agent Prompts

**Project:** Munch
**Source:** `docs/07-initial-roadmap.md` §3 (Phase 1)
**Purpose:** Phase 1 broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Prompts 4 and 5 (web and
mobile flows) can run in parallel once Prompt 3 is done.

**Prepend the shared preamble to every prompt.**

### What Phase 0 already left in place (build on this, don't rebuild)

- `@munch/core` already has the Zod schemas + `z.infer` types for `create_room`,
  `join_room`, `update_room_filters`, and `set_presence` (`src/validation/rooms.ts`),
  plus `Room` / `RoomMember` types and all the Phase-1 error codes (`ROOM_NOT_FOUND`,
  `ROOM_CLOSED`, `NOT_HOST`, `ALREADY_JOINED`, `RATE_LIMITED`, …).
- `packages/api-client/src/endpoints/rooms.ts` + `sessions.ts` + `realtime.ts` hold typed
  **stubs** (`notImplemented(...)`) for these endpoints — Phase 1 implements the bodies.
- Migrations `0001`–`0004` created the tables, the enums, RLS on every table, and the
  security-definer membership helpers (`auth_is_room_member`, `auth_is_room_host`,
  `auth_owns_member`). The RLS policies were written **assuming privileged inserts go
  through RPCs** — `rooms` and `room_members` have no insert policy on purpose.
- A Phase-0 smoke read path exists and must be torn down this phase: the permissive
  `restaurants_select_phase0_smoke` policy + `grant select on restaurants to anon`
  (`0003`), and `fetchSmokeRestaurant` + the app smoke screens.

### Which operations are RPCs vs. direct RLS writes

A privileged write needs a `security definer` RPC **only** when it crosses an RLS boundary.
Decide once, here, so the agent doesn't reinvent it per prompt:

- **Security-definer RPCs (required):** `create_room` (no insert policy on `rooms`;
  generates the code, creates the host member, sets `host_member_id`), `join_room` (must
  look up a room *by code that the caller is not yet a member of* — `rooms_select_member`
  would block a direct read — and insert a `room_members` row), `update_room_filters`
  (host check + forward-compatible session-state guard).
- **Direct RLS-scoped table writes (no RPC):** `set_presence` and member self-`leave_room`
  update the caller's own `room_members` row (`room_members_update_own` already permits
  this); host `end_room` flips `rooms.is_active` (`rooms_update_host` already permits this).

### Phase 1 maps to five roadmap bullets + one exit criterion

- `create_room`/`join_room`/`update_room_filters`/`set_presence`/`leave_room` → Prompts 1, 2, 3
- Guest flow + optional account + guest→account upgrade → Prompts 3 (guest), 6 (account/upgrade)
- Room lobby UI with live presence via Realtime → Prompts 2 (publication), 3 (subscribe helper), 4, 5
- 6-digit code generation + join, and the link/QR join path → Prompts 2 (code gen), 4, 5
- Rate-limit room creation/joins → Prompt 2 (in the RPCs), 3 (error mapping)

**Exit check (after all 7):** a host creates a room on web, a friend joins via code on
mobile and via link on web, both see each other present in the lobby in real time, and CI
is green.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and the docs/ files it points to that are relevant to this task.
- Honor the §2 invariants and §3 security rules at all times: provider/service-role keys
  are server-only and must never appear in apps/* or packages/*; RLS on every table; a
  member can only read/write rows for rooms they belong to; domain rules live in
  packages/core and are never duplicated.
- This is Phase 1 (Rooms & identity) per docs/07-initial-roadmap.md. Do NOT build Phase 2+:
  no provider calls, no start_session / deck caching, no swiping, no match or ranking logic.
  The lobby's "Start session" control is a disabled placeholder this phase.
- HOST-LEAVE POLICY (resolved; was CLAUDE.md §9): when the host leaves, the room ends — the
  room is soft-closed and any in-flight session is cancelled. Host role is NOT transferred.
  Sessions arrive in Phase 2, so in Phase 1 there is no session to cancel: a host leaving
  simply closes the room (same outcome as end_room).
- Database changes are NEW migrations under supabase/migrations/ — never edit an applied one.
- Map snake_case DB columns to camelCase at the @munch/api-client boundary (docs/06 §5).
- Make the smallest change that satisfies the task. TypeScript strict everywhere.
- If you change behavior a doc describes, update that doc in the same change (CLAUDE.md §1).
- When done, run the stated acceptance checks and report their actual output.
```

---

## Prompt 1 — Core: finish the room/membership contracts

```
Goal: add the few request/response contracts Phase 1 needs that Phase 0 did not create, so
api-client and both apps share one typed source of truth. Small, foundational change.
Reference: docs/04-api-specification.md (§3.10 leave_room/end_room), docs/03-database-schema.md
(rooms, room_members), docs/06-coding-standards.md (§3 Zod-as-source-of-truth).

Context: @munch/core already has schemas/types for create_room, join_room,
update_room_filters, set_presence (src/validation/rooms.ts) and the Room/RoomMember types.
Do NOT duplicate or restate those — only add what's missing.

Deliver:
- src/validation/rooms.ts: add Zod schemas + z.infer types for leave_room and end_room
  (request/response) per doc 04 §3.10. leave_room takes no body beyond the authed session
  context (it acts on the caller's own membership); end_room is host-only and returns the
  soft-closed room. Keep wire shapes snake_case.
- If the lobby needs typed read shapes not already covered (e.g. a "room + members" view
  used to hydrate the lobby on mount), add minimal schemas/types for them; otherwise reuse
  the existing Room/RoomMember types. Prefer reusing existing types.
- Export everything via the existing src/validation/index.ts and src/types/index.ts barrels.

Done when: `pnpm --filter @munch/core typecheck` and `pnpm --filter @munch/core test` pass,
and the new types are importable from "@munch/core".
```

---

## Prompt 2 — Supabase: membership RPCs, rate limiting, realtime, smoke teardown

```
Goal: the server-authoritative backend for rooms & identity — the privileged RPCs, the
Realtime publication that powers live presence, per-identity rate limiting, and the teardown
of the Phase-0 smoke artifacts.
Reference: docs/03-database-schema.md (entire), docs/04-api-specification.md (§3.1–§3.4,
§3.10, §6 rate limiting), docs/02-system-architecture.md (§5 realtime, §7 boundaries),
CLAUDE.md §2, §3, §6. The membership helpers (auth_is_room_member/host, auth_owns_member)
already exist in 0003; reuse them.

All new work is NEW migrations (start at 0005_*; never edit 0001–0004).

Deliver:
- A security-definer RPC create_room(...) matching docs/04 §3.1: generate a unique 6-digit
  code (retry on the rooms.code unique violation), insert the room, insert the host
  room_members row (role 'host', user_id = auth.uid()), set rooms.host_member_id, and return
  the documented { room, member } shape. Reject an anonymous-less / unauthenticated caller.
- A security-definer RPC join_room(code, display_name) matching docs/04 §3.2: look up the
  room by code (this is why it must be security definer — the caller isn't a member yet),
  reject ROOM_NOT_FOUND / ROOM_CLOSED (is_active = false) / ALREADY_JOINED (a row already
  exists for this room_id + auth.uid()), insert the member, and return { room, member,
  members[] }.
- A security-definer RPC update_room_filters(...) matching docs/04 §3.3: NOT_HOST unless the
  caller is host; only mutate the fields provided; SESSION_INVALID_STATE if a non-lobby
  session exists for the room (no sessions exist until Phase 2, so this guard is
  forward-compatible — implement it, don't skip it). Return the updated room.
- Error convention (so the api-client can map cleanly without leaking DB text): every RPC
  raises failures via `raise exception` whose MESSAGE is EXACTLY one of the doc-04 error
  codes (ROOM_NOT_FOUND, ROOM_CLOSED, NOT_HOST, ALREADY_JOINED, RATE_LIMITED,
  SESSION_INVALID_STATE, VALIDATION_ERROR). Document this convention in a comment at the top
  of the migration so Prompt 3 can rely on it.
- Rate limiting inside create_room and join_room (docs/04 §6): per-identity, count the
  caller's recent rooms created / rooms joined within a short window and raise RATE_LIMITED
  past a sane threshold (pick reasonable defaults and comment them). Do this with the
  existing tables (count rooms via host_member_id→room_members.user_id; count joins via
  room_members.user_id + joined_at) — do NOT add a new table unless genuinely necessary.
  Note in a comment that IP-based limiting belongs at the edge/gateway and is deferred.
- Enable Supabase Realtime on room_members so presence changes fan out:
  `alter publication supabase_realtime add table room_members;`. Realtime respects RLS, and
  room_members_select_same_room already scopes reads to co-members — confirm that in a
  comment.
- Phase-0 smoke teardown migration: DROP the permissive `restaurants_select_phase0_smoke`
  policy and REVOKE the `select on restaurants to anon` grant added in 0003. Leave the
  restaurants table + RLS in place with no select policy (deck-scoped reads land in Phase 2).
- Do NOT touch set_presence / leave_room / end_room here — those are direct RLS-scoped table
  writes done in the api-client (Prompt 3); the policies they rely on
  (room_members_update_own, rooms_update_host) already exist.

Done when: `supabase db reset` applies all migrations cleanly; manual checks confirm
create_room returns a 6-digit code and a host member, join_room by that code adds a second
member and rejects a duplicate join and a closed room, update_room_filters rejects a
non-host, and `select * from pg_publication_tables where pubname='supabase_realtime'`
includes room_members. Verify the smoke policy/grant are gone and RLS is still enabled on
every table.
```

---

## Prompt 3 — api-client: implement the room/membership + realtime + lobby-read layer

```
Goal: turn the Phase-0 stubs into working, typed endpoints — the only package that knows
endpoint names/shapes — plus the realtime subscribe helper and the lobby read helpers, and
remove the smoke read.
Reference: docs/04-api-specification.md (§3.1–§3.4, §3.10, §4 realtime), docs/05-folder-structure.md
(§6), docs/06-coding-standards.md (§5 snake↔camel, §8 error shape, §9 no leaked DB errors).
Depends on Prompts 1 and 2.

Deliver:
- Implement createRoom, joinRoom, updateRoomFilters in src/endpoints/rooms.ts by calling the
  new RPCs (supabase.rpc(...)). Map snake_case results to the camelCase @munch/core types at
  this boundary. Return the existing ClientResult<T> envelope.
- Implement setPresence (direct update of the caller's own room_members row — is_present),
  and add leaveRoom (member self-leave: set is_present=false, left_at=now() on own row) and
  endRoom (host: set rooms.is_active=false). These use direct table writes under existing
  RLS — no RPC. For leaveRoom, if the caller is the room host, end the room: soft-close it
  (rooms.is_active=false), the same outcome as endRoom — the resolved host-leave policy (was
  CLAUDE.md §9; host role is NOT transferred). Phase 2 will additionally cancel any in-flight
  session; there are no sessions to cancel in Phase 1.
- Extend toApiError (src/errors.ts) to map an RPC exception whose message is a known doc-04
  error code onto that ErrorCode; anything unrecognized stays VALIDATION_ERROR and the raw
  text is logged, never surfaced. Keep the existing 42501→FORBIDDEN mapping.
- Thin typed read helpers the lobby needs (under RLS): getRoom(roomId) and
  getRoomMembers(roomId), mapping snake→camel to Room / RoomMember[]. No business logic.
- Implement subscribeRoom(client, roomId) in src/endpoints/realtime.ts: subscribe to
  postgres_changes on room_members filtered to room_id and invoke a callback on
  insert/update/delete so the lobby can refresh presence. Only aggregate/co-member data is
  ever exposed — never another member's swipes (none exist yet anyway). Leave subscribeSession
  a stub (Phase 2).
- Remove fetchSmokeRestaurant and the SMOKE_RESTAURANT_ID/restaurant-row mapping in
  src/restaurants.ts now that the smoke policy is gone (the apps stop using it in 4 & 5).
  Drop the now-dead export from index.ts. Keep signInAnonymously.

Done when: `pnpm --filter @munch/api-client typecheck` passes; no server-only secret is
referenced anywhere in the package; the smoke read is gone; createRoom/joinRoom round-trip
the new RPCs against local Supabase and surface mapped ApiError codes (not raw DB text).
```

---

## Prompt 4 — Web: guest create / join / lobby with live presence

```
Goal: the Next.js flows that satisfy the web side of the Phase 1 exit criterion — a guest
creates a room, others join by code or by link, and the lobby shows live presence.
Reference: docs/05-folder-structure.md (§4 routes), docs/04-api-specification.md (§4 channels),
docs/01-product-specification.md (§5 user flow, §4 host/member/guest). docs/08-tech-stack.md
(§4 TanStack Query). Depends on Prompt 3. Can run in parallel with Prompt 5.

Deliver (App Router, per the doc-05 §4 layout):
- app/page.tsx: replace the Phase-0 SmokeTest with a home screen offering "Create a room"
  and "Join a room". Guest is the default path: a name is all that's required (sign in
  anonymously via @munch/api-client before create/join).
- app/room/create/page.tsx: host enters display name + anchor (label + lat/lng — a simple
  text/coords input is fine this phase) + the v1 room filters (open-now, cuisines, price
  range) + default radius, calls createRoom, and routes to the lobby.
- app/room/join/[code]/page.tsx: the link/QR target. Pre-fills the code from the route,
  prompts for a display name, calls joinRoom, routes to the lobby. A bare /room/join entry
  (manual code entry) should resolve to the same join logic.
- app/room/[roomId]/lobby/page.tsx: live member list with presence, driven by subscribeRoom
  (refresh on the realtime event) over an initial getRoom + getRoomMembers read. Show an
  invite affordance: the 6-digit code, a copyable join link (/room/join/{code}), and a QR of
  that link (a lightweight QR lib is fine). Host sees a disabled "Start session (Phase 2)"
  control. set_presence on mount/unmount so presence reflects lobby membership.
- Keep screens thin: all data access goes through @munch/api-client; no endpoint shapes,
  row mapping, or domain rules in components (CLAUDE.md §4, docs/06 §6). Reuse @munch/core
  types. Use TanStack Query for the reads.
- Env: reuse NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. No new secrets.

Done when: `pnpm dev:web` runs; from two browser sessions a host can create a room and a
second guest can join (by code AND via the /room/join/{code} link) and both appear present
in the lobby, updating live without a manual refresh; `pnpm --filter @munch/web build` passes.
```

---

## Prompt 5 — Mobile: guest create / join / lobby with live presence + deep links

```
Goal: the Expo flows that satisfy the mobile side of the Phase 1 exit criterion — guest
create/join, a live-presence lobby, and join-by-link via a deep link.
Reference: docs/05-folder-structure.md (§3 routes), docs/04-api-specification.md (§4),
docs/01-product-specification.md (§5), docs/08-tech-stack.md (§2.1, §4). Depends on Prompt 3.
Can run in parallel with Prompt 4.

Deliver (expo-router, per the doc-05 §3 layout):
- app/index.tsx: replace the Phase-0 smoke screen with a home screen — "Create a room" /
  "Join a room", guest-by-default (anonymous sign-in before create/join).
- app/room/create.tsx, app/room/join.tsx: mirror the web create/join flows (name + anchor +
  filters + radius for create; code + name for join) via @munch/api-client.
- app/room/[roomId]/lobby.tsx: live member list with presence via subscribeRoom over an
  initial getRoom + getRoomMembers read; invite affordance (code + a Share of the join link,
  optional QR); disabled "Start session (Phase 2)" for the host; set_presence on focus/blur.
- Deep linking: configure the app scheme + a universal/app link in app.json and the
  expo-router route so the same /room/join/{code} link opens the join screen with the code
  pre-filled (parity with web). No <form> semantics that conflict with RN — explicit handlers
  only (docs/06 §6).
- Reuse @munch/core types and @munch/api-client; no duplicated logic or row mapping in the app.
- Env: reuse EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. No new secrets.

Done when: `pnpm dev:mobile` boots in Expo; a guest can create a room and another device/sim
can join by code and via the join link, both showing present in the lobby live; opening a
/room/join/{code} link routes into the join screen; the app typechecks.
```

---

## Prompt 6 — Optional accounts + guest→account upgrade

```
Goal: the optional account flow and the guest→account upgrade path (the retention hook),
layered on top of the guest experience without making accounts required.
Reference: docs/01-product-specification.md (§10 identity), docs/04-api-specification.md (§2
auth), docs/03-database-schema.md (§3.1 profiles), CLAUDE.md §3 (guests ephemeral; only
signed-in users persist). Depends on Prompts 3, 4, 5.

Key model fact: a Munch member is a guest vs. an account based on the PRESENCE OF A profiles
ROW, NOT on user_id (guests already have an anonymous auth.users id as user_id). Upgrading a
guest LINKS an email/identity to that same anonymous auth user, so room_members.user_id is
unchanged — the upgrade just adds a profiles row.

Deliver:
- Supabase config: enable email (magic link / OTP) sign-in (and optionally an OAuth provider)
  and ensure anonymous-user identity linking is enabled, in supabase/config.toml.
- A NEW migration adding a profiles_insert_own policy (with check id = auth.uid()) so a
  signed-in user can create their own profile row; keep profiles_update_own. (No insert
  policy existed before.) Ensure anonymous-only users do not get a profile (gate in app/auth
  helper, not by inserting on anon sign-in).
- api-client auth helpers (src/auth.ts): signInWithEmail (magic link / OTP) for a fresh
  account, and upgradeGuestToAccount that links an email to the current anonymous user
  (supabase.auth.updateUser({ email }) → verification) and, on confirmation, ensures a
  profiles row exists with the chosen display name. Return the standard ClientResult/ApiError
  envelope; never leak raw auth errors.
- Minimal UI on both apps: an optional "Sign in / save my matches" entry (home and/or lobby)
  that runs the account or upgrade flow. This is intentionally lean — full account UX and the
  history screen are Phase 4. Guest remains the default and is never blocked.

Done when: a guest can upgrade to an email account without losing their current room
membership (same user_id, new profiles row); a fresh user can sign in by email; guests still
work end-to-end with no account; typecheck/lint pass on the touched packages and apps.
```

---

## Prompt 7 — Tests, doc reconciliation, and Phase 1 exit verification

```
Goal: lock down the highest-value Phase 1 behavior with tests, reconcile docs with the
choices made, and verify the exit criterion + green CI.
Reference: docs/06-coding-standards.md (§10 testing, §11 CI), docs/07-initial-roadmap.md (§3
exit criteria), CLAUDE.md §1 (code/doc parity), §7 (testing). Depends on Prompts 1–6.

Deliver:
- Integration tests against local Supabase (provider not involved this phase) for the
  membership RPCs: create_room returns a unique 6-digit code + host member; join_room adds a
  member, and rejects ROOM_NOT_FOUND / ROOM_CLOSED / ALREADY_JOINED; update_room_filters
  rejects a non-host (NOT_HOST); rate limiting raises RATE_LIMITED past the threshold. Keep
  tests fast; no real provider.
- A focused test that the api-client maps an RPC error message onto the correct ErrorCode and
  never surfaces raw DB text.
- Doc reconciliation (same PR, per CLAUDE.md §1): note in docs/04-api-specification.md that
  set_presence / leave_room / end_room are implemented as direct RLS-scoped table writes
  (not RPCs) and why; record the per-identity rate-limit approach + that IP-based limiting is
  deferred to the edge; and reflect the resolved host-leave policy — a host calling leave_room
  ends the room (soft-close), the same as end_room, with no host transfer.
- Confirm CI (.github/workflows/ci.yml) still passes the assembled tree, including the
  secret-leak guard (no provider/service-role key under apps/* or packages/*).

Done when: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green; the membership
RPC tests pass against local Supabase; the docs reflect the implemented behavior; and the
manual exit check holds — a host creates a room on web and a friend joins via code on mobile
and via link on web, with both present in the lobby in real time.
```
