# Coding Standards

**Project:** Munch
**Document:** Coding Standards
**Status:** Draft v1 — for build
**Last updated:** 2026-05-25

---

## 1. Language & general principles

- **TypeScript everywhere**, `strict` mode on. No implicit `any`; prefer precise types.
- Shared logic lives in `packages/core`; never duplicate domain rules across apps.
- Favor small, pure functions for domain logic (matching, ranking, shuffle) so they are
  trivially testable and identical across client and server.
- Optimize for a solo maintainer: clarity over cleverness, obvious names, short files.

---

## 2. TypeScript configuration

- A single `tsconfig.base.json` at the root; each package/app extends it.
- Enable: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes`, `forceConsistentCasingInFileNames`.
- No `// @ts-ignore` without an adjacent comment explaining why and a tracking note.
- Domain types are defined once in `@munch/core/types` and imported everywhere; do not
  redefine a `Restaurant` or `Session` shape locally.

---

## 3. Validation

- **Zod** schemas in `@munch/core/validation` are the single source of truth for request and
  response shapes.
- Every Edge Function / RPC validates its input against the shared schema before doing
  work; clients validate before sending.
- Derive TypeScript types from Zod schemas (`z.infer`) rather than hand-writing parallel
  interfaces, so validation and types never drift.

---

## 4. Formatting & linting

- **Prettier** for formatting (default config; do not hand-format).
- **ESLint** with the TypeScript plugin; treat warnings as errors in CI.
- Recommended rules: no unused vars (except `_`-prefixed), exhaustive `deps` for React
  hooks, no floating promises, consistent import ordering.
- Run lint + typecheck in a pre-commit hook (e.g. lint-staged + husky) and in CI.

---

## 5. Naming conventions

- Files: `kebab-case.ts`. React components: `PascalCase.tsx`.
- Types/interfaces: `PascalCase`. Variables/functions: `camelCase`. Constants:
  `SCREAMING_SNAKE_CASE` only for true module-level constants.
- Booleans read as predicates: `isPresent`, `hasMatched`, `canResolve`.
- Endpoint modules mirror the API spec names (`create_room` → `createRoom`).
- Database identifiers are `snake_case` (Postgres convention); map to `camelCase` at the
  `api-client` boundary so app code stays idiomatic TS.

---

## 6. React / React Native conventions

- Function components and hooks only; no class components.
- Co-locate a component with its styles and tests within its feature folder.
- Data fetching/subscription logic lives in feature hooks (e.g. `useSession`,
  `useDeck`, `useMatchSubscription`), not inline in screens.
- Keep screens thin: they compose hooks + presentational components.
- No business rules in components — call into `@munch/core` (e.g. ranking, shuffle).
- Never use `<form>` semantics that conflict with React Native; use explicit handlers.

---

## 7. State management

- Server state via the realtime subscriptions + a query layer (e.g. TanStack Query) in the
  `api-client` consumers; avoid hand-rolled caches.
- Local UI state via React state/hooks. Avoid a global store unless a clear need emerges.
- The authoritative source of truth for matches is always the server; client state is
  optimistic and reconciled on the realtime event.

---

## 8. Error handling

- All endpoints return the standard error shape from the API spec
  (`{ error: { code, message } }`). Never leak raw provider or DB errors to clients.
- Client surfaces user-friendly messages mapped from error `code`s; log the rest.
- Wrap all provider calls in try/catch; a provider failure becomes `PROVIDER_ERROR`,
  never a crash.
- Promises are never left floating; either `await` or explicitly handle.

---

## 9. Security & privacy (enforced in code)

- **Provider API keys only in Edge Functions / server env.** Never imported into
  `apps/*` or shipped to a client bundle. CI should fail if a key pattern appears in
  client code.
- **RLS is mandatory** on every table; no table ships without a policy.
- The authoritative match check runs server-side in a transaction; clients cannot declare
  a match.
- Do not log full swipe data or PII. Logs use ids, not names, where possible.
- No long-term swipe storage; cleanup jobs run on session end (see schema doc).
- Respect provider caching terms: restaurant rows carry `expires_at` and are purged.

---

## 10. Testing

- **Unit tests** (Vitest/Jest) for all `@munch/core` domain logic — matching, ranking,
  shuffle determinism — with edge cases (ties, member leaves mid-session, deck exhaustion).
- **Integration tests** for Edge Functions against a local Supabase, focused on the swipe
  + match-check transaction and the widen flow.
- The unanimous match check and the closest-to-unanimous ranking are the highest-risk
  logic and must have thorough tests.
- Keep tests fast; mock the provider with a fixture set of restaurants.

---

## 11. Commits, branches, CI

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`) for a readable history.
- Trunk-based with short-lived branches; small PRs even when solo (good audit trail).
- CI runs: install → typecheck → lint → unit tests → build. Block merge on failure.
- Migrations are committed to `supabase/migrations` and never edited after being applied;
  add a new migration to change schema.

---

## 12. Environment & secrets

- `.env` files are git-ignored; provide `.env.example` with non-secret placeholders.
- Distinguish client-public config (e.g. Supabase anon key, allowed) from server-only
  secrets (provider key, service role key — never in client).
- Document required env vars in the README and validate their presence at server startup.

---

## 13. Documentation discipline

- These `docs/*.md` files are the source of truth; update them when behavior changes,
  in the same PR as the change.
- Public functions in `@munch/core` and `api-client` carry short doc comments describing
  intent, not restating the code.
