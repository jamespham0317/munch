# Folder Structure

**Project:** Munch
**Document:** Folder Structure
**Status:** Draft v1 — for build
**Last updated:** 2026-05-25

---

## 1. Approach

A **monorepo** managed with a workspace tool (pnpm workspaces or Turborepo). This lets the
Expo mobile app and the Next.js web app share a single TypeScript core (domain types,
matching/ranking logic, validation schemas, the Supabase client wrapper) without
duplication — the key reason a solo developer can maintain all three targets.

---

## 2. Top-level layout

```
group-restaurant-match/
├── apps/
│   ├── mobile/                 # Expo (React Native) — iOS + Android
│   └── web/                    # Next.js — browser app + landing
├── packages/
│   ├── core/                   # shared TS: types, domain logic, validation
│   ├── api-client/             # typed wrapper over Supabase + RPC endpoints
│   └── ui/                     # optional shared cross-platform UI primitives
├── supabase/
│   ├── migrations/             # SQL migrations (schema, RLS policies)
│   ├── functions/              # Edge Functions (server-side logic)
│   └── seed/                   # local dev seed data
├── docs/                       # these specification documents
├── .github/workflows/          # CI (lint, typecheck, test, build)
├── package.json                # workspace root
├── pnpm-workspace.yaml         # (or turbo.json)
├── tsconfig.base.json          # shared TS config extended by each package
└── README.md
```

---

## 3. `apps/mobile` (Expo / React Native)

```
apps/mobile/
├── app/                        # expo-router routes (file-based)
│   ├── index.tsx               # entry / home
│   ├── room/
│   │   ├── create.tsx
│   │   ├── join.tsx
│   │   └── [roomId]/
│   │       ├── lobby.tsx
│   │       ├── session.tsx     # the swiping screen
│   │       └── result.tsx      # match / resolution announcement
│   └── history.tsx             # signed-in users only
├── src/
│   ├── components/             # SwipeCard, RadiusSlider, MemberList, etc.
│   ├── features/
│   │   ├── room/               # hooks + state for rooms
│   │   ├── session/            # swiping, deck shuffle, match subscription
│   │   └── auth/               # guest + account flows
│   ├── lib/                    # platform glue (location, haptics, storage)
│   └── theme/                  # design tokens
├── assets/
├── app.json                    # Expo config
└── package.json
```

- Consumes `@munch/core` and `@munch/api-client`. No business logic duplicated here.
- Deterministic deck shuffle lives in `core`; the screen just renders the order.

---

## 4. `apps/web` (Next.js)

```
apps/web/
├── app/                        # Next.js App Router
│   ├── page.tsx                # landing / home
│   ├── room/
│   │   ├── create/page.tsx
│   │   ├── join/[code]/page.tsx   # link/QR target resolves here
│   │   └── [roomId]/
│   │       ├── lobby/page.tsx
│   │       ├── session/page.tsx
│   │       └── result/page.tsx
│   └── history/page.tsx
├── src/
│   ├── components/
│   ├── features/               # mirrors mobile feature folders where shared
│   └── lib/
├── public/
├── next.config.js
└── package.json
```

- Reuses the same `core` and `api-client` packages as mobile.
- The join link (`/room/join/{code}`) and QR both resolve to the same join path.

---

## 5. `packages/core`

The heart of code reuse. No platform-specific imports.

```
packages/core/
├── src/
│   ├── types/                  # Room, Member, Session, Restaurant, Swipe, Match
│   ├── domain/
│   │   ├── matching.ts         # unanimous check (client-side optimistic mirror)
│   │   ├── ranking.ts          # closest-to-unanimous ranking + tiebreaks
│   │   └── shuffle.ts          # deterministic seeded deck order
│   ├── validation/             # Zod schemas shared client + server
│   └── constants.ts            # radius bounds, room size limits, etc.
├── package.json
└── tsconfig.json
```

- `matching.ts` and `ranking.ts` encode the rules from the product spec so both client
  (optimistic UI) and server (authoritative) reference the same definitions.

---

## 6. `packages/api-client`

```
packages/api-client/
├── src/
│   ├── supabase.ts             # configured client factory
│   ├── endpoints/              # one module per RPC/Edge Function
│   │   ├── rooms.ts            # create_room, join_room, update_room_filters
│   │   ├── sessions.ts         # start_session, get_deck, resolve_session
│   │   ├── swipes.ts           # submit_swipe
│   │   └── realtime.ts         # channel subscription helpers
│   └── index.ts
├── package.json
└── tsconfig.json
```

- Typed against `@munch/core` types; the only place that knows endpoint names/shapes.

---

## 7. `supabase`

```
supabase/
├── migrations/
│   ├── 0001_enums.sql
│   ├── 0002_tables.sql
│   ├── 0003_rls_policies.sql
│   └── 0004_functions.sql      # match check, ranking, security-definer RPCs
├── functions/
│   ├── start-session/          # provider fetch + cache
│   ├── submit-swipe/           # swipe + authoritative match check
│   ├── resolve-session/        # accept_top / widen
│   └── _shared/
│       ├── provider/           # RestaurantProvider interface
│       │   ├── index.ts
│       │   └── google-places.ts
│       └── normalize.ts        # provider payload -> NormalizedRestaurant
└── seed/
```

- The provider abstraction lives under `functions/_shared/provider` so a future
  `yelp.ts` / `foursquare.ts` slots in beside `google-places.ts`.

---

## 8. Naming conventions

- Packages are namespaced `@munch/*` (e.g. `@munch/core`, `@munch/api-client`).
- Folders and files: `kebab-case` for files, `PascalCase` for React components.
- Feature-first organization inside apps (`features/<domain>/`) over type-first.
- Anything used by more than one app must live in a `packages/*` package, never copied.
