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

> **Mobile needs a dev build, not Expo Go.** The Create Room anchor map uses
> `@maplibre/maplibre-react-native` (Phase 4.6), which ships native code Expo Go
> cannot load. Build a custom dev client once (`npx expo prebuild` + `npx expo run:ios` /
> `run:android`, or an EAS dev build), then `pnpm dev:mobile` connects to it. The map
> also requests location once on Create Room; permission is opt-in and never blocks
> room creation.

The apps talk to a local Supabase. First time:

```sh
supabase start                          # needs the Supabase CLI + Docker
supabase db reset                       # apply migrations + seed/seed.sql
cp .env.example apps/web/.env.local     # then set NEXT_PUBLIC_SUPABASE_URL /
                                        # NEXT_PUBLIC_SUPABASE_ANON_KEY to the
                                        # values printed by `supabase start`
pnpm dev:web
```

The home screen lets a guest create or join a room; it signs in anonymously, then the lobby
shows the room's members updating live via Realtime (Phase 1). The Phase-0 connectivity-smoke
row and its read were removed in migration `0007`.
