# Phase 4 — Filters, Polish & Persistence: Agent Prompts

**Project:** Munch
**Source:** `docs/07-initial-roadmap.md` §6 (Phase 4)
**Purpose:** Phase 4 broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Prompts 5 and 6 (web and
mobile UI) can run in parallel once Prompt 4 is done.

**Prepend the shared preamble to every prompt.**

Phase 4 is the **v1 feature set + the retention hook + polish** (roadmap §6). The core
mechanic (Phase 2) and the always-ends-cleanly resolution path (Phase 3) are done; Phase 4
makes the product feel finished and gives signed-in users a reason to come back. Four
threads: (1) **host-controlled filters wired end-to-end** so they visibly shape the deck;
(2) **`match_history`** for signed-in users + a simple history screen; (3) **edge/empty
states** (sparse areas, tiny rooms, everyone-passes, host-leaves) given defined, non-broken
behavior; (4) **UI polish** on the swipe feel, the match reveal, and the lobby. The
load-bearing constraints this phase touches are the **per-session-call invariant**
(CLAUDE.md §2.1 — filters shape the deck only at the two existing provider calls, never on a
swipe) and **guest ephemerality** (CLAUDE.md §3 — only signed-in users get a `match_history`
row; guests persist nothing).

### What Phase 3 already left in place (build on this, don't rebuild)

- **The whole resolution path is done.** `submit_swipe` (0014) transitions to
  `awaiting_host_resolution` on exhaustion; `get_resolution_ranking` (0015) returns the
  closest-to-unanimous ranking; the `resolve-session` Edge Function handles `accept_top`
  (→ `resolved`) and `widen` (one provider fetch, unseen cards appended). api-client
  `getResolutionRanking` / `resolveSession` are implemented; web + mobile have the
  resolution view and status-driven routing. **Do not rebuild any of this** — Phase 4 reuses
  it for the empty-deck and everyone-passes edge cases.
- **`@munch/core` already has the `MatchHistory` camelCase type** (`src/types/match.ts`,
  mirroring `match_history` doc 03 §3.9) and `roomFiltersSchema`
  (`src/validation/filters.ts`: `{ open_now, cuisines: string[], price_levels }`).
  `MatchInfo` / `matchInfoSchema` (optional `restaurant_name`) and `MatchResolution`
  (`'unanimous' | 'host_accepted_top'`) exist. **Reuse these; do not redefine.** What is
  missing and Phase 4 adds: a **canonical cuisine taxonomy constant** and the
  **`match_history` Zod request/response** for the history read.
- **Filters already flow through the backend.** `create_room` / `update_room_filters` (0005
  RPCs) accept `{ open_now, cuisines, price_levels }`; `start_session` snapshots them onto
  the session and passes them to the provider; `GooglePlacesProvider` already maps them
  (`cuisinesToGoogleIncludedTypes` / `toGooglePriceLevels` in `_shared/normalize.ts`, plus a
  post-fetch `openNow` filter and `excludeProviderRefs`). The **gaps are the UI and the
  taxonomy**: the web create-room form takes cuisines as a **free-text comma string**, there
  is **no host filter-editing in the lobby**, and the provider's cuisine ids are not yet
  pinned to a shared constant. Phase 4 closes those — it does **not** re-plumb the provider.
- **`match_history` exists but nothing writes it.** The table (0002) and the
  `match_history_select_own` RLS policy (0003) are in place; the 0003 comment says "Writes
  via Edge Function on match" but **no write path exists yet**. Phase 4 adds it. There is
  **no insert RLS policy on purpose** — writes go through a `security definer` function.
- **The host-leave → `cancelled` path is fully implemented** (Phase 2 `cancel_active_session`
  + Phase 3 status routing). Both apps already have a "host ended the session" ended state.
  Phase 4 only **polishes** that screen and the other edge states; it does not change the
  cancel backend.
- **Auth / guest-vs-account is done.** `signInAnonymously` for guests; email-OTP sign-in and
  the guest→account upgrade (`updateUser` + `verifyOtp`) preserve `user_id` and room
  membership; `ensureProfile` refuses while `is_anonymous`. The guest/account distinction is
  **the presence of a `profiles` row** (docs 03 §3.1, doc 04 §2). The history screen keys off
  this: a guest sees a "sign in to save your matches" state, not a list.
- **Tests + provider doubles:** `FakeProvider` (`PROVIDER=fake`) + the boundary
  `providerCallCount` exist and are used by the Phase 2/3 integration harness. It honors
  `excludeProviderRefs` but **does not yet honor cuisine/price/openNow** — Phase 4 extends it
  so a filter test can prove the deck changes (Prompt 3/7).

### Which operations are RPCs vs. Edge Functions vs. direct reads (decide once, here)

- **Security-definer function (new, called by existing write paths):** `record_match_history`
  — must read all present members + their `profiles` and write `match_history` rows the
  caller can't insert directly (no insert policy). Called from **`submit_swipe`** (after the
  unanimous match write) and from the **`resolve-session` Edge Function** (after the
  `host_accepted_top` match write). One function, two call sites, so the
  "signed-in-members-only, snapshot once, idempotent" logic lives in exactly one place.
- **Direct RLS-scoped read (no new RPC):** `getMatchHistory` reads `match_history` under the
  existing `match_history_select_own` policy (own rows only) — a plain
  `.from('match_history').select(...)`, mapped snake→camel. No privileged read needed.
- **Existing RPC, reused as-is:** `update_room_filters` (0005) — the lobby host filter-edit
  UI calls the **already-implemented** api-client `updateRoomFilters`. No new endpoint.
- **Edge Function change (no new endpoint):** `start_session` gains the **empty-deck**
  transition (deck_size 0 → `awaiting_host_resolution` instead of `active`); `resolve-session`
  gains the `record_match_history` call on `accept_top`. Both are edits to existing functions,
  not new ones.

### Pinned Phase 4 decisions (so the agent doesn't relitigate them)

- **Cuisine is a closed taxonomy in `@munch/core`.** Add a `CUISINES` constant (id + label
  pairs) in `src/constants.ts`; the web/mobile pickers AND the server's
  `cuisinesToGoogleIncludedTypes` mapping key off these ids. **No free-text cuisines** — the
  web create-room form's comma string is replaced by a picker over the constant. Keep the
  list small and v1-appropriate (e.g. italian, japanese, chinese, mexican, thai, indian,
  american, mediterranean, korean, vietnamese, pizza, sushi, cafe, dessert — the agent may
  tune the set, but it is a *closed* list reconciled with the Google type mapping).
- **`match_history` is written for signed-in members only, snapshotted once, idempotent.**
  `record_match_history(p_session_id)` inserts one row per **present member who has a
  `profiles` row** (the signed-in test, NOT `user_id is not null` — guests have a `user_id`
  too). Snapshot `restaurant_name` + `restaurant_photo_url` from the matched `restaurants`
  row, `participant_names` = the present members' `display_name`s, `decided_at` =
  `matches.decided_at`. Idempotent on the existing `unique (user_id, match_id)`
  (`on conflict do nothing`) so re-entry / double-fire writes nothing extra. **Guests get no
  row** (CLAUDE.md §3 ephemerality). Present-member-scoped, consistent with the match check
  (CLAUDE.md §2.3).
- **Empty / sparse initial deck reuses the resolution path — no new mechanic.** If
  `start_session` caches **zero** restaurants, set the session to **`awaiting_host_resolution`**
  (not `active`) so the host immediately gets the **widen** control and members see "no spots
  found — waiting on host", rather than a swipe screen with no cards. The ranking for an empty
  deck is `[]`; the resolution view must render that without crashing. A non-empty-but-small
  deck stays `active` (swiping a tiny deck is fine; exhaustion → resolution as normal).
- **"Everyone passes" needs no new code — only non-broken UI.** When the deck exhausts with
  every card passed, `get_resolution_ranking` returns rows where every `pass_count` ==
  `member_count`; the top pick is decided by the rating/distance tiebreaks. The resolution
  view must present this honestly (it is the host's best-available pick, not framed as a
  near-match) and Accept/Widen both still work.
- **Filters shape the deck only at the two existing provider calls** (`start_session`,
  `widen`) — CLAUDE.md §2.1. The host edits filters in the **lobby** via `update_room_filters`
  (doc 04 §3.3 is lobby-only: it raises `SESSION_INVALID_STATE` once a session is active), or
  loosens them via `widen`. Changing filters never refetches mid-`active`; the radius slider
  stays local during swiping (the Phase 2 decision is unchanged). **Do not** add a per-swipe
  or per-filter-change provider call.
- **Per-member "narrow" filters and dietary filters stay deferred (post-v1).** Filters remain
  **host-only, whole-room** (CLAUDE.md §2.2). Do **not** build the hybrid narrow-within mode
  or vegetarian/vegan/halal/gluten-free filters — they are on the roadmap §8 deferred list.
- **Host-leave / `cancelled` backend is frozen.** Phase 4 only polishes the ended-state UI;
  it does not touch `cancel_active_session` or the routing that drives it.
- **Next migration number is 0016.** All SQL is new migrations; never edit an applied file.
  `submit_swipe` is changed via `create or replace` inside the new migration.

### Phase 4 maps to the roadmap §6 bullets + the exit criterion

- Host-controlled filters wired end-to-end (open-now, cuisine, price) → Prompt 1 (cuisine
  taxonomy constant), Prompt 3 (provider mapping reconciled to the taxonomy + FakeProvider
  honors filters), Prompts 5/6 (cuisine picker + lobby host filter-edit UI)
- Match history for signed-in users + a history screen → Prompt 1 (`match_history` Zod
  read contract), Prompt 2 (`record_match_history` + `submit_swipe` replace), Prompt 3
  (wire into `resolve-session` accept), Prompt 4 (`getMatchHistory`), Prompts 5/6 (history
  screen + guest "sign in to save" state)
- Empty/edge states (sparse areas, tiny rooms, everyone-passes, host leaves) → Prompt 3
  (empty initial deck → `awaiting_host_resolution`), Prompts 5/6 (empty/everyone-passes/
  tiny-room/host-left screens)
- UI polish (swipe feel, match reveal, lobby) → Prompts 5, 6
- Tests + doc reconciliation → Prompt 7

**Exit check (after all 7):** a host setting a cuisine/price filter visibly changes the deck
(a filtered session yields a different, smaller pool than an unfiltered one — verified with
FakeProvider honoring filters); a **signed-in** user who reaches a match sees it on their
history screen, while a **guest** in the same room gets **no** history row and sees a
"sign in to save your matches" state; the empty-area (zero results), everyone-passes,
two-person-room, and host-leaves edge cases each resolve to a defined, non-broken screen;
the swipe feel, match reveal, and lobby are polished. CI is green.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and the docs/ files it points to that are relevant to this task.
- Honor the §2 invariants and §3 security rules at all times: provider/service-role keys
  are server-only and must never appear in apps/* or packages/*; RLS on every table; a
  member can only read/write rows for rooms they belong to; domain rules live in
  packages/core and are never duplicated.
- This is Phase 4 (Filters, polish & persistence) per docs/07-initial-roadmap.md §6. Phases
  2 and 3 (the real-time match + host resolution) are DONE — do not rebuild them. Do NOT
  build Phase 5 hardening (rate-limit load tests, retention/purge jobs, store prep) and do
  NOT build any roadmap §8 DEFERRED item: no per-member "narrow" filters, no dietary filters
  (veg/vegan/halal/gluten-free), no personalization from swipe history, no monetization, no
  second provider.
- GUEST EPHEMERALITY IS LOAD-BEARING (CLAUDE.md §3): only signed-in users (those with a
  `profiles` row) get a match_history row. Guests persist nothing beyond the session. The
  signed-in test is the PRESENCE OF A profiles ROW, not a non-null user_id (guests have a
  user_id too).
- PER-SESSION CACHING IS LOAD-BEARING (CLAUDE.md §2.1): filters shape the deck only at the
  two EXISTING provider calls (start_session and widen). No swipe, card render, deck read,
  radius change, or filter edit may call the provider. The provider key lives only in Edge
  Function env.
- FILTERS ARE HOST-ONLY AND WHOLE-ROOM (CLAUDE.md §2.2): keep the shared deck identical for
  all members. Do NOT add per-member narrowing or expand-beyond-host filters.
- Database changes are NEW migrations under supabase/migrations/ — never edit an applied one.
  The next migration number is 0016. submit_swipe (0014) is changed via `create or replace
  function` inside a NEW migration, not by editing 0014.
- Map snake_case DB columns to camelCase at the @munch/api-client boundary (docs/06 §5).
- Make the smallest change that satisfies the task. TypeScript strict everywhere.
- If you change behavior a doc describes, update that doc in the same change (CLAUDE.md §1).
- When done, run the stated acceptance checks and report their actual output.
```

---

## Prompt 1 — Core: cuisine taxonomy + match_history read contract (+ tests)

```
Goal: add the two shared contracts Phase 4 needs in @munch/core so the apps, the api-client,
and the provider all agree on one source of truth — a CLOSED cuisine taxonomy and the
match_history read shape. Small, foundational change.
Reference: docs/03-database-schema.md (§3.9 match_history), docs/04-api-specification.md
(§3.1 create_room filters, §3.3 update_room_filters), docs/01-product-specification.md (§8
filters, §10 persistence), docs/06-coding-standards.md (§3 Zod-as-source-of-truth, §10
testing), CLAUDE.md §2.2, §3.

Context: src/types/match.ts already has the MatchHistory camelCase type. src/validation/
filters.ts already has roomFiltersSchema ({ open_now, cuisines: string[], price_levels }).
Do NOT redefine these. The cuisines array is currently untyped strings — Phase 4 pins the
allowed VALUES with a constant (the schema stays string[] for forward-compat, but the UI and
provider only ever use ids from the constant).

Deliver:
- src/constants.ts: add a CUISINES constant — a readonly array of { id, label } pairs, a
  closed v1 taxonomy (e.g. italian/japanese/chinese/mexican/thai/indian/american/
  mediterranean/korean/vietnamese/pizza/sushi/cafe/dessert; tune the set but keep it CLOSED).
  Export a CuisineId union type (z.infer or a literal union over the ids) and a helper to
  look up a label by id. Add a short JSDoc: this is the single source for the picker UI AND
  the server's cuisine→Google-type mapping (Prompt 3 reconciles normalize.ts to it); dietary
  filters and per-member narrowing are deferred (roadmap §8).
- src/validation/matches.ts (or sessions.ts, wherever the match contracts live): add
    • matchHistoryEntrySchema — the wire shape of one history row (snake_case:
      { id, match_id, restaurant_name, restaurant_photo_url, participant_names, decided_at,
      created_at }); reuse it via z.infer. Do NOT redefine the MatchHistory camelCase type
      (that is the api-client output shape).
    • getMatchHistoryResponseSchema — { history: matchHistoryEntrySchema[] }.
  Export both via the existing validation index barrel.
- src/constants.test.ts (new or extended): assert CUISINES ids are unique, non-empty, and
  lowercase-kebab (so they are stable map keys); assert the label lookup returns the right
  label and a sensible fallback for an unknown id.
- Do NOT add any per-member-narrow or dietary schema. Do NOT change roomFiltersSchema's
  shape.

Done when: `pnpm --filter @munch/core typecheck` and `pnpm --filter @munch/core test` pass;
CUISINES + CuisineId + the match_history read schemas are importable from "@munch/core"; no
existing contract was duplicated or reshaped.
```

---

## Prompt 2 — Supabase: the match_history write path (record_match_history + submit_swipe)

```
Goal: the server-authoritative write for the retention hook — a security-definer
record_match_history function that snapshots one history row per signed-in present member on
a decided session, and a create-or-replace of submit_swipe that calls it on a unanimous
match. NO history read here (that is an RLS read in the api-client); NO resolve-session
change here (that is Prompt 3's Edge Function).
Reference: docs/03-database-schema.md (§3.1 profiles, §3.9 match_history, §7 retention),
docs/04-api-specification.md (§3.7 submit_swipe), docs/01-product-specification.md (§10
persistence — guests get no history), CLAUDE.md §2.3, §3. The present-member CTE style and
the match write live in 0010/0014 submit_swipe and check_unanimous_match — reuse them.

All new work is a NEW migration starting at 0016 (never edit applied files; replace
submit_swipe with `create or replace` inside the new migration).

Deliver:
- 0016_match_history_write.sql:
  • record_match_history(p_session_id uuid) returns void, `security definer`,
    `set search_path = public, pg_temp`. Behavior:
      - Resolve the session's matches row (the authoritative outcome) — if none, no-op
        (defensive; the callers only call it after writing the match).
      - participant_names = the display_name of every CURRENTLY PRESENT member of the
        session's room (present-member-scoped, like the match check).
      - For each present member that HAS a profiles row (the signed-in test — join
        room_members → profiles on user_id; guests with a user_id but no profile are
        EXCLUDED), insert into match_history (user_id, match_id, restaurant_name,
        restaurant_photo_url, participant_names, decided_at) snapshotting restaurant_name +
        restaurant_photo_url from the matched restaurants row and decided_at from matches.
      - `on conflict (user_id, match_id) do nothing` — idempotent (re-fire writes nothing).
    No auth check inside (callers have already authenticated and authorized). Add a comment:
    this is the only writer of match_history; the table has no insert RLS policy on purpose
    (docs/03 §3.9).
  • `create or replace function submit_swipe(...)` — identical to 0014 EXCEPT: in the
    unanimous branch, AFTER the `update sessions set status='matched' ...` and building the
    match payload, call `perform record_match_history(p_session_id)`. Change nothing else —
    copy the 0014 body verbatim (all guards, error codes, the exhaustion tail, the idempotent
    no-overwrite insert) and add only that one call. Keep the return shape unchanged.
  • Re-pin grants for submit_swipe (`revoke ... from public; grant ... to authenticated;`).
    record_match_history is called internally only — grant execute to authenticated for the
    submit_swipe (definer) path; it is not a client endpoint.

Done when: `supabase db reset` applies cleanly; manual checks confirm:
  (a) in a 2-member room where BOTH are signed-in (have profiles rows), the unanimous like
      writes exactly two match_history rows (one per user) with the right restaurant_name +
      participant_names snapshot;
  (b) in a room with one signed-in user and one guest (anonymous, no profile), only the
      signed-in user gets a match_history row — the guest gets none (ephemerality);
  (c) re-running the same unanimous submit_swipe (idempotent retry) writes NO additional
      history rows;
  (d) submit_swipe's existing behavior (match detection, exhaustion transition, error codes,
      idempotency) is unchanged.
```

---

## Prompt 3 — Supabase: filters shape the deck + empty-deck edge + history on host-accept

```
Goal: make filters demonstrably shape the deck and define the empty-area edge, plus write
history on the host-accept path. Three edits to EXISTING server code (no new endpoints):
reconcile the cuisine mapping to the @munch/core taxonomy + make FakeProvider honor filters;
transition an empty initial deck to awaiting_host_resolution; call record_match_history from
resolve-session's accept_top.
Reference: docs/04-api-specification.md (§3.5 start_session, §3.9 resolve_session, §5
provider), docs/03-database-schema.md (§3.5 restaurants, §3.9 match_history),
docs/02-system-architecture.md (§4 caching, §6 state machine), CLAUDE.md §2.1, §2.2, §3, §4.
Depends on Prompts 1, 2. Study start-session/index.ts, resolve-session/index.ts,
_shared/provider/{google-places.ts,fake.ts}, and _shared/normalize.ts first.

Deliver:
- supabase/functions/_shared/normalize.ts: reconcile cuisinesToGoogleIncludedTypes so its
  input keys are EXACTLY the @munch/core CUISINES ids (duplicate the id→Google-type map
  inline with a comment pointing back to @munch/core CUISINES — Edge Functions are Deno and
  can't import the workspace package, same convention as NormalizedRestaurant). Every taxonomy
  id must map to at least one Google place type (or to a keyword fallback); an unknown/empty
  cuisine list still falls back to ["restaurant"] (current behavior). No change to price/openNow
  mapping.

- supabase/functions/_shared/provider/fake.ts: extend FakeProvider to HONOR filters so a test
  can prove filters shape the deck — filter the fixture deck by cuisines (intersection with
  the restaurant's cuisines), price_levels, and openNow, in ADDITION to the existing
  excludeProviderRefs skip. Keep it deterministic and offline. Add a couple of fixture rows
  with distinct cuisines/price levels if the current fixture can't show a filter difference.

- supabase/functions/start-session/index.ts: after caching the deck, if deck_size === 0, set
  the session status to `awaiting_host_resolution` (NOT `active`) and still return
  { session: { id, status, radius_m }, deck_size: 0 } with the actual status. A non-empty
  deck is unchanged (→ active). Add a comment: an empty initial pool routes the host straight
  to the widen control via the existing resolution path (pinned Phase 4 decision); no new
  empty-state mechanic. Keep the single-provider-call invariant + the structured log
  (provider_calls must still be 1).

- supabase/functions/resolve-session/index.ts: in the accept_top branch, AFTER writing the
  matches row + flipping the session to `resolved`, call record_match_history for the session
  (via the service-role client — an rpc('record_match_history', { p_session_id }) or an
  equivalent service-role insert mirroring the function's logic; prefer calling the RPC so the
  signed-in-only + snapshot logic stays in ONE place). accept_top still makes ZERO provider
  calls; the structured resolve_session.accept.ok log is unchanged. widen is untouched.

Done when: `supabase db reset` + `supabase functions serve` run cleanly; manual checks:
  (a) a start_session with a restrictive cuisine/price filter (FakeProvider, PROVIDER=fake)
      caches a SMALLER, DIFFERENT set than an unfiltered start — proving filters shape the deck;
  (b) a start_session whose filters match nothing caches zero rows and leaves the session in
      `awaiting_host_resolution` (host can widen), not stuck `active`;
  (c) a host accept_top on a session with a signed-in host writes that host's match_history
      row (and any other signed-in present member's), guests none, idempotent on re-call;
  (d) no provider key appears in apps/* or packages/* (grep cleanly); start-session and
      resolve-session still pass their own Phase 2/3 checks.
```

---

## Prompt 4 — api-client: getMatchHistory (+ confirm filter-edit path)

```
Goal: implement the match-history read and confirm the host filter-edit path is fully wired.
Reference: docs/04-api-specification.md (§3.3 update_room_filters, §3.9 / §3.9-resolution
match write), docs/03-database-schema.md (§3.9 match_history), docs/06-coding-standards.md
(§5 snake↔camel, §8 error shape, §9 no leaked DB errors). Depends on Prompts 1–3. Mirror the
existing read patterns (getDeck's row map, getRoomMembers' RLS read).

Deliver:
- src/endpoints/ (new file, e.g. history.ts, or fold into an existing matches/sessions module
  to match the file layout): getMatchHistory(client) — a direct RLS-scoped read of
  match_history (own rows only via match_history_select_own), ordered decided_at desc. Select
  the columns matchHistoryEntrySchema expects; map snake_case → the MatchHistory camelCase
  type (id, userId, matchId, restaurantName, restaurantPhotoUrl, participantNames, decidedAt,
  createdAt). On error map via toApiError; never surface raw DB text. Return MatchHistory[].
  Export from the package index.
- Confirm (do not rewrite): updateRoomFilters already accepts the { open_now, cuisines,
  price_levels } shape and maps the response — it does. If the request type does not already
  constrain cuisines to CuisineId, leave the wire type as string[] (the UI passes only
  taxonomy ids; over-tightening the boundary type is out of scope). Do NOT add a new
  filter endpoint.
- Add a unit test: getMatchHistory maps a snake_case row to the camelCase MatchHistory shape
  (including a null restaurant_photo_url and a multi-name participant_names array), and an RLS
  error maps to a safe ApiError, never raw text.

Done when: `pnpm --filter @munch/api-client typecheck` and `pnpm test` (api-client) pass
including the new mapping test; manual round-trip against local Supabase: a signed-in user
who matched sees their row via getMatchHistory; a guest's getMatchHistory returns [] (no rows
under RLS).
```

---

## Prompt 5 — Web: cuisine picker + lobby filter editing, history screen, edge states, polish

```
Goal: the Next.js side of the Phase 4 exit criterion — a real cuisine picker (no free text),
host filter-editing in the lobby, a match-history screen (with the guest "sign in to save"
state), defined empty/edge-state screens, and polish on the swipe feel / match reveal /
lobby.
Reference: docs/01-product-specification.md (§5 flow, §7 resolution, §8 filters, §9 cards,
§10 persistence, §13 "never a stuck state"), docs/04-api-specification.md (§3.3, §3.9,
match write), docs/05-folder-structure.md (§4 web — note history/page.tsx). Depends on
Prompt 4. Can run in parallel with Prompt 6. Reuse the Phase 2/3 features; extend, don't
rewrite.

Deliver:
- Filters end-to-end:
    • Replace the free-text cuisine input in src/features/room/create-room-form.tsx with a
      multi-select picker over @munch/core CUISINES (id→label). open_now and price-level
      controls stay. The submitted filters carry only taxonomy ids.
    • Add host filter-editing in the LOBBY (src/features/room/lobby-view.tsx or a small
      filters panel): the host can change open_now / cuisines / price_levels (and
      default_radius) via updateRoomFilters while in lobby; non-hosts see the current filters
      read-only. Surface SESSION_INVALID_STATE gracefully if a session has already started
      (the control should be lobby-only). This is what "filters wired end-to-end" means on
      the client — the next start_session snapshots them.
- Match history:
    • app/history/page.tsx (per docs/05 §4): for a signed-in user, list getMatchHistory rows
      (restaurant name + photo + participant names + date). For a GUEST (no profile /
      is_anonymous), show a "Sign in to save your matches" state linking to the existing
      auth/upgrade panel — do NOT call getMatchHistory for a guest expecting rows. Empty
      signed-in history shows a friendly empty state.
    • Add a link to the history screen from the home/landing surface for signed-in users.
- Edge / empty states (defined, non-broken — product spec §13):
    • Empty initial deck: when start_session returns status awaiting_host_resolution with
      deck_size 0, the session route shows the resolution view with an empty ranking — host
      sees "No spots found — widen your search" with the Widen control; non-hosts see the
      waiting-on-host state. (Reuse the Phase 3 resolution view; just handle ranking.length
      === 0.)
    • Everyone-passes: the resolution ranking renders honestly when every pass_count ==
      member_count (host's best-available pick, not framed as a near-match); Accept/Widen
      still work.
    • Two-person / tiny room: confirm the lobby and session work at the ROOM_SIZE_MIN floor;
      no copy that assumes 3+ members.
    • Host-left (cancelled): polish the existing ended state ("The host ended the session")
      with a route back home. (Backend unchanged.)
- Polish:
    • Swipe feel: add a drag/throw gesture to the swipe card (keep the existing Like/Pass
      buttons as the accessible fallback). No provider call on swipe (CLAUDE.md §2.1).
    • Match reveal: a clear celebratory result screen for both `unanimous` and
      `host_accepted_top` (restaurant name + photo + who matched). The result/page.tsx
      already renders both resolutions — polish, don't restructure.
    • Lobby: presence list + invite affordance polish; show the active filters summary.
- No new client-public env vars; the provider key must not appear here. Reuse TanStack Query
  patterns. Keep business logic in @munch/core / api-client — components stay thin
  (CLAUDE.md §4).

Done when: `pnpm dev:web` runs end-to-end: a host picks cuisines from the taxonomy picker and
edits filters in the lobby, and a started session's deck reflects them (smaller/different than
unfiltered); a signed-in user sees their match on /history while a guest sees the "sign in to
save" state; the empty-area, everyone-passes, tiny-room, and host-left screens each render a
defined non-broken state; the swipe gesture + match reveal feel polished;
`pnpm --filter @munch/web build` passes.
```

---

## Prompt 6 — Mobile: cuisine picker + lobby filter editing, history screen, edge states, polish

```
Goal: the Expo side of the Phase 4 exit criterion — the same four threads as web (taxonomy
cuisine picker + lobby host filter-editing, match-history screen with the guest state,
edge/empty states, and swipe/match/lobby polish) on iOS/Android. Keep parity with Prompt 5.
Reference: docs/01-product-specification.md (§5, §7, §8, §9, §10, §13),
docs/04-api-specification.md (§3.3, §3.9, match write), docs/05-folder-structure.md (§3
mobile — note history.tsx, signed-in users only), docs/06-coding-standards.md (§6 no RN-form
conflicts). Depends on Prompt 4. Can run in parallel with Prompt 5. Reuse the Phase 2/3
mobile features; extend, don't rewrite.

Deliver:
- Filters end-to-end:
    • Replace the cuisine input in src/features/room/create-room-form.tsx with a multi-select
      picker over @munch/core CUISINES (id→label) using RN-appropriate controls (no <form>
      semantics that conflict with RN, docs/06 §6). Keep open_now + price controls.
    • Host filter-editing in the lobby (src/features/room/lobby-view.tsx): host edits
      open_now / cuisines / price_levels / default_radius via updateRoomFilters while in
      lobby; non-hosts see them read-only; SESSION_INVALID_STATE handled gracefully.
- Match history:
    • The history screen per docs/05 §3 (app/history.tsx or the tab the doc names),
      signed-in users only: list getMatchHistory rows (name + photo + participants + date);
      a guest sees a "Sign in to save your matches" state linking to the existing
      auth/upgrade panel; signed-in empty history shows a friendly empty state.
    • Add navigation to the history screen for signed-in users.
- Edge / empty states (parity with web): empty initial deck → resolution view with empty
  ranking ("No spots found — widen"); everyone-passes ranking rendered honestly;
  two-person/tiny-room works at ROOM_SIZE_MIN; host-left ended state polished with a route
  home. Reuse the Phase 3 resolution view; handle ranking.length === 0.
- Polish:
    • Swipe feel: pan-to-swipe gesture via react-native-gesture-handler + reanimated (already
      in the workspace from Phase 2 if added; otherwise keep the buttons and add a light
      animation — do not add a heavy dep just for polish). Buttons remain the fallback. No
      provider call on swipe.
    • Match reveal: celebratory result screen for both `unanimous` and `host_accepted_top`
      (result.tsx already renders both — polish, don't restructure).
    • Lobby: presence + invite + active-filters summary polish.
- Reuse @munch/core types + @munch/api-client; no duplicated logic or row mapping. Reuse
  EXPO_PUBLIC_SUPABASE_* env; no provider key anywhere.

Done when: `pnpm dev:mobile` boots in Expo; the cuisine picker + lobby filter edit work and a
started session reflects the filters; a signed-in user sees their match on the history screen
while a guest sees the "sign in to save" state; the empty-area, everyone-passes, tiny-room,
and host-left screens render defined non-broken states; the swipe + match reveal feel
polished; the app typechecks.
```

---

## Prompt 7 — Tests, doc reconciliation, and Phase 4 exit verification

```
Goal: lock down the new Phase 4 behavior with tests, reconcile docs with the choices made,
and verify the exit criterion + green CI.
Reference: docs/06-coding-standards.md (§10 testing, §11 CI), docs/07-initial-roadmap.md (§6
Phase 4 exit), CLAUDE.md §1 (code/doc parity), §2.1/§2.2/§3 (invariants), §7 (testing).
Depends on Prompts 1–6. Extend the Phase 2/3 integration harness (local Supabase +
FakeProvider, PROVIDER=fake) — do NOT call the real provider in tests.

Deliver:
- Core unit tests: ensure the CUISINES constant tests (unique/kebab ids, label lookup) from
  Prompt 1 exist; leave matching/ranking/shuffle tests alone unless they regress.

- Integration tests against local Supabase (FakeProvider, now filter-aware):
  • Filters shape the deck: a start_session with a cuisine + price filter caches a strictly
    smaller / different set than an unfiltered start over the same fixture, and the cached
    restaurants all satisfy the filter. Prove it is the FILTER, not chance (compare counts /
    ids).
  • Empty initial deck: a start_session whose filters match nothing caches zero cached_decks
    rows and leaves the session in `awaiting_host_resolution` (not `active`), with
    provider_calls still exactly 1.
  • match_history on unanimous: a 2-signed-in-member room writes two history rows on the
    match (right restaurant_name + participant_names snapshot); a signed-in + guest room
    writes ONLY the signed-in user's row; a re-fired/idempotent submit_swipe writes no extra
    rows.
  • match_history on host accept: accept_top on an awaiting_host_resolution session writes the
    signed-in present members' history rows, ZERO provider calls, idempotent.
  • Guest ephemerality: a guest (anonymous, no profiles row) has no match_history row after a
    match in which they participated; getMatchHistory under their session returns [].

- api-client tests: getMatchHistory row mapping (from Prompt 4) including null photo + multi
  participant names; RLS error → safe ApiError.

- CI: confirm .github/workflows/ci.yml still gates typecheck → lint → test → build and the
  Phase-0 secret-leak guard still rejects the provider-key pattern under apps/* and
  packages/* (the provider key + cuisine→Google-type map live only under
  supabase/functions/).

- Doc reconciliation (same PR, CLAUDE.md §1):
  • docs/03-database-schema.md §3.9: correct the "Writes via Edge Function on match" note to
    describe the actual path — a security-definer record_match_history called from BOTH
    submit_swipe (unanimous) and the resolve-session Edge Function (host_accepted_top),
    signed-in-members-only (profiles row), idempotent on (user_id, match_id). Cross-reference
    migration 0016.
  • docs/04-api-specification.md: note start_session now routes an EMPTY initial deck to
    awaiting_host_resolution (§3.5); note match_history is written on both the submit_swipe
    match and the resolve_session accept_top (§3.7 / §3.9). Add a getMatchHistory read note if
    the spec lists client reads.
  • docs/01-product-specification.md §8 / docs/08 or wherever filters are described: note the
    cuisine taxonomy is a CLOSED list in @munch/core (no free text) and that the host edits
    filters in the lobby; reaffirm per-member narrow + dietary filters remain deferred.
  • docs/05-folder-structure.md: add the history screen(s) and any new api-client history
    module to the listed tree if not already present.
  • CLAUDE.md: no §9 open-decision change is needed (provider pricing/ToS re-verification is
    still a Phase 5 launch gate). If anything in §1–§8 now mismatches reality, fix it here.

Done when: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green; the integration
tests against local Supabase pass with the filter-aware FakeProvider; the docs reflect the
implemented behavior; the manual exit check holds — a host's filter visibly changes the deck,
a signed-in user sees their match in history while a guest sees the "sign in to save" state,
and the empty-area / everyone-passes / tiny-room / host-left edge cases each resolve to a
defined non-broken screen.
```
