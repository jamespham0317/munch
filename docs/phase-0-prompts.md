# Phase 0 — Foundations: Agent Prompts

**Project:** Munch
**Source:** `docs/07-initial-roadmap.md` §2 (Phase 0)
**Purpose:** Phase 0 broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Prompts 5 and 6 (web and
mobile apps) can run in parallel once Prompt 4 is done.

**Prepend the shared preamble to every prompt.**

### Phase 0 maps to four roadmap bullets + one exit criterion

- Monorepo + `tsconfig.base` + ESLint/Prettier + CI → Prompts 1, 7
- Scaffold `apps/mobile` + `apps/web` with shared `@munch/core` → Prompts 2, 5, 6
- Stand up Supabase (auth, first migrations, RLS) → Prompt 3
- Wire `@munch/api-client` and prove a trivial authed read on both apps → Prompts 4, 5, 6

**Exit check (after all 7):** both apps build and run, each can create an anonymous session
and read the seeded row under RLS, and CI is green.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and the docs/ files it points to that are relevant to this task.
- Honor the §2 invariants and §3 security rules at all times: provider/service-role keys
  are server-only and must never appear in apps/* or packages/*; RLS on every table;
  domain rules live in packages/core and are never duplicated.
- This is Phase 0 (Foundations) per docs/07-initial-roadmap.md. Do NOT build Phase 1+
  features (rooms, swiping, matching logic, provider calls). Scaffold and stub only.
- Make the smallest change that satisfies the task. TypeScript strict everywhere.
- When done, run the stated acceptance checks and report their actual output.
```

---

## Prompt 1 — Monorepo + tooling foundation

```
Goal: a working pnpm + Turborepo monorepo skeleton with shared TS config and quality gates.
Reference: docs/05-folder-structure.md (§2), docs/06-coding-standards.md (§2,§4,§11),
CLAUDE.md §10.

Deliver:
- Root package.json (private, "packageManager": "pnpm@9"), workspace scripts:
  typecheck, lint, format, format:check, test, build, dev:mobile, dev:web
  (wired to turbo where applicable; dev:* are pnpm --filter aliases).
- pnpm-workspace.yaml covering apps/* and packages/*.
- turbo.json with a typecheck/lint/test/build pipeline and sensible dependsOn.
- .nvmrc pinned to Node 22.
- tsconfig.base.json with: strict, noUncheckedIndexedAccess, noImplicitOverride,
  exactOptionalPropertyTypes, forceConsistentCasingInFileNames.
- ESLint (TS plugin; treat warnings as errors; no-floating-promises, no-unused-vars
  except _-prefixed, consistent import ordering, react-hooks exhaustive-deps) + Prettier
  (default config).
- husky + lint-staged pre-commit running lint + format on staged files.
- .gitignore (node_modules, .env, build outputs), .env.example with non-secret
  placeholders only, and a README "first-time setup" section (corepack enable pnpm,
  nvm use, pnpm install).
- Empty apps/ and packages/ directories (with .gitkeep) ready for later prompts.

Done when: `pnpm install`, `pnpm typecheck`, `pnpm lint`, and `pnpm format:check` all
run clean on the empty workspace.
```

---

## Prompt 2 — `packages/core` (shared TypeScript core)

```
Goal: scaffold @munch/core with domain types, domain-logic modules, Zod validation,
and constants. This is the single source of truth other packages import.
Reference: docs/03-database-schema.md (enums + entities), docs/04-api-specification.md
(request/response shapes), docs/05-folder-structure.md (§5), docs/06-coding-standards.md
(§2,§3,§10).

Deliver:
- packages/core/package.json (name "@munch/core") + tsconfig.json extending tsconfig.base.
- src/types/: Room, RoomMember, Session, Restaurant, Swipe, Match, MatchHistory, and the
  enum unions SessionStatus, SwipeDecision, PriceLevel, MemberRole — matching the schema
  in doc 03. camelCase fields (mapping from snake_case happens at the api-client boundary).
- src/domain/shuffle.ts: implement a deterministic, seeded deck shuffle (seed = memberId +
  sessionId) — this is pure and needed, so implement it fully.
- src/domain/matching.ts and src/domain/ranking.ts: typed function signatures with minimal
  pure implementations and a TODO noting full logic + thorough tests land in Phase 2/3.
  Keep the closest-to-unanimous tiebreak order documented in ranking.ts: fewest passes →
  highest rating → nearest distance (do NOT reduce to a like count).
- src/validation/: Zod schemas for the core request/response shapes from doc 04; export
  TS types via z.infer (do not hand-write parallel interfaces).
- src/constants.ts: radius min/max, room size bounds (2–10), join-code length (6).
- src/index.ts barrel exports.
- One Vitest unit test proving shuffle determinism (same seed → same order; different
  member → different order).

Done when: `pnpm --filter @munch/core typecheck` and `pnpm --filter @munch/core test` pass.
Do NOT duplicate any of these types/rules into apps later.
```

---

## Prompt 3 — Supabase: migrations, RLS, seed, local config

```
Goal: the backend skeleton — enums, tables, deferred FKs, RLS on every table, seed data,
and local Supabase config.
Reference: docs/03-database-schema.md (entire), docs/02-system-architecture.md (§7),
docs/05-folder-structure.md (§7). CLAUDE.md §3, §6.

Deliver:
- supabase/ initialized (config.toml) for local dev.
- Migrations under supabase/migrations/, never edited once applied:
  - 0001_enums.sql — session_status, swipe_decision, price_level, member_role exactly per
    doc 03.
  - 0002_tables.sql — profiles, rooms, room_members, sessions, restaurants, cached_decks,
    swipes, matches, match_history, with the indexes and the deferred FK constraints
    (rooms_host_member_fk, sessions_matched_restaurant_fk) exactly per doc 03.
  - 0003_rls_policies.sql — RLS ENABLED on every table plus the per-table policies
    summarized in doc 03 (member-scoped reads/writes; users see only their own profile and
    match_history).
  - 0004_functions.sql — create the file as the home for the security-definer match-check
    and ranking RPCs, but leave them as documented stubs; full implementations land in
    Phase 2/3 (do not implement match logic now).
- supabase/seed/seed.sql — minimal seed for the Phase 0 connectivity smoke test: one row,
  in a table with a policy that lets ANY authenticated session (anonymous included) select
  it, that the Phase 0 end-to-end read will fetch. Clearly comment it as a Phase-0 smoke
  artifact to be tightened/removed in Phase 1.

Done when: `supabase start` then `supabase db reset` applies migrations + seed without
error; verify (a query against pg_tables/policy catalog) that RLS is enabled on every
table; confirm the seeded row is selectable by an authenticated session.
```

---

## Prompt 4 — `packages/api-client`

```
Goal: the typed Supabase wrapper — the only package that knows endpoint names/shapes —
plus anonymous auth and the single read used by the Phase 0 smoke test.
Reference: docs/04-api-specification.md (§1,§2), docs/05-folder-structure.md (§6),
docs/06-coding-standards.md (§5 snake_case→camelCase, §8 error shape).

Deliver:
- packages/api-client/package.json (name "@munch/api-client") + tsconfig extending base;
  depends on @munch/core.
- src/supabase.ts: client factory reading ONLY the public Supabase URL + anon key from env.
  Add a guard/comment asserting no service-role or provider key is ever read here.
- An auth helper wrapping signInAnonymously().
- A typed read function for the seeded smoke-test row that maps snake_case columns →
  camelCase and is typed against @munch/core.
- src/endpoints/ stubs (rooms.ts, sessions.ts, swipes.ts, realtime.ts) with signatures +
  TODOs referencing the phases that implement them.
- Standard error shape { error: { code, message } } helper; never leak raw DB errors.
- src/index.ts barrel.

Done when: `pnpm --filter @munch/api-client typecheck` passes; it imports @munch/core
types; no server-only secret is referenced anywhere in the package.
```

---

## Prompt 5 — Scaffold `apps/web` (Next.js)

```
Goal: a Next.js (App Router) app that consumes @munch/core + @munch/api-client and proves
the Phase 0 exit criterion in the browser: create an anonymous session and read the seeded
row under RLS.
Reference: docs/05-folder-structure.md (§4), docs/08-tech-stack.md (§4).
Depends on Prompts 1–4.

Deliver:
- apps/web Next.js app (TypeScript) using the layout in doc 05 §4 (app/ routes, src/
  components|features|lib).
- Env wiring via NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY; add the keys to
  .env.example (placeholders only).
- A page that, on load, signs in anonymously via @munch/api-client and renders the seeded
  row fetched under RLS. TanStack Query optional but preferred per the stack doc.
- No business logic in components; the read goes through @munch/api-client.

Done when: `pnpm dev:web` runs; the page displays the seeded row read under RLS via an
anonymous session against local Supabase; `pnpm --filter @munch/web build` passes.
```

---

## Prompt 6 — Scaffold `apps/mobile` (Expo)

```
Goal: an Expo (React Native, expo-router) app that consumes @munch/core +
@munch/api-client and proves the same Phase 0 exit criterion on a simulator/device:
anonymous session + seeded read under RLS.
Reference: docs/05-folder-structure.md (§3), docs/08-tech-stack.md (§2.1,§4).
Depends on Prompts 1–4. Can run in parallel with Prompt 5.

Deliver:
- apps/mobile Expo app using the layout in doc 05 §3 (app/ expo-router routes, src/
  components|features|lib|theme).
- Env wiring via EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY; add to
  .env.example (placeholders only).
- An entry screen that signs in anonymously via @munch/api-client and renders the seeded
  row read under RLS. No <form> semantics that conflict with RN; use explicit handlers.
- Reuse @munch/core types and the @munch/api-client read; no duplicated logic.

Done when: `pnpm dev:mobile` boots in Expo and the screen shows the seeded row read under
RLS via an anonymous session; typecheck passes for the app.
```

---

## Prompt 7 — CI pipeline

```
Goal: GitHub Actions CI that runs install → typecheck → lint → test → build and blocks on
failure, plus a guard against secrets leaking into client bundles.
Reference: docs/06-coding-standards.md (§11), CLAUDE.md §3/§9.

Deliver:
- .github/workflows/ci.yml: checkout, Node 22, corepack enable pnpm@9, pnpm install
  (with cache), then `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` as ordered
  gated steps.
- A lightweight check step that fails CI if a provider API key or Supabase service-role key
  pattern appears anywhere under apps/* or packages/* (per the security rules).

Done when: the workflow is valid and a local run of the same script sequence
(`pnpm typecheck && pnpm lint && pnpm test && pnpm build`) passes green on the assembled
tree.
```
