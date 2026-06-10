# CLAUDE.md

Operating guide for an AI agent working in this repository. Read this first, every session.
Keep it current: if a rule here stops matching reality, fix the rule in the same change.

---

## 1. What this project is

**Munch** — a private-room app where friends swipe Tinder-style through
nearby restaurants and the session ends the instant **every** member has independently
liked the **same** place. Native iOS + Android (Expo) and web (Next.js), TypeScript
end-to-end, Supabase backend.

The full specs live in `docs/`. This file is operational rules, not a re-summary — when in
doubt about *what* to build, read the spec; this file tells you *how* to work here.

### Source-of-truth docs (read before changing related code)
- `docs/01-product-specification.md` — product behavior, the matching mechanic, scope
- `docs/02-system-architecture.md` — caching model, realtime, state machine, security
- `docs/03-database-schema.md` — tables, enums, RLS, key queries
- `docs/04-api-specification.md` — RPC/Edge Function contracts, realtime channels
- `docs/05-folder-structure.md` — monorepo layout
- `docs/06-coding-standards.md` — the detailed standards this file summarizes
- `docs/07-initial-roadmap.md` — phasing and what is deferred
- `docs/08-tech-stack.md` — stack and the reasoning behind each choice
- `docs/09-design-system.md` — visual language: tokens, primitives, UI invariants (the reskin)
- `docs/10-pages.md` — screen inventory: routes, components, wiring, per-page invariants
- `docs/11-ui-roadmap.md` — phased UI reskin plan (layers on Phase 4 polish)

If code and docs disagree, that is a bug. Stop and reconcile — update whichever is wrong in
the same PR. Do not silently let them drift.

---

## 2. The four invariants — never violate these

These are load-bearing. Most of the product's correctness and economics depend on them.
If a task seems to require breaking one, stop and flag it rather than proceeding.

1. **Per-session caching.** The restaurant pool is fetched from the provider **once** at
   session start (and once per "widen" round) and cached for the session. **No swipe ever
   triggers a provider call.** The app is billed per session, not per swipe. Never add a
   per-card or per-swipe provider fetch.

2. **One shared deck + host-controlled filters.** All members swipe the **same** cached
   pool in their own shuffled order. Filters are set by the **host for the whole room** —
   never per-member in a way that could make decks non-overlapping, because that makes a
   unanimous match impossible. If you add filtering, members may only *narrow within* the
   host's set, never expand beyond it.

3. **Server-authoritative match check.** Whether a restaurant has a unanimous like is
   decided **server-side, transactionally** (Edge Function / RPC). Clients may compute
   optimistic UI but must never declare a match. "Every member" is relative to **active**
   members (`room_members.left_at IS NULL`) — re-evaluate when membership changes (a member
   joins/leaves or is auto-removed on disconnect). **Activity status (Here/Away) is purely
   cosmetic** and must never be read by matchmaking: an Away (backgrounded-but-connected)
   member is still active and their like is still required. One exception: if the **host**
   leaves mid-session, the session ends (status `cancelled`) and the room closes rather than
   re-evaluating — see `docs/01` §7 and `docs/04` §3.10.

4. **Closest-to-unanimous ranking.** Host-resolution ranking is by **fewest passes**, not
   most raw likes. Tiebreak order: fewest passes → highest average rating → nearest
   distance. Do not "simplify" this to a like count.

---

## 3. Security & privacy rules (enforced in code, not just convention)

- **Provider API keys and the Supabase service-role key are server-only.** They live in
  Edge Functions / server env. **Never** import them into `apps/*` or anything that ships
  in a client bundle. Treat a provider key appearing in client code as a build-breaking
  defect.
- **RLS on every table.** No table ships without a Row-Level Security policy. A member can
  only read/write rows for rooms they belong to; guests are scoped to their room.
- **No long-term swipe logging.** `swipes` and `cached_decks` are session-scoped and purged
  when a session ends. Do not add durable per-user swipe storage without an explicit
  product decision and consent flow (see deferred list in the roadmap).
- **Respect provider caching terms.** `restaurants` rows carry `expires_at` and are purged.
  The cache is session-scoped, not a permanent local mirror of provider data. `match_history`
  stores the app's own outcome (name snapshot, participants, date) — not provider content.
- **Guests are ephemeral.** Only signed-in users get `match_history`. Don't persist data for
  guests beyond the session.
- **Never expose other members' individual swipes** to clients — only aggregate progress
  counts.

---

## 4. How the code is organized

Monorepo (pnpm/Turborepo). Full tree in `docs/05-folder-structure.md`. The rule that matters:

- **Shared domain logic lives in `packages/core`** — types, `matching.ts`, `ranking.ts`,
  `shuffle.ts`, Zod validation. **Never duplicate a domain rule** (matching, ranking,
  shuffle, a `Restaurant`/`Session` type) inside an app. If two apps need it, it belongs in
  a package.
- `packages/api-client` is the **only** place that knows endpoint names/shapes.
- **Design tokens live once in `packages/ui`** (`@munch/ui`) — platform-agnostic constants
  (colors, type, spacing, radii, shadows), no RN/DOM imports. Both apps consume them; never
  re-define the palette per app. Component **implementations** stay per-app (no
  `react-native-web`). See `docs/09-design-system.md`.
- Provider code lives **only** in `supabase/functions/_shared/provider/` behind the
  `RestaurantProvider` interface. To add/swap a provider, add a class there — do not call a
  provider from anywhere else.
- Apps are feature-first (`features/<domain>/`); screens stay thin and call into hooks +
  `@munch/core`. No business rules in components.

---

## 5. Conventions (summary — full version in `docs/06-coding-standards.md`)

- **TypeScript strict** everywhere. No `any`; no `@ts-ignore` without an explanatory comment.
- **Zod schemas in `@munch/core/validation` are the single source of truth** for request/
  response shapes; derive TS types via `z.infer`. Validate input on both client and server.
- Files `kebab-case.ts`; React components `PascalCase.tsx`. DB identifiers are `snake_case`
  and mapped to `camelCase` at the `api-client` boundary.
- Function components + hooks only. Never use semantics that conflict with React Native
  forms; use explicit handlers.
- All endpoints return the standard error shape `{ error: { code, message } }`. Never leak
  raw provider/DB errors to clients. No floating promises.
- Conventional Commits. Small PRs even when solo. CI must pass: typecheck → lint → test →
  build.

---

## 6. Database & migrations

- Schema changes are **new migrations** in `supabase/migrations/`. **Never edit an
  already-applied migration** — add another one.
- Every new table needs: RLS enabled, a policy, and (if it holds provider data)
  retention/cleanup handling.
- The two highest-risk queries — the unanimous match check and the closest-to-unanimous
  ranking — are specified in `docs/03-database-schema.md`. Match the documented semantics
  exactly; they have tests (see §7).

---

## 7. Testing expectations

- **`packages/core` domain logic must have unit tests** — matching, ranking, shuffle
  determinism — including edge cases: ties in ranking, a member leaving mid-session, deck
  exhaustion with no match.
- The **swipe + match-check transaction** and the **widen flow** get integration tests
  against a local Supabase, with the provider **mocked** by a restaurant fixture set.
- Treat the unanimous check and the ranking as the highest-risk logic in the codebase; do
  not change them without updating/adding tests in the same change.
- Keep tests fast; never hit a real provider in tests.

---

## 8. Working agreements for the agent

- **Match the roadmap's phase order** (`docs/07-initial-roadmap.md`). The core real-time
  mechanic (Phase 2) is prioritized; don't gold-plate later phases first.
- **Respect the deferred list.** Rich cards, dietary filters, per-member "narrow" filters,
  personalization, monetization, and a second provider are **post-v1**. Don't build them
  into v1 without an explicit decision.
- **Make the smallest change that satisfies the task.** Prefer clarity over cleverness;
  this is a solo-maintained codebase.
- **When a task conflicts with §2 invariants or §3 security rules, stop and surface it**
  rather than working around it. These exist for correctness, cost, and privacy reasons.
- **Update docs in the same change** when you alter behavior they describe.
- Don't introduce a new dependency or a global state store without a clear, stated need —
  default to the stack in `docs/08-tech-stack.md`.

---

## 9. Open decisions not yet made (don't assume an answer)

These are genuinely undecided; if a task touches one, ask rather than inventing a default:

- **Provider pricing/ToS:** must be re-verified on the provider's own page before launch;
  exact current numbers are not assumed in code.

(Resolved: *host leaves mid-session* — the session ends (`cancelled`) and the room closes;
host role is **not** transferred. See invariant 3 above and `docs/01` §7 / `docs/04` §3.10.
Both halves are now implemented: Phase 1 soft-closed the room; Phase 2 added the
session-cancel half via the `cancel_active_session` RPC, wired into the api-client
`leaveRoom`/`endRoom` host paths.)

(Resolved: *presence vs. match cohort* (Phase 4.7) — these are now **split**. The match
cohort is the set of **active** members (`room_members.left_at IS NULL`), not "present"
members; the `is_present` column is gone. **Activity status (Here/Away) is purely cosmetic**,
driven by Supabase Realtime Presence (`{ memberId, focused }` on `room:{room_id}`), never
written to the DB and never read by matchmaking — Away means backgrounded-but-connected and
still counts. Authoritative liveness is a heartbeat to a dedicated `member_heartbeats` table,
reaped by `prune_absent_members()` on `pg_cron`: a member past the disconnect grace is removed
exactly like an explicit leave. Leaving removes you from the cohort (deletes your swipes,
re-checks for an immediate match); min cohort is 1; an emptied room ends `cancelled`; joining
is lobby-only (`ROOM_IN_SESSION` once a session exists). See `docs/07` §6.7 and `docs/02`
§5–§6 / `docs/03` §3.3 / `docs/04` §3.4/§3.10.)

---

## 10. Quick commands

Toolchain scaffolded in Phase 0. Requires Node 24 (`.nvmrc`) + pnpm 9
(`corepack enable pnpm`). See `README.md` for first-time setup.

```
# install
pnpm install

# typecheck / lint / format / test (run before every commit)
pnpm typecheck
pnpm lint                          # eslint, whole tree; also runs via husky pre-commit
pnpm format                        # prettier --write
pnpm format:check                  # prettier --check (CI gate)
pnpm test
pnpm build                         # turbo: next build + package typecheck

# run apps
pnpm dev:mobile                    # Expo  (alias: pnpm --filter @munch/mobile dev)
pnpm dev:web                       # Next.js (alias: pnpm --filter @munch/web dev)

# supabase (local — needs Supabase CLI + Docker)
supabase start
supabase db reset                  # apply migrations + seed/seed.sql
```
