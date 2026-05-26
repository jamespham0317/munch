# Munch

A private-room app where friends swipe Tinder-style through nearby restaurants and the
session ends the instant **every** member has independently liked the **same** place.

Native iOS + Android (Expo) and web (Next.js), TypeScript end-to-end, Supabase backend.
See [`docs/`](./docs) for the full product, architecture, and schema specifications, and
[`CLAUDE.md`](./CLAUDE.md) for the operating guide and invariants.

## Repository layout

This is a pnpm + Turborepo monorepo.

```
apps/        # mobile (Expo) and web (Next.js) — scaffolded in later phases
packages/    # @munch/core (domain logic), @munch/api-client — later phases
supabase/    # migrations, RLS policies, Edge Functions — later phases
docs/        # specification documents (source of truth)
```

## First-time setup

Requires [Node 22](./.nvmrc) and [pnpm 9](https://pnpm.io) (managed via Corepack).

```sh
corepack enable pnpm   # activate the pinned pnpm version
nvm use                # switch to the Node version in .nvmrc (Node 22)
pnpm install           # install all workspace dependencies
```

`pnpm install` also installs the Husky pre-commit hook (lint + format on staged files).

## Quality gates

Run before every commit; these are the same checks CI enforces:

```sh
pnpm typecheck         # tsc across all packages (via Turborepo)
pnpm lint              # ESLint across all packages
pnpm test              # unit tests
pnpm build             # build apps + packages
pnpm format:check      # Prettier (use `pnpm format` to auto-fix)
```

## Running the apps

```sh
pnpm dev:web           # Next.js web app
pnpm dev:mobile        # Expo mobile app
```
