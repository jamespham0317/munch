# Phase 4.7 — Presence/membership split: Agent Prompts

**Project:** Munch
**Source:** `docs/07-initial-roadmap.md` §6.7 (Phase 4.7)
**Purpose:** Phase 4.7 broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence.

- **Prompt 1** (core) and **Prompt 2** (schema + cohort swap) are independent and may run in parallel.
- **Prompt 3** depends on Prompt 2 (it builds on the new schema/functions).
- **Prompt 4** (api-client) depends on Prompts 1–3.
- **Prompts 5 (web)** and **6 (mobile)** depend on Prompt 4 and may run in parallel.
- **Prompt 7** (tests + docs + exit) depends on all of the above.

**Prepend the shared preamble to every prompt.**

Phase 4.7 makes **activity status purely cosmetic** and re-bases matchmaking on **room
membership** (roadmap §6.7). Today `room_members.is_present` is *both* the cosmetic "Here/Away"
indicator *and* the unanimous-match cohort. This phase **splits them**: presence becomes
cosmetic-only (driven by Realtime Presence, never read by matchmaking) and the match cohort
becomes the set of **active members** (`room_members.left_at IS NULL`). Every member's swipes
count regardless of focus; members control participation by **joining/leaving**, and a dropped
connection auto-removes them after a grace window. It touches `@munch/core`, new SQL migrations,
the api-client, and both apps — and it **reverses a load-bearing invariant** (CLAUDE.md §2.3 /
docs/02 §5: "every member" was *every present member*; it becomes *every active member*), so the
lockstep doc updates in Prompt 7 are mandatory, not optional.

### Resolved decisions driving this phase (do not relitigate)

- **Activity status is cosmetic.** Here/Away never affects matchmaking. The cohort for the
  unanimous check, deck-exhaustion check, and ranking is **active members** (`left_at IS NULL`).
- **Away = backgrounded/hidden but connected.** A member with the app/tab open but not focused
  is **Away** and **still in the cohort** (their like is still required, their swipes still
  count). Only a **disconnect** removes them — and only after a grace window.
- **Leaving removes you from the cohort.** A non-host "Leave room" (host: "End room") removes the
  member: set `left_at`, **delete that member's swipes** for non-terminal sessions, and re-run the
  match check across the remaining active members.
- **Match fires immediately on membership change.** If a leave/removal makes the remaining active
  members' existing likes unanimous, the match is declared at once — server-side, authoritative —
  without waiting for another swipe.
- **Minimum cohort = 1.** A solo remaining active member matches on their first like. If **every**
  member leaves, the session ends `cancelled` and the room closes.
- **Host leave/end/disconnect closes the room.** Explicit host-leave, host "End room", and host
  auto-removal (disconnect past grace) all cancel any non-terminal session (`cancelled`) and
  soft-close the room (`is_active = false`). **Host role is never transferred** — this preserves
  the existing resolved policy (CLAUDE.md invariant 3). Host is treated identically to any member
  on disconnect (no special longer grace).
- **Roster freezes at session start.** Joining is **lobby-only**. Once a session exists for the
  room, `join_room` rejects new *and* returning members with `ROOM_IN_SESSION`. The cohort can
  only shrink once swiping begins; there is no "join mid-session".

### What's already in place (build on this, don't rebuild)

- **`is_present` is the cohort today.** `check_unanimous_match` (migration 0010),
  `is_deck_exhausted` (0014), and `get_resolution_ranking` (0015) all scope to
  `room_members.is_present = true`. `submit_swipe` (0010/0014/0016) calls the first two.
- **Sticky-present client logic.** `apps/{web,mobile}/src/features/room/use-room-lobby.ts` writes
  `setPresence(true)` on mount and never `false` (a deliberate hack for the *old* model). Phase
  4.7 **removes** this; presence is no longer a DB write.
- **Leave / end already exist (as direct writes).** `leaveRoom` / `endRoom` in
  `packages/api-client/src/endpoints/rooms.ts` and `cancel_active_session` (0011). Phase 4.7
  **promotes `leave_room` to a security-definer RPC** (it must read all swipes + write
  matches/sessions for the immediate recheck) and keeps the host-close behavior.
- **Realtime is wired.** `subscribeRoom` (`endpoints/realtime.ts`) fires on `room_members`
  changes; `sessions`/`matches` are published (0012); **`swipes` are deliberately NOT published**
  (CLAUDE.md §3). The immediate match reveal reuses the existing `matches`-insert event path.
- **Match history writer exists.** `record_match_history(p_session_id)` (0016) is the
  service-role writer called by `submit_swipe` and `resolve-session`. The immediate recheck must
  call it too on a match.
- **`join_room` (0005)** already guards `ROOM_NOT_FOUND` / `ROOM_CLOSED` / `ALREADY_JOINED` /
  `RATE_LIMITED` and rate-limits per identity. Phase 4.7 adds one guard before the insert.
- **Domain logic is cohort-parameterized.** `isUnanimousLike` / `rankByClosestToUnanimous`
  (`packages/core/src/domain`) already take member-id arrays — the *caller* supplies the cohort.
  Only their JSDoc says "present"; the functions themselves need no logic change.
- **Member UI reads `is_present`.** `member-list.tsx` + `ui/avatar.tsx` (both apps) render the
  green dot + "Here/Away" from `member.isPresent`. Phase 4.7 repoints these at Realtime Presence.

### Pinned decisions (so the agent doesn't relitigate them)

- **Cosmetic presence = Supabase Realtime Presence**, tracked on the existing `room:{room_id}`
  channel with a `{ memberId, focused }` payload (focused from `visibilitychange` on web /
  `AppState` on mobile). **Ephemeral, zero DB writes, never read by any matchmaking code.**
  Here = focused; Away = connected-but-not-focused; no dot = absent from the channel.
- **Authoritative liveness = heartbeat to a DEDICATED table**, `member_heartbeats`
  (`member_id` PK → `room_members.id`, `last_seen_at timestamptz`). **Do NOT put `last_seen_at`
  on `room_members`** — `room_members` is in the realtime publication and a per-10s heartbeat
  there would storm `subscribeRoom`. The heartbeat table is **not** published; only the sweeper
  reads it (security definer). This refines the original spec, which floated `last_seen_at` on
  `room_members`.
- **Auto-removal = `prune_absent_members()` on a schedule.** Use **`pg_cron`** (Supabase
  extension) to call it every `SWEEP_INTERVAL_S`. It removes any active member whose
  `COALESCE(last_seen_at, joined_at)` is older than `MEMBER_ABSENCE_GRACE_S`, applying the same
  removal path as an explicit leave (delete swipes → immediate recheck → host-close / empty-cancel).
  If `pg_cron` is unavailable in the target environment, the documented fallback is a scheduled
  Edge Function calling the same `prune_absent_members()` RPC — but **default to `pg_cron`**.
- **Single cohort predicate: `left_at IS NULL`.** Drop the `is_present` column. "Active member"
  is defined once and used by every check.
- **Immediate recheck = `recheck_unanimous_on_membership_change(p_session_id)`**, security
  definer, called by both `leave_room` and `prune_absent_members`. For each non-terminal session
  (`active` or `awaiting_host_resolution`), if any deck restaurant is liked by **all** active
  members (active count > 0), declare the match (`resolution = 'unanimous'`, idempotent on
  `matches.session_id`, flip session `matched`, call `record_match_history`). If several qualify,
  pick by closest-to-unanimous order (rating desc, distance asc — all have 0 active passes).
- **Swipes deleted on removal.** On leave/auto-removal, delete the member's `swipes` for
  non-terminal sessions so they truly stop counting and can't resurrect. Re-join (lobby-only)
  reactivates the **same** `room_members` row (`left_at = NULL`, fresh `joined_at`) clean — this
  respects the partial unique index `room_members (room_id, user_id) where user_id is not null`.
- **Timing constants live in `@munch/core`:** `HEARTBEAT_INTERVAL_S = 10`,
  `MEMBER_ABSENCE_GRACE_S = 45`, `SWEEP_INTERVAL_S = 15`. SQL can't import core, so the grace +
  sweep cadence are duplicated in the migration with a keep-in-sync comment (same pattern as the
  radius bounds in `start-session`).
- **Preserve every §2 invariant** (per-session caching, shared deck + host-controlled filters,
  server-authoritative match check, closest-to-unanimous ranking) and the host-leave policy. This
  phase only changes *who is in the cohort* and *how presence is shown* — never the provider call
  count, the deck model, or the ranking math.

### Phase 4.7 maps to the roadmap §6.7 bullets + the exit criterion

- Split presence from the cohort (cohort = `left_at IS NULL`) → Prompt 1 (types/constants/docs),
  Prompt 2 (schema + cohort swap in the three functions)
- Cosmetic Here/Away via Realtime Presence → Prompt 4 (helpers) + Prompts 5/6 (focus + dots)
- Explicit leave removes from cohort + immediate recheck; host-close → Prompt 3 (`leave_room`,
  `recheck_…`) + Prompt 4 (api-client) + Prompts 5/6 (controls)
- Auto-remove on disconnect (heartbeat + sweeper) → Prompt 2 (heartbeat table), Prompt 3
  (`prune_absent_members` + `pg_cron`), Prompt 4 (heartbeat write), Prompts 5/6 (heartbeat loop)
- Min cohort = 1; roster freezes at start (`ROOM_IN_SESSION`) → Prompt 1 (error code), Prompt 3
  (`join_room` guard), Prompt 4 (mapping), Prompts 5/6 (join-rejected + removed-state routing)
- Tests + lockstep doc reconciliation + exit verification → Prompt 7

**Exit check (after all 7):** on **both** apps — a backgrounded member shows "Away" yet their
like is still required and still completes a match; closing the app removes the member after the
grace window and their swipes stop counting; tapping "Leave" removes a member immediately and, if
that makes the remaining likes unanimous, the match fires at once; a solo remaining member can
match and an emptied room ends `cancelled`; the host leaving/ending/disconnecting closes the room
(no transfer); no one can join or re-join after the session has started (`ROOM_IN_SESSION`); and
**no matchmaking path reads presence**. The single restaurant-provider call per session is
unchanged. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green, and no doc or
in-code comment still claims presence drives matchmaking.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and the docs/ files it points to that are relevant to this task —
  especially docs/07-initial-roadmap.md §6.7 (Phase 4.7), docs/02-system-architecture.md §5–§6
  (match check / state machine), docs/03-database-schema.md §3.3/§5/§6/§7, and
  docs/04-api-specification.md §3.2/§3.4/§3.7/§3.8/§3.10 + §4.
- This phase CHANGES a load-bearing invariant: the match cohort is no longer "present members"
  but "ACTIVE members" (room_members.left_at IS NULL). Activity status (Here/Away) becomes PURELY
  COSMETIC and must never be read by matchmaking. Honor all four CLAUDE.md §2 invariants and §3
  security rules otherwise — in particular the match check stays SERVER-AUTHORITATIVE and
  transactional, swipes are never exposed to other clients, and the single restaurant-provider
  fetch stays at start_session (one per widen). Provider/service-role keys never enter apps/* or
  packages/*.
- Phases 1–4.6 are DONE — do NOT rebuild rooms, the match mechanic, resolution, filters, auth,
  match history, or the anchor map. Make the smallest change that satisfies the task.
- RESOLVED DECISIONS (do not relitigate): presence is cosmetic (Realtime Presence, no DB);
  cohort = active members (left_at IS NULL); Away = backgrounded-but-connected (still counts);
  disconnect past grace auto-removes; explicit leave removes + deletes that member's swipes +
  re-checks for an immediate match; match fires immediately on membership change; min cohort = 1
  (empty room -> cancelled + closed); host leave/end/disconnect closes the room with NO transfer;
  joining is lobby-only (ROOM_IN_SESSION once a session exists).
- PINNED MECHANISM: cosmetic Here/Away via Supabase Realtime Presence ({ memberId, focused }) on
  room:{room_id}; authoritative liveness via a heartbeat to a DEDICATED member_heartbeats table
  (NOT room_members, to avoid realtime refetch storms), reaped by prune_absent_members() on
  pg_cron every SWEEP_INTERVAL_S; cohort predicate is left_at IS NULL everywhere; immediate match
  on membership change via recheck_unanimous_on_membership_change(); timing constants
  (HEARTBEAT_INTERVAL_S=10, MEMBER_ABSENCE_GRACE_S=45, SWEEP_INTERVAL_S=15) live in @munch/core
  and are duplicated into SQL with a keep-in-sync comment.
- Migrations are immutable once applied (CLAUDE.md §6): NEVER edit an applied migration — add a
  new one (next number after 0016). Use create-or-replace for functions. Every new table needs
  RLS + a policy.
- TypeScript strict everywhere; no business logic or data access in components (CLAUDE.md §4);
  snake_case at the DB, camelCase at the api-client boundary (docs/06 §5).
- If you change behavior a doc (or an in-code comment / JSDoc) describes, update it in the same
  change (CLAUDE.md §1). When done, run the stated acceptance checks and report their actual output.
```

---

## Prompt 1 — Core: cohort vocabulary, timing constants, ROOM_IN_SESSION, presence/heartbeat types

```
Goal: prepare @munch/core for the presence/membership split — drop is_present from the member
type, add the active-member vocabulary, the timing constants, the new error code, and any
request/validation shapes the later prompts need. Pure package; no RN/DOM imports.
Reference: docs/03-database-schema.md §3.3, docs/04-api-specification.md §1 (error codes) + §3.4,
docs/06-coding-standards.md §3, CLAUDE.md §4/§5. Independent of the migrations; may run alongside
Prompt 2.

Context: packages/core/src/types/room.ts defines RoomMember with isPresent; src/constants.ts owns
RADIUS_* etc.; src/domain/{matching,ranking}.ts are cohort-parameterized but their JSDoc says
"present members"; src/validation owns the Zod request schemas; error codes are referenced across
the app and mapped in packages/api-client/src/errors.ts.

Deliver:
- types/room.ts: replace `isPresent` on RoomMember with the membership marker `leftAt: string |
  null` if not already present, and define a clear notion of "active member" (leftAt === null).
  Remove isPresent from the type and from any re-exports. (Cosmetic presence is NOT a RoomMember
  field — it lives in Realtime Presence.)
- constants.ts: add HEARTBEAT_INTERVAL_S = 10, MEMBER_ABSENCE_GRACE_S = 45, SWEEP_INTERVAL_S = 15
  with a comment that the SQL sweeper duplicates the grace/sweep values and they must stay in sync.
- Error code: add ROOM_IN_SESSION to the shared ErrorCode union (wherever the canonical list
  lives) so the api-client and apps can reference it. Add a short doc line.
- validation: if presence is still represented in a request schema (setPresence), reframe or
  remove it — presence is no longer a server write. Add any small schema the later prompts need
  (e.g. a heartbeat target shape) ONLY if it earns its place; otherwise leave it to the api-client.
- domain/{matching,ranking}.ts: update the JSDoc from "present members" to "active members
  (left_at IS NULL)" — these are the optimistic mirrors of the now-active-scoped server checks.
  Do NOT change the function signatures or logic (they already take a cohort array).
- Update any @munch/core unit tests whose fixtures/names say "present" to "active"; add a test
  asserting the new constants are exported and ordered sanely (grace > heartbeat).

Done when: `pnpm --filter @munch/core typecheck` and `pnpm --filter @munch/core test` pass;
RoomMember no longer has isPresent; the three constants and ROOM_IN_SESSION export from
"@munch/core"; no RN/DOM import leaks into the package.
```

---

## Prompt 2 — Migration A: schema (drop is_present, add member_heartbeats) + cohort predicate swap

```
Goal: land the schema change and re-base the three matchmaking functions onto active membership.
Reference: docs/03-database-schema.md §3.3/§3.7/§5/§6, migrations 0002 (room_members), 0003 (RLS),
0010 (check_unanimous_match), 0014 (is_deck_exhausted), 0015 (get_resolution_ranking). New
migration(s), next number after 0016. NEVER edit an applied migration.

Context: room_members.is_present is currently the cohort. submit_swipe (0010/0014/0016) calls
check_unanimous_match and is_deck_exhausted, so replacing those via create-or-replace re-bases the
hot path automatically. room_members is in the supabase_realtime publication (0006/0012) — that's
why the heartbeat goes in a SEPARATE table, not a new column here.

Deliver (one or more migrations, e.g. 0017_membership_cohort.sql):
- ALTER TABLE room_members DROP COLUMN is_present. Add a partial index:
  `create index on room_members (room_id) where left_at is null;` (cheap cohort/sweeper scans).
  Confirm no RLS policy or the realtime publication referenced is_present (they key on user_id).
- CREATE TABLE member_heartbeats (member_id uuid primary key references room_members(id) on
  delete cascade, last_seen_at timestamptz not null default now()). Enable RLS. Policy: a caller
  may insert/update its OWN heartbeat — `exists (select 1 from room_members rm where rm.id =
  member_id and rm.user_id = auth.uid())`. No select grant needed for clients (only the sweeper
  reads it, security definer). grant insert/update to authenticated. Do NOT add this table to the
  realtime publication.
- create or replace check_unanimous_match(p_session_id, p_restaurant_id): swap the present_members
  predicate `rm.is_present = true` -> `rm.left_at is null`. Keep it security definer/stable and the
  >0-and-equal logic identical otherwise. Refresh its header comment to "active members".
- create or replace is_deck_exhausted(...): same cohort swap (active members must have swiped every
  card). Refresh the comment.
- create or replace get_resolution_ranking(...): member_count / pass_count / like_count scoped to
  active members (left_at is null), keeping the order pass_count asc, rating desc nulls last,
  distance_m asc and the haversine_m distance. Refresh the comment.
- Re-pin execute grants on any replaced function to match their originals.

Done when: `supabase db reset` applies cleanly; room_members has no is_present and the
member_heartbeats table + RLS exist; the three functions compile and use left_at is null; the
existing sessions/swipes integration tests (api-client) still pass against local Supabase with the
cohort now active-scoped (update any fixture that toggled is_present to instead set/clear left_at).
```

---

## Prompt 3 — Migration B: leave_room RPC, immediate recheck, prune sweeper (pg_cron), join_room guard

```
Goal: implement the membership lifecycle server-side — explicit leave, immediate match-on-leave,
disconnect auto-removal, and the roster-freeze join guard. New migration(s) after Prompt 2.
Reference: docs/04-api-specification.md §3.2/§3.10, docs/01 §7 (host departure), migrations 0005
(join_room, error convention), 0011 (cancel_active_session), 0016 (record_match_history). Depends
on Prompt 2.

Context: today leaveRoom/endRoom are direct api-client writes; the host-close half already calls
cancel_active_session (0011). Phase 4.7 needs the recheck + swipe-deletion to be transactional and
to read ALL members' swipes -> these must be security-definer SQL, not client writes. Errors are
raised as the bare doc-04 code in the exception message (same convention as 0005/0010).

Deliver (e.g. 0018_membership_lifecycle.sql, 0019_join_room_guard.sql):
- recheck_unanimous_on_membership_change(p_session_id) [security definer]: for the session if it is
  non-terminal (active OR awaiting_host_resolution), find any cached_decks restaurant liked by ALL
  active members (active count > 0). If one or more qualify, pick by (rating desc nulls last,
  distance_m asc) and declare the match: insert matches (resolution 'unanimous', on conflict
  (session_id) do nothing), update sessions -> matched + matched_restaurant_id + ended_at (guarded
  on a non-terminal status), and call record_match_history(p_session_id). Idempotent.
- leave_room(p_room_id) [security definer RPC, replaces the direct-write path]: authn; resolve the
  caller's own member row; set left_at = now(); DELETE that member's swipes for the room's
  non-terminal sessions; then:
    • If the caller is the HOST -> cancel_active_session(p_room_id) + rooms.is_active = false
      (room closes; no transfer).
    • Else, for each non-terminal session: if the removal leaves ZERO active members ->
      cancel_active_session + rooms.is_active = false; otherwise call
      recheck_unanimous_on_membership_change(session) to fire an immediate match if now unanimous.
  Return a small jsonb ({ member: { id, left_at }, room_ended: bool }). Bare-code errors
  (UNAUTHENTICATED / FORBIDDEN). grant execute to authenticated.
- prune_absent_members() [security definer]: for every active member (left_at is null) whose
  COALESCE(member_heartbeats.last_seen_at, room_members.joined_at) < now() -
  (MEMBER_ABSENCE_GRACE_S || ' seconds')::interval, apply the SAME removal path as leave_room
  (delete swipes -> host-close OR empty-cancel OR recheck). Process host removals as room-close.
  Duplicate the grace value here with a "keep in sync with @munch/core MEMBER_ABSENCE_GRACE_S"
  comment. Schedule it with pg_cron every SWEEP_INTERVAL_S seconds (create extension if not exists
  pg_cron; cron.schedule(...)). If pg_cron is unavailable, leave the function in place and add a
  comment that a scheduled Edge Function must call it instead (do not block on this).
- create or replace join_room(...): after the existing ROOM_CLOSED check and before the insert,
  reject with `raise exception 'ROOM_IN_SESSION'` if a sessions row exists for the room (the
  session has started). Keep all other guards and the rate limit. Re-join in the lobby (no session
  yet) must still reactivate a previously-left row cleanly (left_at = null, fresh joined_at) rather
  than tripping ALREADY_JOINED — handle the reactivation explicitly.

Done when: `supabase db reset` applies; an integration test shows: a non-host leave that completes
a unanimous match flips the session to matched WITHOUT another swipe; a leave to zero active
members cancels the session and closes the room; a host leave closes the room; prune_absent_members
removes a member whose heartbeat is older than the grace and triggers the same outcomes; join_room
raises ROOM_IN_SESSION once a session exists but allows lobby re-join. Use direct function calls /
manipulated last_seen_at for determinism (no real timers).
```

---

## Prompt 4 — api-client: leave_room RPC, heartbeat write, Realtime Presence helpers, error mapping

```
Goal: expose the new server surface through the api-client and add the cosmetic-presence +
heartbeat client helpers. This is the only place that knows endpoint names/shapes (CLAUDE.md §4).
Reference: docs/04 §3.2/§3.4/§3.10/§4, docs/06 §5, packages/api-client/src/endpoints/{rooms,
realtime}.ts and src/errors.ts. Depends on Prompts 1–3.

Context: leaveRoom/endRoom currently do direct table writes in rooms.ts; setPresence writes
is_present; subscribeRoom subscribes to room_members postgres_changes; errors.ts maps DB messages
to ApiError via toApiError.

Deliver:
- rooms.ts:
    • leaveRoom -> call the leave_room RPC (was a direct write); keep the LeaveRoomResult shape
      ({ member, roomEnded }). endRoom stays host-close (it may share leave_room internals or keep
      cancel_active_session). REMOVE setPresence's is_present DB write (presence is no longer a DB
      concept) — delete the function or repurpose its name to a no-op-free Realtime Presence call.
    • Mappers: drop isPresent; getRoomMembers returns ACTIVE members (left_at is null) so the lobby
      shows the live roster (left members disappear). Map leftAt through.
    • heartbeat(memberId): upsert member_heartbeats { member_id, last_seen_at: now() } under RLS.
      Cheap, fire-and-forget shape (returns ClientResult<void>).
- realtime.ts: add cosmetic Realtime Presence helpers on room:{room_id}:
    • trackPresence(channel, { memberId, focused }) and setFocused(channel, focused) using
      channel.track(); onPresenceSync(channel, cb) yielding a Map<memberId, { focused }> from
      channel.presenceState(). These never touch the DB and are never read by matchmaking.
    • subscribeRoom stays for authoritative membership (join/leave/role) — it now reflects roster
      changes, not presence. Document that presence is the Presence layer, membership is the row.
- errors.ts: add ROOM_IN_SESSION to the ErrorCode mapping so joinRoom surfaces it; map it to a safe
  message. Confirm leave_room's bare codes (UNAUTHENTICATED/FORBIDDEN) map cleanly.
- joinRoom: surface ROOM_IN_SESSION (no request-shape change).
- Update/extend api-client tests: leaveRoom calls the RPC; joinRoom maps ROOM_IN_SESSION; getRoom-
  Members excludes left members; heartbeat upserts. Keep the provider mocked / no real network.

Done when: `pnpm --filter @munch/api-client typecheck` and `... test` pass; leaveRoom hits the RPC;
no api-client code writes is_present; presence helpers and heartbeat exist; ROOM_IN_SESSION maps to
a safe ApiError.
```

---

## Prompt 5 — Web: heartbeat loop, cosmetic presence, leave/end controls, removed/locked routing

```
Goal: wire the web app to the new model — cosmetic Here/Away from Realtime Presence, a heartbeat
keepalive, a real Leave/End control that removes the member, and graceful routing when removed or
when joining a started room.
Reference: docs/09-design-system.md §8 (Squad list presence), §9 (presentation-only invariants),
docs/10-pages.md §3.5, CLAUDE.md §2.3/§3/§4. Depends on Prompt 4. May run in parallel with Prompt 6.
Study apps/web/src/features/room/{use-room-lobby,lobby-view,member-list}.tsx, components/ui/
avatar.tsx, features/session/{use-active-session,session-view}.tsx, and features/room/
join-room-form.tsx.

Deliver:
- use-room-lobby.ts (and the session hook): REMOVE the sticky setPresence(true) effect. Add:
    • a heartbeat effect calling heartbeat(memberId) every HEARTBEAT_INTERVAL_S while mounted in a
      room surface (lobby or session), cleared on unmount;
    • Realtime Presence: join the room:{room_id} channel, trackPresence({ memberId, focused }),
      update focused via a document `visibilitychange` listener; expose the presence map.
- member-list.tsx + ui/avatar.tsx: drive the green dot + "Here"/"Away" label from the PRESENCE MAP
  (focused), NOT member.isPresent. A member absent from presence shows no dot but stays listed if
  they're still an active member; a removed member drops out of the list (getRoomMembers excludes
  them). Keep it aggregate/cosmetic — never per-swipe (CLAUDE.md §3).
- Leave/End control (lobby AND session): a non-host "Leave room" calls leaveRoom (removes them);
  the host sees "End room" (closes the room). Confirm before acting (irreversible). On success
  route the caller home with a message ("You left the room").
- Removed-state routing: when the caller's own memberId is no longer in the active member list
  (observed via the subscribeRoom-invalidated members query), route out with "You were
  disconnected from the room." Offer re-join via code ONLY if the room is still pre-session.
- join-room-form.tsx: surface ROOM_IN_SESSION as "This room's session has already started." with
  no auto-retry.

Done when: `pnpm dev:web` against local Supabase shows: backgrounding the tab flips the member to
"Away" (cosmetic) while their like still completes a match; closing the tab removes them after the
grace window (their swipes stop counting); "Leave" removes a member immediately and fires a match
if it makes the rest unanimous; the host "End room" closes it; a second browser cannot join once a
session has started. `pnpm --filter @munch/web build` passes; no component reads is_present.
```

---

## Prompt 6 — Mobile: twin of Prompt 5 (Expo / React Native)

```
Goal: bring the mobile app to parity with web — heartbeat keepalive, cosmetic presence from
Realtime Presence (focus via AppState), Leave/End controls, and removed/locked routing.
Reference: same docs as Prompt 5; docs/06 §6 (no RN-form-conflicting semantics). Depends on
Prompt 4. May run in parallel with Prompt 5 and must match its behavior/contract (parity is a
project norm). Study apps/mobile/src/features/room/{use-room-lobby,lobby-view}.tsx, components/
member-list.tsx + ui/avatar.tsx, and features/session/{use-active-session,session-view}.tsx.

Deliver:
- use-room-lobby.ts (and the session hook): REMOVE sticky setPresence(true). Add the heartbeat
  effect (HEARTBEAT_INTERVAL_S) and Realtime Presence with trackPresence; drive focused from
  React Native's AppState ('active' -> focused true; 'background'/'inactive' -> false).
- member-list.tsx + ui/avatar.tsx: dot + "Here"/"Away" from the presence map, not isPresent;
  removed members drop out of the list.
- Leave/End control (lobby AND session): non-host "Leave room" -> leaveRoom; host "End room" ->
  endRoom; confirm; on success navigate home with the same messaging as web.
- Removed-state routing: detect the caller's absence from the active member list and route out
  ("You were disconnected from the room"); re-join offered only pre-session.
- Join flow: surface ROOM_IN_SESSION as "This room's session has already started."

Done when: `pnpm dev:mobile` (dev build) reaches parity with web — Away on background, auto-removal
on disconnect past grace, immediate leave + match-on-leave, host end-room close, and a blocked join
once a session has started; `pnpm --filter @munch/mobile typecheck` passes; no component reads
is_present.
```

---

## Prompt 7 — Tests, lockstep doc reconciliation, and Phase 4.7 exit verification

```
Goal: lock down the cohort/lifecycle logic with tests, reconcile every doc the new behavior
touches (this phase reverses an invariant — the doc updates are mandatory), and verify the exit
criterion + green CI.
Reference: docs/06 §10/§11, docs/07 §6.7 (exit), CLAUDE.md §1 (code/doc parity), §2/§3. Depends on
Prompts 1–6.

Deliver:
- Tests:
    • @munch/core: matching/ranking/exhaustion fixtures renamed present->active; add cases —
      leave-completes-match, leave-to-zero-cancels, solo-room-first-like-matches.
    • Integration (local Supabase, provider faked): leave_room immediate match; auto-removal via
      prune_absent_members after a stale heartbeat (manipulate last_seen_at; no real timers);
      re-join after removal starts clean (no resurrected swipes); host removal closes the room;
      join_room raises ROOM_IN_SESSION once a session exists but allows lobby re-join; the
      swipe-vs-leave race yields exactly one match.
- LOCKSTEP doc reconciliation (same change, CLAUDE.md §1) — the cohort is now ACTIVE members and
  presence is cosmetic:
    • CLAUDE.md §2.3: "every member" = every ACTIVE member (left_at IS NULL); add that cosmetic
      presence never affects matchmaking. §9: record the presence/membership split as resolved.
    • docs/01 §6/§7/§10: membership-based cohort; leave/auto-removal; lobby-only joining; min
      cohort 1. docs/02 §5/§6: re-evaluate on MEMBERSHIP change; cancelled triggers (any member ->
      0 active, or host removal). docs/03 §3.3 (drop is_present, member_heartbeats), §5/§6 (left_at
      IS NULL predicate), §7 (swipes deleted on leave). docs/04 §1 (add ROOM_IN_SESSION), §3.2
      (join guard), §3.4 (set_presence -> cosmetic Realtime Presence), §3.10 (leave_room RPC +
      auto-removal), §4 (Presence channel semantics), plus new heartbeat/prune entries.
    • docs/09 §8/§9: Squad list presence is cosmetic; activity status is presentation-only.
    • In-code comments: the use-room-lobby "STICKY present" rationale is gone; old migration
      comments are immutable (don't edit applied migrations) but the new migrations' comments
      reflect active-member semantics. Confirm no current doc/comment says presence drives matching.
- CI guard: the secret-leak guard still rejects provider/service-role key patterns under apps/*
  and packages/*; this phase introduced none.

Done when: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green tree-wide; the core +
integration tests above pass; every listed doc reflects the active-member cohort and cosmetic
presence; and the manual exit check holds on both apps — Away is cosmetic, disconnect auto-removes
after grace, leave fires an immediate match when it completes unanimity, solo match works, an
emptied room cancels, host-leave closes the room, and joining is blocked once a session has started.
```
