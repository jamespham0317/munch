# Phase 3 — Deck Exhaustion & Host Resolution: Agent Prompts

**Project:** Munch
**Source:** `docs/07-initial-roadmap.md` §5 (Phase 3)
**Purpose:** Phase 3 broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Prompts 5 and 6 (web and
mobile host-resolution UIs) can run in parallel once Prompt 4 is done.

**Prepend the shared preamble to every prompt.**

Phase 3 makes sessions **always end cleanly** (product spec §13: "never an ambiguous or
stuck state"). Phase 2 left the deck exhausting into a neutral "no match yet" state with
the session stuck `active`. Phase 3 adds the missing terminal path: detect exhaustion →
`awaiting_host_resolution`, show non-hosts a "waiting on host" state, show the host the
**closest-to-unanimous** ranking, and let the host **accept the top pick** (session →
`resolved`) or **widen** (one extra provider fetch for unseen cards, appended, resume
swiping). The two load-bearing constraints this phase touches are the **closest-to-unanimous
ranking** (CLAUDE.md §2.4 — fewest passes, NOT raw likes) and the **per-session-call
invariant** (CLAUDE.md §2.1 — widen is the *only* new provider call, exactly one per round).

### What Phase 2 already left in place (build on this, don't rebuild)

- `@munch/core` already has the complete Phase-3 contracts. **Do not redefine these:**
  - `src/validation/sessions.ts`: `getResolutionRankingRequest/Response` + `RankingEntry`
    (`{ restaurant_id, name, pass_count, like_count, member_count, rating, distance_m }`,
    documented as ordered `pass_count asc → rating desc → distance_m asc`), and
    `resolveSessionRequestSchema` as a **discriminated union on `action`**
    (`accept_top` → `{ session_id, restaurant_id }`; `widen` → `{ session_id, radius_m?,
    filters? }`) plus `resolveSessionResponseSchema` (accept → `{ session:{status}, match }`;
    widen → `{ session:{status}, new_restaurants }`).
  - `src/domain/ranking.ts`: `rankByClosestToUnanimous` is **already implemented** (fewest
    passes → highest rating → nearest distance, pure, non-mutating). It carries a
    `TODO(Phase 3)` only for **tests** — the logic stays as-is unless a test proves it wrong.
  - `MatchResolution` already includes `'host_accepted_top'`; `matchInfoSchema` already has
    optional `restaurant_name`. Reuse them; do not add a new resolution literal.
- `packages/api-client/src/endpoints/sessions.ts`: `getResolutionRanking` and
  `resolveSession` are typed **stubs** that `notImplemented(..., "Phase 3")`. `startSession`
  and `getDeck` are implemented — `getDeck` calls the `get_deck_for_session` security-invoker
  RPC (0009) which already computes `distance_m` via `haversine_m`. Phase 3 reuses both.
- `supabase/migrations/0004_functions.sql` has `get_resolution_ranking` as a `raise
  exception 'not implemented until Phase 3'` stub — Phase 3 implements it via
  `create or replace`. `0010_submit_swipe.sql` has the working `submit_swipe` +
  `check_unanimous_match`; Phase 3 **replaces `submit_swipe` via `create or replace`** to
  add exhaustion detection (it currently never transitions to `awaiting_host_resolution`).
- `supabase/functions/start-session/index.ts` is the existing Edge Function and the model
  for Phase 3's `resolve-session`: it holds the service-role + provider keys, calls the
  provider **exactly once** through `_shared/provider` (`getProvider()` +
  `getProviderCallCount()`), upserts `restaurants` (on conflict `provider,provider_ref`),
  inserts `cached_decks` (`added_round = 0`), and emits a structured `start_session.ok` log
  carrying `provider_calls`. Phase 3 extracts its restaurant-upsert / cached-deck-insert
  helpers into `_shared` and reuses them for the widen round (`added_round = n+1`).
- `_shared/provider`: `RestaurantProvider.fetchRestaurants(params)` already accepts
  `excludeProviderRefs?: string[]` — Phase 2 passes nothing; **Phase 3 widen is the first
  caller that uses it** (skip already-seen places). `FakeProvider` (env `PROVIDER=fake`) and
  the boundary `providerCallCount` exist for tests; reuse them.
- Realtime: `0012` already added `sessions` and `matches` to the `supabase_realtime`
  publication. `subscribeSession` (api-client `realtime.ts`) already delivers
  `SessionStatusChange` on any `sessions` status change and `SessionMatchEvent` on a new
  `matches` row. **No new publication is needed this phase** — the
  `active → awaiting_host_resolution`, `→ resolved`, and `awaiting_host_resolution → active`
  (widen) transitions all flow through the existing status events. `cached_decks` and
  `swipes` stay OUT of the publication.

### Which operations are RPCs vs. Edge Functions vs. direct reads (decide once, here)

- **Edge Function (`resolve-session/`, server-only):** `resolve_session` — **both** actions.
  `widen` *requires* the server-only provider key (same reason `start_session` is an Edge
  Function, CLAUDE.md §2.1/§3), so this endpoint lives server-side. `accept_top` rides along
  in the same function (service-role writes to `matches` + `sessions`) to keep **one**
  endpoint matching doc-04 §3.9 and to share the host check + state guard with `widen`.
  `accept_top` makes **zero** provider calls; `widen` makes **exactly one**.
- **Security-definer RPC:** `get_resolution_ranking` — must read **all** members' swipes
  (broader than `swipes_select_own`, like `check_unanimous_match`), and is **host-only**
  (internal host check raising the doc-04 code). Implemented by replacing the 0004 stub.
- **`create or replace` of an existing RPC:** `submit_swipe` (0010) gains the lightweight
  deck-exhaustion check that flips the session to `awaiting_host_resolution`.
- **Direct RLS-scoped reads (no new RPC):** the host-resolution screen reads the ranking via
  the RPC above; the swipe screen continues to read the (now larger) deck via the existing
  `get_deck_for_session`.

### Pinned Phase 3 decisions (so the agent doesn't relitigate them)

- **Exhaustion detection lives in `submit_swipe`.** After a recorded swipe that did **not**
  produce a match, if **every currently present member has a swipe row for every card in the
  session's `cached_decks`**, flip the session `active → awaiting_host_resolution` (set no
  `ended_at` — this is **not** a terminal state). The "present member" cohort is the same one
  `check_unanimous_match` uses (CLAUDE.md §2.3) — an away member's unswiped cards do not block
  exhaustion, and a present member with unswiped cards keeps the session `active`. Detection
  on `submit_swipe` is sufficient for the exit criterion; the rarer "last active swiper leaves
  while others are already exhausted" path is **not** handled this phase — note it as a
  tracked limitation (it cannot strand the room: the host can still leave → `cancelled`).
- **Ranking is present-member-scoped.** `pass_count` / `like_count` count only currently
  present members; `member_count` is the present-member count. This is consistent with the
  unanimous check and with the existing `ranking.ts` JSDoc ("present members who passed").
  Order fully in SQL: `pass_count asc, rating desc nulls last, distance_m asc` (distance via
  `haversine_m` against the room anchor — same helper `get_deck_for_session` uses).
- **Widen never re-shows a swiped card, without per-round bookkeeping on the client.** Widen
  appends only *unseen* restaurants (`added_round = previous max + 1`); the client re-fetches
  `get_deck_for_session` on the `awaiting_host_resolution → active` transition and filters out
  restaurants it has already swiped (its own swiped set, carried across the still-mounted
  swipe screen). Because exhaustion means every present member already swiped every prior-round
  card, that filter naturally surfaces exactly the new cards. **Do NOT add `added_round` to the
  `get_deck` response or change `@munch/core/shuffle.ts`** — re-running `shuffleDeck` over the
  larger deck is deterministic per member, and already-swiped cards are filtered regardless of
  order.
- **Widen updates the session's snapshot.** Persist the widened `radius_m` + any provided
  `filters` onto the `sessions` row (fields not provided keep their current value) so a second
  widen round builds on the first. The room anchor is unchanged; distances are unaffected.
  Earlier likes are never deleted — they still count toward a later unanimous match.
- **`excludeProviderRefs`** for the widen fetch = the `provider_ref`s of every restaurant
  already in this session's `cached_decks`. Guard the append with `on conflict (session_id,
  restaurant_id) do nothing` as a safety belt.
- **Provider invariant verifier:** `resolve-session` emits a structured log line per action —
  `resolve_session.accept.ok` with `provider_calls: 0`, or `resolve_session.widen.ok` with
  `provider_calls: 1` and `new_restaurants`. This is the §2.1 check landing early (mirrors
  `start_session.ok`).
- **Auth boundaries:** `get_resolution_ranking` and both `resolve_session` actions are
  **host-only** (raise `NOT_HOST` / `FORBIDDEN` per doc-04 for a non-host); both reject unless
  the session is in `awaiting_host_resolution` (`SESSION_INVALID_STATE` otherwise).
  Non-host members never call the ranking RPC — their UI is the passive "waiting on host"
  state keyed off the realtime status.

### Phase 3 maps to the roadmap §5 bullets + the exit criterion

- Detect deck exhaustion → `awaiting_host_resolution` → Prompt 2 (`submit_swipe` replace +
  `is_deck_exhausted` helper)
- "Waiting on host" state for non-host members → Prompts 5, 6 (keyed off the existing
  `subscribeSession` status event)
- `get_resolution_ranking` (closest-to-unanimous; tiebreaks rating, distance) → Prompt 1
  (`ranking.ts` tests), Prompt 2 (SQL RPC), Prompt 4 (api-client wrapper)
- `resolve_session` accept top pick + widen → Prompt 3 (Edge Function + `_shared` cache
  helper extraction), Prompt 4 (api-client wrapper), Prompts 5/6 (host UI)
- Tests on exhaustion, ranking ties, accept, widen-appends-only-unseen → Prompt 7

**Exit check (after all 7):** a session that exhausts the deck with no unanimous match moves
all members to a "waiting on host" state and presents the **host** the correct
closest-to-unanimous ranking (fewest passes first; verify a tie resolves by rating then
distance). **Accepting** the top pick ends the session (`resolved`) and announces the
restaurant to every member with resolution `host_accepted_top`. **Widening** appends only
restaurants not already in the deck, resumes swiping for everyone (no one re-swipes a card
they've seen, earlier likes still count), and a fresh unanimous like still ends the session
— with **exactly one** additional provider call for the widen round (server log). CI is green.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and the docs/ files it points to that are relevant to this task.
- Honor the §2 invariants and §3 security rules at all times: provider/service-role keys
  are server-only and must never appear in apps/* or packages/*; RLS on every table; a
  member can only read/write rows for rooms they belong to; domain rules live in
  packages/core and are never duplicated.
- This is Phase 3 (Deck exhaustion & host resolution) per docs/07-initial-roadmap.md §5.
  Phase 2 (the real-time unanimous match) is DONE — do not rebuild it. Do NOT build Phase 4+:
  no host-controlled cuisine/price filter UI beyond what widen already needs, no match_history
  persistence, no UI polish pass.
- CLOSEST-TO-UNANIMOUS IS LOAD-BEARING (CLAUDE.md §2.4): rank by FEWEST PASSES, then highest
  rating, then nearest distance — NEVER by raw like count. The pure logic already lives in
  @munch/core/ranking.ts; the server RPC must match it.
- PER-SESSION CACHING IS LOAD-BEARING (CLAUDE.md §2.1): the provider is fetched once at
  session start and ONCE PER WIDEN ROUND — nowhere else. No swipe, card render, deck read, or
  accept_top may call the provider. The provider key lives only in Edge Function env.
- SERVER-AUTHORITATIVE (CLAUDE.md §2.3): the unanimous check, the exhaustion transition, the
  ranking, and the resolution all decide server-side. "Every member" / "every present member"
  means rooms_members.is_present = true at the moment of the check — re-evaluate the live
  cohort, never a snapshot.
- Database changes are NEW migrations under supabase/migrations/ — never edit an applied one.
  The next migration number is 0014. submit_swipe (0010) and get_resolution_ranking (0004)
  are changed via `create or replace function` inside a NEW migration, not by editing those.
- Map snake_case DB columns to camelCase at the @munch/api-client boundary (docs/06 §5).
- Make the smallest change that satisfies the task. TypeScript strict everywhere.
- If you change behavior a doc describes, update that doc in the same change (CLAUDE.md §1).
- When done, run the stated acceptance checks and report their actual output.
```

---

## Prompt 1 — Core: ranking tests + JSDoc, and verify the Phase-3 contracts are complete

```
Goal: lock down the closest-to-unanimous ranking logic with tests and confirm @munch/core
already exposes every Phase-3 contract the api-client and apps will need. Small, foundational
change — the ranking LOGIC already exists; this is tests + verification, not new behavior.
Reference: docs/01-product-specification.md (§7 ranking rule + tiebreaks),
docs/03-database-schema.md (§6 ranking query), docs/04-api-specification.md (§3.8, §3.9),
docs/06-coding-standards.md (§3 Zod-as-source-of-truth, §10 testing), CLAUDE.md §2.4, §7.

Context: src/domain/ranking.ts already implements rankByClosestToUnanimous (fewest passes →
highest rating → nearest distance, pure). src/validation/sessions.ts already has the ranking
+ resolve_session schemas; MatchResolution already includes 'host_accepted_top'. Do NOT
redefine or "improve" any of these — only add tests and tighten docs.

Deliver:
- src/domain/ranking.test.ts (new): cover, with small fixtures —
    • strict ordering by fewest passes (a 1-pass restaurant ranks above a 3-pass one
      regardless of like counts — prove it is NOT raw-like-count ordering);
    • tie on passes broken by higher rating;
    • tie on passes AND rating broken by nearer distance;
    • null rating sorts BELOW any numeric rating at the same pass count (matches the
      `Number.NEGATIVE_INFINITY` treatment in ranking.ts);
    • input array is not mutated (purity);
    • stable/deterministic output for an all-equal input.
- src/domain/ranking.ts: remove the `TODO(Phase 3)` now that tests exist; expand the JSDoc to
  state explicitly that pass/like counts are over CURRENTLY PRESENT members (consistent with
  the server RPC and matching.ts), with no behavioral change.
- Verify (and only add if genuinely missing — do not duplicate): the resolve_session request
  union, the ranking response shape, and MatchResolution = 'unanimous' | 'host_accepted_top'
  are all importable from "@munch/core". If everything is present, say so and add nothing.
- Do NOT add added_round to deckRestaurantSchema and do NOT change shuffle.ts (see the pinned
  decisions: widen relies on swiped-set filtering, not per-round shuffle).

Done when: `pnpm --filter @munch/core typecheck` and `pnpm --filter @munch/core test` pass;
ranking.test.ts covers the six cases above; no contract was duplicated.
```

---

## Prompt 2 — Supabase: exhaustion detection in submit_swipe + the closest-to-unanimous ranking RPC

```
Goal: the server-authoritative SQL for Phase 3's non-widen surface — make submit_swipe
transition an exhausted session to awaiting_host_resolution, and implement the
closest-to-unanimous ranking RPC. NO provider work here (that's Prompt 3's Edge Function);
NO accept_top/widen here (those live in the Edge Function too).
Reference: docs/03-database-schema.md (§5 match check, §6 ranking query, §7 retention),
docs/04-api-specification.md (§3.7 submit_swipe exhaustion note, §3.8 get_resolution_ranking),
docs/02-system-architecture.md (§5, §6 state machine), CLAUDE.md §2.3, §2.4. The membership
helpers (auth_is_room_member/host/owns_member, 0003) and haversine_m + check_unanimous_match
(0009/0010) already exist — reuse them, don't re-derive.

All new work is NEW migrations starting at 0014 (never edit 0004/0010 or any applied file;
replace functions with `create or replace` inside the new migration).

Deliver:
- 0014_deck_exhaustion.sql:
  • A SQL helper `is_deck_exhausted(p_session_id uuid) returns boolean`, `stable`,
    `security definer`, `set search_path = public, pg_temp`. True iff there is at least one
    present member AND every currently present member of the session's room has a `swipes`
    row for EVERY restaurant in this session's cached_decks (any decision counts — a card is
    "seen" once swiped). Mirror the present-member CTE style of check_unanimous_match.
    Equivalent phrasing: no (present_member × cached_deck_card) pair lacks a swipe.
  • `create or replace function submit_swipe(...)` — identical to 0010 EXCEPT: after the
    branch that determines there is no unanimous match (both the pass branch and the
    like-but-not-unanimous branch, i.e. every path that currently returns
    `{ recorded:true, match:null }`), call is_deck_exhausted; if true AND the session is
    still `active`, `update sessions set status='awaiting_host_resolution' where id=:session
    and status='active'` (the status guard prevents racing past a match; do NOT set ended_at
    — awaiting_host_resolution is non-terminal). Keep the return shape unchanged
    ({ recorded:true, match:null }); the client learns of the transition via the realtime
    status event, not the swipe response. Preserve every existing guard, error code, and the
    idempotent-insert/no-overwrite semantics verbatim — copy the 0010 body and add only the
    exhaustion tail.
  • Re-pin grants for any function created/replaced: `revoke execute ... from public;
    grant execute ... to authenticated;`.

- 0015_get_resolution_ranking.sql:
  • `create or replace function get_resolution_ranking(p_session_id uuid)` replacing the
    0004 stub, `security definer`, `set search_path = public, pg_temp`. Return the table
    shape the 0004 signature already declares (restaurant_id, name, pass_count integer,
    like_count integer, member_count integer, rating numeric(2,1), distance_m integer).
    Behavior per docs/03 §6 but PRESENT-MEMBER-SCOPED (pinned decision):
      - Reject UNAUTHENTICATED if auth.uid() is null.
      - Reject NOT_HOST unless the caller is the host of the session's room (reuse
        auth_is_room_host or an equivalent inline check). Error message = exactly NOT_HOST.
      - member_count = count of currently present members of the session's room.
      - For each restaurant in this session's cached_decks: pass_count / like_count over
        present members' swipes only; rating from restaurants; distance_m via
        haversine_m(room.anchor_lat, room.anchor_lng, r.lat, r.lng).
      - ORDER BY pass_count asc, rating desc nulls last, distance_m asc (CLAUDE.md §2.4).
    Same error convention as 0005/0010: raise exception whose MESSAGE is exactly a doc-04
    code; never embed prose. Do NOT change the table signature (the 0004 RETURNS TABLE is the
    contract the api-client maps).
  • `revoke execute on function get_resolution_ranking(uuid) from public; grant execute ...
    to authenticated;` (host check is internal, like start_session's).

Done when: `supabase db reset` applies cleanly; manual checks confirm:
  (a) with a 2-member session where both have swiped every card and none is unanimous, the
      next/last submit_swipe leaves the session in `awaiting_host_resolution`; while any
      present member still has an unswiped card, the session stays `active`;
  (b) toggling a member is_present=false so the remaining present members are all exhausted
      flips the session to awaiting_host_resolution on the next submit_swipe (present-cohort
      semantics);
  (c) a near-match still wins: if the swipe that completes the deck is ALSO the last
      unanimous like, the session ends `matched`, NOT awaiting_host_resolution (status guard
      order: match check first);
  (d) get_resolution_ranking by the host returns rows ordered fewest-passes-first with the
      rating/distance tiebreaks; by a non-host raises NOT_HOST; like_count/member_count are
      present-member-scoped.
```

---

## Prompt 3 — Supabase: the resolve-session Edge Function (accept_top + widen) and shared cache helpers

```
Goal: the resolve_session endpoint (docs/04 §3.9) as a single Edge Function handling BOTH
actions — accept_top (zero provider calls) and widen (exactly one provider call for unseen
restaurants). Extract start-session's restaurant-upsert / cached-deck-insert into a shared
module so widen reuses them.
Reference: docs/04-api-specification.md (§3.9 resolve_session, §5 provider abstraction),
docs/03-database-schema.md (§3.5 restaurants, §3.6 cached_decks added_round, §3.8 matches),
docs/02-system-architecture.md (§4 per-session caching, §6 state machine widen edge),
docs/05-folder-structure.md (§7), CLAUDE.md §2.1, §2.4, §3, §4. Depends on Prompt 2.
Study supabase/functions/start-session/index.ts first — this function mirrors its auth,
service-role, provider-call-counting, and structured-logging patterns.

Deliver:
- supabase/functions/_shared/deck.ts (new): extract the restaurant-upsert and
  cached_decks-insert helpers currently inline in start-session/index.ts —
    • upsertRestaurants(admin, places, ttlMs) → returns ids aligned to input order
      (on conflict provider,provider_ref; conservative expires_at as today);
    • insertCachedDeck(admin, sessionId, restaurantIds, addedRound) → on conflict
      (session_id, restaurant_id) do nothing.
  Refactor start-session/index.ts to import these (added_round = 0) — behavior unchanged,
  verified by re-running its checks. Keep the helpers Deno-friendly (no @munch/core import),
  matching the existing header-comment convention about cross-runtime imports.

- supabase/functions/resolve-session/index.ts (new), per docs/04 §3.9:
  Common: authenticate via user JWT (UNAUTHENTICATED if missing); resolve the caller's
  host membership + room via a service-role client; the session_id comes from the body.
  Reject NOT_HOST unless caller is the room host; reject SESSION_INVALID_STATE unless the
  session is in `awaiting_host_resolution`. Validate the body against the resolve_session
  discriminated union shape (duplicate the minimal shape inline with a comment pointing to
  @munch/core's resolveSessionRequestSchema, same convention start-session uses for its body).

  action = "accept_top":
    • Validate restaurant_id is in this session's cached_decks (VALIDATION_ERROR otherwise).
    • Insert into matches (session_id, restaurant_id, resolution='host_accepted_top') on
      conflict (session_id) do nothing; update sessions set status='resolved',
      matched_restaurant_id=restaurant_id, ended_at=now() where id=:session and
      status='awaiting_host_resolution' (guard prevents double-resolve).
    • Return { session:{status:'resolved'}, match:{ restaurant_id, restaurant_name,
      resolution:'host_accepted_top' } } (name from restaurants). ZERO provider calls.
    • Log: resolve_session.accept.ok { session_id, room_id, provider_calls: 0 }.

  action = "widen":
    • Gather excludeProviderRefs = provider_ref of every restaurant already in this
      session's cached_decks.
    • Call getProvider().fetchRestaurants(...) EXACTLY ONCE with the WIDENED radius_m/filters
      (fall back to the session's current snapshot values for any field the body omits) +
      the room anchor + excludeProviderRefs. Wrap in try/catch → PROVIDER_ERROR. Use
      getProviderCallCount() delta to assert/Log exactly 1.
    • Persist the widened radius_m + provided filters onto the sessions row (snapshot for a
      later widen round; omitted fields keep current values).
    • upsertRestaurants + insertCachedDeck with added_round = (current max added_round for
      this session) + 1, appending ONLY the newly-fetched places (the provider already
      excluded seen refs; the on-conflict guard is the safety belt). Earlier swipes/likes are
      untouched.
    • update sessions set status='active' (back to swiping) where id=:session and
      status='awaiting_host_resolution'.
    • Return { session:{status:'active'}, new_restaurants: <count appended> }.
    • Log: resolve_session.widen.ok { session_id, room_id, provider_calls: 1,
      new_restaurants }.

  Error envelope + status mapping: reuse _shared/errors.ts (EdgeError/errorBody/statusForCode)
  exactly as start-session does; never surface a raw provider/DB response.

- supabase/functions/.env.example / config.toml: register resolve-session if the pinned CLI
  needs explicit declaration (same treatment start-session got). No NEW env vars — it reuses
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, the provider key, and PROVIDER=fake for tests.

Done when: `supabase functions serve resolve-session` runs locally; from a host session on an
`awaiting_host_resolution` session: accept_top writes the match (resolution host_accepted_top),
moves the session to `resolved`, and makes ZERO provider calls; widen appends only unseen
restaurants (cached_decks added_round incremented), moves the session back to `active`, and
the structured log shows provider_calls = 1; a non-host gets NOT_HOST; a session not in
awaiting_host_resolution gets SESSION_INVALID_STATE; no provider key appears in apps/* or
packages/* (grep cleanly); start-session still passes its own checks after the helper
extraction.
```

---

## Prompt 4 — api-client: implement getResolutionRanking + resolveSession

```
Goal: turn the two Phase-3 stubs in sessions.ts into working, typed endpoints —
getResolutionRanking via the security-definer RPC, resolveSession via the resolve-session
Edge Function (dispatching both actions through one call).
Reference: docs/04-api-specification.md (§3.8, §3.9), docs/06-coding-standards.md (§5
snake↔camel, §8 error shape, §9 no leaked DB errors). Depends on Prompts 2, 3. Mirror the
existing implemented patterns in this file: getDeck (RPC read + snake→camel row map) and
startSession (functions.invoke + mapInvokeError/readEnvelopeCode for the Edge envelope).

Deliver:
- src/endpoints/sessions.ts:
  • Implement getResolutionRanking by calling `client.rpc('get_resolution_ranking',
    { p_session_id })`. Map each row to RankingEntry, coercing the numeric/integer columns
    that PostgREST may return as strings (rating, distance_m, the counts) the same way
    mapDeckRow already does. On error map via toApiError; the RPC raises NOT_HOST /
    SESSION_INVALID_STATE / UNAUTHENTICATED as the message — ensure those are in the
    RPC_ERROR_CODES set in errors.ts (add NOT_HOST if it isn't already mapped) so they
    surface as the right ErrorCode and never as raw text. Return { ranking }.
  • Implement resolveSession by calling `client.functions.invoke('resolve-session',
    { body: req })` — pass the discriminated-union request straight through (server validates
    + dispatches by action). Reuse the SAME invoke-error mapping startSession uses
    (readEnvelopeCode → makeApiError; transport fallback → PROVIDER_ERROR, the right default
    since widen's only off-platform dependency is the provider). Map the success body to
    ResolveSessionResponse — it is already the snake_case wire shape (accept →
    { session:{status}, match }; widen → { session:{status}, new_restaurants }); a structural
    narrow like startSession's is enough. Keep PROVIDER_ERROR reaching the UI for widen retry.
  • Remove the notImplemented(..., "Phase 3") stubs and the Phase-3 TODO comments now that
    both are implemented.

- src/errors.ts: only if NOT_HOST is not already in RPC_ERROR_CODES, add it (it is a doc-04
  code raised by get_resolution_ranking). Do not broaden the set beyond the codes the RPCs
  actually raise.

Done when: `pnpm --filter @munch/api-client typecheck` and `pnpm test` (api-client) pass,
including a new unit test that getResolutionRanking maps a non-host NOT_HOST RPC error onto
the NOT_HOST ErrorCode (never raw text) and maps a ranking row's string-typed numerics to
numbers; manual round-trip against local Supabase: on an awaiting_host_resolution session the
host's getResolutionRanking returns the ordered ranking, resolveSession({action:'accept_top'})
returns the resolved+match body, and resolveSession({action:'widen', radius_m}) returns
{ session:{status:'active'}, new_restaurants }.
```

---

## Prompt 5 — Web: waiting-on-host state, host resolution screen (ranking + accept/widen), resume after widen

```
Goal: the Next.js side of the Phase 3 exit criterion — when the deck exhausts, non-hosts see
a "waiting on host" state and the host sees the closest-to-unanimous ranking with Accept-top
and Widen controls; accepting routes everyone to the result screen, widening resumes swiping
with the appended cards.
Reference: docs/01-product-specification.md (§7 host resolution + ranking + "waiting on host"),
docs/04-api-specification.md (§3.8, §3.9, §4 realtime), docs/05-folder-structure.md (§4 web).
Depends on Prompt 4. Can run in parallel with Prompt 6. Reuse the Phase-2 session feature
(src/features/session/*) and its subscribeSession wiring — extend, don't rewrite.

Context: the swipe screen already uses subscribeSession; status transitions already arrive as
SessionStatusChange. Phase 2 showed a neutral "no match yet" state on exhaustion — Phase 3
replaces that with the real awaiting_host_resolution handling.

Deliver:
- A resolution view under src/features/session/ (e.g. resolution-view.tsx) shown when the
  session status is `awaiting_host_resolution`:
    • Non-host members: a passive "Waiting on the host to decide…" state. They do NOT call
      get_resolution_ranking (it would raise NOT_HOST). They sit here until the next status
      event routes them onward (resolved → result screen; active → back to swiping).
    • Host: fetch getResolutionRanking and render the ranking (name, rating, price, distance,
      and the pass_count/member_count "closest to unanimous" framing). The top row is the
      suggested pick. Controls:
        - "Accept top pick" → resolveSession({ action:'accept_top', session_id,
          restaurant_id: <top row id> }); on success navigate to the result screen (the
          match event also fires for everyone via subscribeSession).
        - "Widen" → a small control to raise the radius (reuse the radius slider) and
          optionally loosen price/cuisine within the host's set; calls
          resolveSession({ action:'widen', session_id, radius_m, filters? }). On success the
          session returns to `active`; do not navigate — let the status→active path resume
          swiping.
- Wire the swipe screen / session route so status drives the view:
    • active → swipe UI; awaiting_host_resolution → resolution view; matched/resolved →
      result screen; cancelled → existing host-left ended state.
    • On the awaiting_host_resolution → active transition (a widen), re-fetch getDeck and
      re-derive this member's shuffled order, FILTERING OUT restaurants this member already
      swiped (carry the swiped set across — the screen stays mounted). This surfaces only the
      newly-appended cards; do NOT refetch the provider and do NOT re-show swiped cards
      (CLAUDE.md §2.1; product spec §7). Add a code comment explaining the swiped-set filter.
- result/page.tsx: already handles the unanimous match; ensure it also renders a
  host_accepted_top resolution identically (same restaurant card; copy may differ slightly).
- No new client-public env vars; the provider key must not appear here. Reuse TanStack Query
  patterns from Phase 2.

Done when: `pnpm dev:web` runs end-to-end: drive a 2-browser room until the deck exhausts with
no unanimous match → both land on the resolution state (host sees the ranking, guest sees
"waiting on host"); the host Accepting routes both to the result screen with the same
restaurant and resolution host_accepted_top; alternatively the host Widening resumes swiping
with NEW cards only (no card re-shown), and a subsequent unanimous like still ends the session;
`pnpm --filter @munch/web build` passes.
```

---

## Prompt 6 — Mobile: waiting-on-host state, host resolution screen (ranking + accept/widen), resume after widen

```
Goal: the Expo side of the Phase 3 exit criterion — the same host-resolution flow as web
(waiting-on-host for non-hosts, ranking + accept/widen for the host, resume after widen) on
iOS/Android.
Reference: docs/01-product-specification.md (§7), docs/04-api-specification.md (§3.8, §3.9,
§4), docs/05-folder-structure.md (§3 mobile). Depends on Prompt 4. Can run in parallel with
Prompt 5. Reuse the Phase-2 mobile session feature (src/features/session/*) and its
subscribeSession wiring — extend, don't rewrite. Keep parity with the web behavior in Prompt 5.

Deliver:
- A resolution view under src/features/session/ shown when status is
  awaiting_host_resolution:
    • Non-host: passive "Waiting on the host to decide…" — does NOT call
      get_resolution_ranking. Routed onward by the next status event (resolved → result;
      active → resume swiping).
    • Host: getResolutionRanking → render the ranking (name, rating, price, distance,
      pass_count/member_count framing), top row = suggested pick. Controls:
        - "Accept top pick" → resolveSession({ action:'accept_top', ... }) → route to result.
        - "Widen" → reuse the mobile radius Slider (+ optional price/cuisine within host set)
          → resolveSession({ action:'widen', radius_m, filters? }); on success stay put and
          let status→active resume swiping.
- Status-driven routing on app/room/[roomId]/session.tsx (and result.tsx): active → swipe;
  awaiting_host_resolution → resolution view; matched/resolved → result; cancelled → existing
  host-left ended state. On awaiting_host_resolution → active (widen), re-fetch getDeck and
  re-derive the shuffled order filtering out already-swiped restaurants (swiped set carried
  across the mounted screen). No provider refetch; no re-showing swiped cards (comment it).
- result.tsx: render a host_accepted_top resolution the same way as a unanimous match.
- Reuse @munch/core types + @munch/api-client; no duplicated logic or row mapping; no <form>
  semantics that conflict with RN (docs/06 §6). Reuse EXPO_PUBLIC_SUPABASE_* env; no provider
  key anywhere.

Done when: `pnpm dev:mobile` boots in Expo; a 2-participant room (device + simulator) driven to
deck exhaustion shows the host the ranking and the guest "waiting on host"; Accept routes both
to the result screen (resolution host_accepted_top); Widen resumes swiping with only the new
cards and a later unanimous like still ends the session; the app typechecks.
```

---

## Prompt 7 — Tests, doc reconciliation, and Phase 3 exit verification

```
Goal: lock down the highest-risk Phase 3 behavior with tests, reconcile docs with the choices
made, and verify the exit criterion + green CI.
Reference: docs/06-coding-standards.md (§10 testing, §11 CI), docs/07-initial-roadmap.md (§5
Phase 3 exit), CLAUDE.md §1 (code/doc parity), §2.1/§2.4 (invariants), §7 (testing). Depends
on Prompts 1–6. Extend the Phase-2 integration test harness (local Supabase + FakeProvider,
PROVIDER=fake) — do NOT call the real provider in tests.

Deliver:
- Core unit tests: ensure ranking.test.ts from Prompt 1 covers ties at each level + null
  ratings (add any gap). Leave matching.test.ts and shuffle determinism tests alone unless
  they regress.

- Integration tests against local Supabase (FakeProvider):
  • Exhaustion → awaiting_host_resolution: a 2-member session where every present member
    swipes every card with no unanimous like ends in `awaiting_host_resolution` (not stuck
    `active`); while one member still has an unswiped card it stays `active`; a present member
    toggling is_present=false such that the remaining cohort is exhausted flips it on the next
    submit_swipe. Confirm a swipe that is simultaneously the last card AND the last unanimous
    like ends `matched`, NOT awaiting_host_resolution.
  • get_resolution_ranking: with crafted swipes, assert the order is fewest-passes-first with
    rating then distance tiebreaks, present-member-scoped like/member counts, and that a
    non-host call raises NOT_HOST.
  • resolve_session accept_top: from awaiting_host_resolution the host accept writes a
    matches row with resolution='host_accepted_top', moves the session to `resolved`, makes
    ZERO provider calls (assert via the FakeProvider call counter), and is idempotent.
  • resolve_session widen: appends ONLY restaurants not already in the deck (added_round
    incremented; excludeProviderRefs honored by FakeProvider), moves the session back to
    `active`, makes EXACTLY ONE provider call for the round, and earlier likes still count —
    a unanimous like spanning a pre-widen like + a post-widen like on the same restaurant
    still declares the match. A non-host widen raises NOT_HOST; a widen on a non-awaiting
    session raises SESSION_INVALID_STATE.
  • A focused api-client/realtime test that the awaiting_host_resolution and resolved status
    transitions are delivered to a co-member subscribeSession subscriber (short timeout for
    the broadcast), reusing the Phase-2 realtime test setup.

- CI: confirm .github/workflows/ci.yml still gates typecheck → lint → test → build and the
  Phase-0 secret-leak guard still rejects the provider-key pattern under apps/* and packages/*
  (resolve-session's provider use lives only under supabase/functions/).

- Doc reconciliation (same PR, CLAUDE.md §1):
  • docs/04-api-specification.md: mark §3.8 get_resolution_ranking as an implemented
    security-definer RPC (host-only, present-member-scoped) and §3.9 resolve_session as an
    implemented Edge Function handling both actions (widen needs the server-only provider key;
    accept_top rides along). Note submit_swipe now also transitions to
    awaiting_host_resolution on exhaustion.
  • docs/02-system-architecture.md §6 / docs/03-database-schema.md: cross-reference the
    is_deck_exhausted helper and the awaiting_host_resolution transition; note widen appends
    cached_decks rows with added_round = n+1 and that earlier likes carry forward.
  • docs/03-database-schema.md §6: note the ranking is present-member-scoped and that
    distance_m is computed in SQL via haversine_m (not deferred to the app as the original
    conceptual query said).
  • docs/05-folder-structure.md §7: add supabase/functions/resolve-session/ and
    _shared/deck.ts to the listed tree.
  • docs/07-initial-roadmap.md §5: leave as-is unless wording now conflicts; CLAUDE.md needs
    no open-decision change (the host-leave decision was already resolved in Phase 2).

Done when: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green; the integration
tests against local Supabase pass with FakeProvider; the docs reflect the implemented
behavior; the manual exit check holds — a session with no unanimous match presents the host
the correct closest-to-unanimous ranking, Accepting ends it (`resolved`, host_accepted_top)
and announces to all members, and Widening appends only unseen restaurants (verify EXACTLY one
extra provider call in the structured resolve_session.widen.ok log) and resumes swiping with
earlier likes still counting.
```
