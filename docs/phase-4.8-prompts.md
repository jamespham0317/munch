# Phase 4.8 — Remove the free-text anchor label: Agent Prompts

**Project:** Munch
**Source:** `docs/07-initial-roadmap.md` §6.8 (Phase 4.8)
**Purpose:** Phase 4.8 broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence.

- **Prompt 1** (core: type + validation) and **Prompt 2** (migration rewrite) are independent and
  may run in parallel — one is TypeScript, the other is SQL.
- **Prompt 3** (api-client) depends on Prompts 1 and 2 (the new core types + the RPC param/return
  changes).
- **Prompt 4 (web)** and **Prompt 5 (mobile)** depend on Prompt 3 and may run in parallel.
- **Prompt 6** (docs lockstep + exit verification) depends on all of the above.

**Prepend the shared preamble to every prompt.**

Phase 4.8 removes the vestigial **"Where are we eating?" text field** from Create Room and the
`anchor_label` column it fed — end-to-end (roadmap §6.8). Phase 4.6 made the anchor **map-pick
only** (no geocoding), so that input has been decorative: typing in it never moves the pin or
shapes the deck; it only wrote `rooms.anchor_label`, shown read-only in the lobby. This is the
**full-removal** option (field **and** column), not a UI-only hide, so no dead schema lingers. It
touches `@munch/core`, the existing SQL migrations (**rewritten in place** — see below), the
api-client, and both apps. It is a **presentation + contract** change only — **no matchmaking,
caching, provider, or realtime behavior changes**, and all four CLAUDE.md §2 invariants are
untouched.

**Migration approach.** Rewriting migrations **in place** is the standard workflow here
(CLAUDE.md §6 / docs/06): so instead of adding an `0021_drop_anchor_label.sql`, Phase 4.8 **edits
the existing migrations** to remove `anchor_label` as if it were never there, and `supabase db
reset` rebuilds the schema from the edited files.

### Resolved decisions driving this phase (do not relitigate)

- **Full removal, not a hide.** The `anchor_label` **input**, the `rooms.anchor_label` **column**,
  and every code reference (core type, Zod schemas, api-client mappers, RPC params/returns) are
  removed. We are deliberately *not* leaving an always-empty column behind.
- **The map stays the anchor.** The anchor is still `map.getCenter()` on move-end (Phase 4.6,
  unchanged), and the RadiusSlider still drives the map zoom. **No geocoding/search is added** —
  that is the opposite direction and remains deferred (docs/07 §8).
- **"Where are we eating?" moves onto the map + radius group.** The prompt that today labels the
  text field becomes the heading for the AnchorMap + RadiusSlider group.
- **Lobby shows "Pinned location."** `AnchorSummary` already falls back to "Pinned location" when
  the label is blank; with the label gone it shows that static text (+ radius) and drops its
  `anchorLabel` prop. The anchor stays host-controlled and read-only to non-hosts (invariant §2.2).
- **This reverses a Phase 4.6 decision** (roadmap §6.6 / docs/10 §3.3: "keep an *optional*
  free-text `anchor_label`"). The lockstep doc updates in Prompt 6 are mandatory.

### What's already in place (build on this, don't rebuild)

- **`anchor_label` is decorative today.** Since Phase 4.6 there is no reverse-geocoding; the field
  is free text that nothing reads back into behavior. The map already sets the real anchor
  (`anchor_lat` / `anchor_lng`).
- **`anchor_label` appears in FOUR migrations** — all rewritten in place this phase (CLAUDE.md §6):
  the `rooms.anchor_label` column in `0002`; the `create_room` /
  `update_room_filters` / `join_room` functions in `0005`; and the `join_room` **replacements** in
  `0017` and `0019` (each `create or replace`s `join_room` and returns `anchor_label`). They must
  stay mutually consistent: if you drop the column from `0002` but leave `0017`/`0019` referencing
  `v_room.anchor_label` (where `v_room rooms%rowtype`), **`supabase db reset` will fail** when it
  re-applies those functions. So all four files change together.
- **`create_room` is called with named params** in the api-client (`p_anchor_label: …`), so
  dropping that parameter is a clean change — no positional reshuffle for callers.
- **`AnchorSummary` already handles a blank label** on both apps
  (`apps/{web,mobile}/src/components/anchor-summary.tsx`) — it renders "Pinned location". So the
  lobby UX barely changes; only the now-unused prop is removed.
- **Integration tests pass a literal label.** `packages/api-client/src/rooms.integration.test.ts`
  and `…/sessions.integration.test.ts` send `anchor_label: "Test Anchor"` in their `createRoom`
  payloads — those lines come out with the field.
- **Seed has no `anchor_label`.** `supabase/seed/seed.sql` does not reference it; no seed change
  needed (confirm).

### Pinned decisions (so the agent doesn't relitigate them)

- **Rewrite the four migrations in place** (CLAUDE.md §6; no new migration file). Edit `0002`,
  `0005`, `0017`, `0019` so `anchor_label` never appears, as if the column had never existed:
  - `0002`: remove the `anchor_label text` column from the `rooms` `CREATE TABLE`.
  - `0005`: drop the `p_anchor_label` parameter from `create_room` (and its `INSERT` col/value) and
    from `update_room_filters` (and its `UPDATE` coalesce + returned JSON), and **update the
    matching `REVOKE`/`GRANT` argument-type signatures** for both functions (each loses one `text`
    arg). Remove `anchor_label` from `0005`'s `join_room` return JSON.
  - `0017` and `0019`: remove `'anchor_label', v_room.anchor_label` from each `join_room`
    replacement's returned room JSON.
  - Because the column definition itself is edited out of `0002`, **no `DROP COLUMN` / `DROP
    FUNCTION` is needed** — `db reset` rebuilds the schema cleanly from the edited files.
- **Keep `anchor_lat` / `anchor_lng`** everywhere — only the text *label* goes. Do not touch the
  filters, radius, host-control, or the anchor coordinates.
- **`AnchorSummary` keeps "Pinned location" + radius**, just without the `anchorLabel` prop. Do not
  delete the component.
- **Smallest change.** Do not refactor the create-room forms, the lobby panels, or the RPCs beyond
  removing `anchor_label`. Phases 0–4.7 are done; do not rebuild them.

### Phase 4.8 maps to the roadmap §6.8 bullets + the exit criterion

- Remove the text field + re-head the map/radius group with "Where are we eating?" → Prompts 4 (web)
  and 5 (mobile)
- Drop `anchor_label` from the contract + core type → Prompt 1
- Drop it from the api-client (request mapping, raw/result shapes, `mapRoomRow` / `ROOM_COLUMNS`,
  tests) → Prompt 3
- Rewrite migrations `0002`/`0005`/`0017`/`0019` in place to remove the column + reshape the RPCs
  → Prompt 2
- Lobby "Pinned location"; `AnchorSummary` loses the prop → Prompts 4/5
- Lockstep docs + exit verification → Prompt 6

**Exit check (after all 6):** on **both** apps, Create Room shows **no** location text field, with
"Where are we eating?" heading the map + radius group; a room still creates via the (now
`anchor_label`-free) `create_room` contract and lands in the lobby; the lobby shows "Pinned
location" (+ radius); `grep -rn "anchor_label\|anchorLabel"` over `packages/*/src`, `apps/*/src`,
`apps/*/app`, and `supabase/{migrations,functions}` finds **nothing** — including the migrations,
which were rewritten in place; `supabase db reset` applies all migrations cleanly on a fresh DB; and
`pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green tree-wide.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and the docs/ it points to relevant to this task — especially
  docs/07-initial-roadmap.md §6.6 (Phase 4.6, the anchor map) and §6.8 (Phase 4.8, this work),
  docs/03-database-schema.md §3.2 (rooms), docs/04-api-specification.md §3.1/§3.2/§3.3, and
  docs/10-pages.md §3.3/§3.5.
- This phase is a PRESENTATION + CONTRACT change only: it removes the vestigial free-text
  "Where are we eating?" anchor_label input AND the rooms.anchor_label column end-to-end (the
  FULL-removal option, not a UI hide). It does NOT change matchmaking, caching, the provider call
  count, realtime, the anchor coordinates (anchor_lat/anchor_lng), filters, radius, or
  host-control. Honor all four CLAUDE.md §2 invariants and §3 security rules. Provider/service-role
  keys never enter apps/* or packages/*.
- The anchor is still set by the AnchorMap (map.getCenter() on move-end, Phase 4.6) — do NOT add
  geocoding/search (deferred, docs/07 §8). Only the text LABEL field+column are removed.
- Phases 0–4.7 are DONE — do NOT rebuild rooms, the match mechanic, resolution, filters, auth,
  match history, the anchor map, or presence/membership. Make the smallest change that satisfies
  the task.
- RESOLVED DECISIONS (do not relitigate): remove the anchor_label input, the rooms.anchor_label
  column, and every code reference (core type, Zod schemas, api-client mappers, RPC params/returns,
  tests); keep anchor_lat/anchor_lng; "Where are we eating?" becomes the heading for the
  AnchorMap + RadiusSlider group; AnchorSummary keeps "Pinned location" (+ radius) but drops its
  anchorLabel prop.
- MIGRATIONS: rewriting migrations IN PLACE is the standard workflow here (CLAUDE.md §6). Phase 4.8
  edits the existing migrations 0002, 0005, 0017, 0019 to remove anchor_label (no new migration
  file); `supabase db reset` rebuilds from the edited files. Do NOT add a 0021 / DROP COLUMN /
  DROP FUNCTION.
- TypeScript strict everywhere; no business logic or data access in components (CLAUDE.md §4);
  snake_case at the DB, camelCase at the api-client boundary (docs/06 §5).
- If you change behavior a doc (or an in-code comment / JSDoc) describes, update it in the same
  change (CLAUDE.md §1). When done, run the stated acceptance checks and report their actual output.
```

---

## Prompt 1 — Core: drop `anchorLabel` from the `Room` type and the room Zod schemas

```
Goal: remove anchor_label from the @munch/core contract — the Room type and every room request/
response Zod schema that carries it. Pure package; no RN/DOM imports. This is the source of truth
the api-client and both apps type against, so doing it first surfaces every downstream reference
via the compiler. Independent of the migration; may run alongside Prompt 2.
Reference: docs/03-database-schema.md §3.2, docs/04-api-specification.md §3.1/§3.2/§3.3,
docs/06-coding-standards.md §3/§5, CLAUDE.md §4/§5.

Context: packages/core/src/types/room.ts defines Room with `anchorLabel: string | null`.
packages/core/src/validation/rooms.ts carries `anchor_label` in FOUR schemas: createRoomRequest
(required), joinRoomResponse.room, updateRoomFiltersRequest (optional), updateRoomFiltersResponse
.room. Keep anchorLat/anchorLng and everything else.

Deliver:
- types/room.ts: remove the `anchorLabel` field from the Room interface (keep anchorLat/anchorLng).
- validation/rooms.ts: remove `anchor_label` from createRoomRequestSchema, joinRoomResponseSchema
  (its `room` object), updateRoomFiltersRequestSchema, and updateRoomFiltersResponseSchema (its
  `room` object). Do not touch the filters/anchor-coordinate/radius fields.
- Scan the package for any other anchorLabel reference (re-exports, fixtures, tests) and remove it.

Done when: `pnpm --filter @munch/core typecheck` and `pnpm --filter @munch/core test` pass; no
`anchorLabel`/`anchor_label` remains under packages/core/src; Room has no anchorLabel and the four
schemas no longer mention it.
```

---

## Prompt 2 — Rewrite migrations `0002`/`0005`/`0017`/`0019` in place to remove `anchor_label`

```
Goal: remove anchor_label from the database by EDITING the existing migrations in place — as if the
column had never existed. Rewriting migrations in place is the standard workflow here (CLAUDE.md
§6); `supabase db reset` rebuilds from the edited files. NO new migration file. Independent of
Prompt 1 (SQL, not typechecked against TS); may run alongside it.
Reference: docs/03-database-schema.md §3.2, docs/04-api-specification.md §3.1/§3.2/§3.3,
CLAUDE.md §6. anchor_label lives in migrations 0002, 0005, 0017, 0019.

Context: 0002 declares rooms.anchor_label. 0005 defines create_room + update_room_filters (each
with a p_anchor_label parameter and matching REVOKE/GRANT signatures) and the first join_room.
0017 and 0019 each `create or replace` join_room and return `'anchor_label', v_room.anchor_label`.
Because the column is being removed from 0002, EVERY function that reads v_room.anchor_label
(v_room rooms%rowtype) must stop doing so, or `supabase db reset` fails when it re-applies them.
The error-message convention and rate-limit logic in these files must be preserved verbatim — only
anchor_label handling changes.

Deliver:
1. 0002_tables.sql: remove the `anchor_label text` column line from the rooms CREATE TABLE.
2. 0005_room_rpcs.sql:
   - create_room: remove the `p_anchor_label text` parameter; remove anchor_label from the INSERT
     column list + VALUES. Update the function's REVOKE/GRANT statements to the new argument-type
     signature (drop the anchor_label `text`). Keep code generation, rate limit, host-member
     insert, and the {room:{id,code}, member:{…}} return.
   - update_room_filters: remove the `p_anchor_label` parameter; remove the
     `anchor_label = coalesce(p_anchor_label, anchor_label)` line from the UPDATE; remove
     'anchor_label' from the returned room jsonb. Update its REVOKE/GRANT to the new signature.
     Keep the host check, the lobby-only SESSION_INVALID_STATE guard, and all other coalesces.
   - join_room (the 0005 definition): remove `'anchor_label', v_room.anchor_label` from its
     returned room jsonb. Signature unchanged.
3. 0017_membership_cohort.sql AND 0019_join_room_guard.sql: in each join_room `create or replace`,
   remove `'anchor_label', v_room.anchor_label` from the returned room jsonb. Change nothing else
   (keep the cohort/guard logic exactly).
4. Confirm supabase/seed/seed.sql does not reference anchor_label (it should not); if it does,
   remove it.

Do NOT add a 0021 (or any new) migration; do NOT use DROP COLUMN / DROP FUNCTION — the edits make
the column and the parameters simply never exist, and `db reset` rebuilds from the edited files.

Done when: `supabase db reset` applies the full (edited) migration set with no error; `\d rooms`
shows no anchor_label column; create_room / update_room_filters / join_room exist with the trimmed
signatures + correct grants and return the documented JSON minus anchor_label; and
`grep -rn anchor_label supabase/migrations` returns nothing.
```

---

## Prompt 3 — api-client: drop `anchor_label` from request mapping, raw/result shapes, room read

```
Goal: remove anchor_label from the only package that knows endpoint names/shapes (CLAUDE.md §4),
and from the integration-test payloads. Depends on Prompts 1 (core types) and 2 (RPC shapes).
Reference: docs/04 §3.1/§3.2/§3.3, docs/06 §5, packages/api-client/src/endpoints/rooms.ts and the
rooms/sessions integration tests.

Context: endpoints/rooms.ts carries anchor_label in: the createRoom rpc args (p_anchor_label);
RawCreateRoomResponse (no, it has none — confirm); RawJoinRoomResponse + JoinRoomResult; Raw
UpdateRoomFiltersResponse + UpdateRoomFiltersResult; the updateRoomFilters rpc args
(p_anchor_label); the joinRoom + updateRoomFilters result mappers (anchorLabel: raw.…); and the
lobby read path ROOM_COLUMNS string + RoomRow interface + mapRoomRow. Keep anchorLat/anchorLng and
every other field.

Deliver:
- rooms.ts:
    • createRoom: drop `p_anchor_label: req.anchor_label` from the rpc(...) args.
    • updateRoomFilters: drop `p_anchor_label: req.anchor_label ?? null` from the rpc(...) args.
    • Result interfaces: remove `anchorLabel` from JoinRoomResult.room and UpdateRoomFiltersResult
      .room Picks.
    • Raw interfaces: remove `anchor_label` from RawJoinRoomResponse.room and
      RawUpdateRoomFiltersResponse.room.
    • Mappers: remove `anchorLabel: raw.room.anchor_label` from the joinRoom and updateRoomFilters
      return mapping.
    • Lobby read: remove `anchor_label` from the ROOM_COLUMNS select string, from the RoomRow
      interface, and from mapRoomRow.
- Integration tests: remove the `anchor_label: "Test Anchor"` line from the createRoom payloads in
  rooms.integration.test.ts and sessions.integration.test.ts. Re-scan both files (and any other
  api-client test) for anchorLabel response assertions and remove them.

Done when: `pnpm --filter @munch/api-client typecheck` and `pnpm --filter @munch/api-client test`
pass (the latter against local Supabase with the rewritten migrations applied); no
`anchor_label`/`anchorLabel` remains
under packages/api-client/src.
```

---

## Prompt 4 — Web: remove the text field, re-head the map/radius group, drop the lobby label

```
Goal: remove the "Where are we eating?" text input from web Create Room, move that prompt to head
the AnchorMap + RadiusSlider group, and drop anchorLabel from the lobby summary. Depends on Prompt
3. May run in parallel with Prompt 5 (mobile) and must match its result (parity is a project norm).
Reference: docs/09-design-system.md §7 (Field, AnchorMap), docs/10-pages.md §3.3/§3.5,
CLAUDE.md §2.2/§4. Study apps/web/src/features/room/create-room-form.tsx,
apps/web/src/components/anchor-summary.tsx, apps/web/src/features/room/lobby-filters-panel.tsx.

Deliver:
- create-room-form.tsx: delete the `anchorLabel`/`setAnchorLabel` state and the entire
  <Field label="Where are we eating?"> block wrapping the location <Input> (and its MapPin icon).
  Remove `anchor_label` from the createRoomRequestSchema.safeParse payload. Remove the now-unused
  `MapPin` import (keep `Input` — it is still used for "Your name"). Wrap the AnchorMap +
  RadiusSlider in a group headed "Where are we eating?" (e.g. a <Field label="Where are we
  eating?"> around the AnchorMap, with the RadiusSlider's existing "Search radius" sub-label
  beneath). If the Field primitive forces input semantics, use a plain heading element instead.
- anchor-summary.tsx: remove the `anchorLabel` prop; render the static "Pinned location" (+ the
  radius when `radiusM` is provided). Update the component's doc comment (it currently talks about
  blank labels).
- lobby-filters-panel.tsx: stop passing `anchorLabel={room.anchorLabel}` to <AnchorSummary>.

Done when: `pnpm --filter @munch/web typecheck`, `pnpm --filter @munch/web lint`, and
`pnpm --filter @munch/web build` pass; `pnpm dev:web` against local Supabase shows Create Room with
NO location text field, "Where are we eating?" heading the map + radius, a successful room create,
and a lobby reading "Pinned location" (+ radius); no `anchorLabel` remains under apps/web/src.
```

---

## Prompt 5 — Mobile: twin of Prompt 4 (Expo / React Native)

```
Goal: bring mobile Create Room + lobby to parity with web — remove the anchor_label TextInput,
re-head the map/radius group, drop the lobby label. Depends on Prompt 3. May run in parallel with
Prompt 4 and must match its behavior (parity norm). Reference: same docs as Prompt 4; docs/06 §6
(no RN-form-conflicting semantics). Study apps/mobile/src/features/room/create-room-form.tsx,
apps/mobile/src/components/anchor-summary.tsx, apps/mobile/src/features/room/lobby-filters-panel.tsx.

Deliver:
- create-room-form.tsx: delete the `anchorLabel`/`setAnchorLabel` state and the
  <Field label="Where are we eating?"> block wrapping the <Input> + its map-pin icon View. Remove
  `anchor_label` from the safeParse payload. Remove the now-unused `Feather` import and the
  `anchorInput` / `anchorIcon` entries from the StyleSheet. Head the AnchorMap + RadiusSlider group
  with a "Where are we eating?" Field label (RN parity with web).
- anchor-summary.tsx: remove the `anchorLabel` prop; render static "Pinned location" (+ radius);
  update the doc comment.
- lobby-filters-panel.tsx: stop passing `anchorLabel={room.anchorLabel}` to <AnchorSummary>.

Done when: `pnpm --filter @munch/mobile typecheck` and `pnpm --filter @munch/mobile lint` pass;
`pnpm dev:mobile` (dev build) shows Create Room with no location text field, "Where are we eating?"
over the map + radius, a successful create, and a lobby "Pinned location"; behavior matches web; no
`anchorLabel` remains under apps/mobile/src.
```

---

## Prompt 6 — Lockstep doc reconciliation + Phase 4.8 exit verification

```
Goal: reconcile every doc the removal touches (this phase reverses a Phase 4.6 decision, so the
doc updates are mandatory) and verify the exit criterion + green CI. Depends on Prompts 1–5.
Reference: docs/06 §10/§11, docs/07 §6.8 (exit), CLAUDE.md §1 (code/doc parity).

Deliver:
- LOCKSTEP doc reconciliation (same change, CLAUDE.md §1):
    • docs/03-database-schema.md §3.2: remove the `anchor_label text` column line from the rooms
      DDL and any surrounding prose that describes it.
    • docs/04-api-specification.md: remove `anchor_label` from the create_room REQUEST example
      (§3.1) and the join_room RESPONSE example (§3.2). Confirm no other §3 example still shows it.
    • docs/10-pages.md §3.3: drop "Field (optional `anchor_label`)" from the primitives list and
      the "`anchor_label` stays an optional free-text field" sentence; state that "Where are we
      eating?" now heads the map + radius group. §3.5: ensure the lobby anchor description matches
      "Pinned location" (no label field).
    • docs/09-design-system.md: if the AnchorMap/AnchorSummary notes imply a label field, adjust to
      the map-pick-only + "Pinned location" reality.
    • Confirm CLAUDE.md does not reference anchor_label (it should not); if it does, reconcile.
    • Leave docs/phase-4.6-prompts.md AS-IS (it is the historical prompt log for Phase 4.6 — not a
      live spec). The migrations 0002/0005/0017/0019 WERE rewritten in place this phase (Prompt 2),
      so they must contain no anchor_label. The roadmap §6.6 bullets may get a short
      "(removed in Phase 4.8 — §6.8)" parenthetical, but do not rewrite the phase.
- EXIT verification:
    • Run `grep -rn "anchor_label\|anchorLabel" packages/*/src apps/*/src apps/*/app
      supabase/migrations supabase/functions` and confirm it returns NOTHING — including the
      migrations, which were rewritten in place. (Historical prompt docs under docs/ are out of
      scope for this grep.)
    • `supabase db reset` applies the full edited migration set cleanly; \d rooms has no
      anchor_label.
    • `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green tree-wide.
    • Manual on both apps: Create Room shows no location text field, "Where are we eating?" heads
      the map + radius, a room creates via the anchor_label-free create_room contract and lands in
      the lobby showing "Pinned location" (+ radius).

Done when: every listed doc reflects the removal; the grep finds anchor_label NOWHERE under
packages/apps/supabase; `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green tree-wide;
and the manual exit check holds on web and mobile.
```
