# Tech Stack

**Project:** Munch
**Document:** Tech Stack
**Status:** Draft v1 — for build
**Last updated:** 2026-05-25

---

## 1. Summary

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (everywhere) | One language across mobile, web, and backend logic for a solo dev. |
| Mobile | **Expo (React Native)** | True installable iOS + Android apps from one codebase. |
| Web | **Next.js (React)** | Shares logic/types with mobile; good for landing + link/QR joins. |
| Shared code | **Monorepo** (`@munch/core`, `@munch/api-client`) | No duplicated domain logic. |
| Backend | **Supabase** | Managed Postgres + Realtime + Auth + Edge Functions; minimal ops. |
| Database | **Postgres** (via Supabase) | Relational fit for rooms/members/sessions/swipes; RLS. |
| Realtime | **Supabase Realtime** | Live lobby presence and instant match broadcast. |
| Auth | **Supabase Auth** | Anonymous guests + optional email+password / Google OAuth accounts (sign-in only outside a room). |
| Data provider | **Google Places** (v1) behind an abstraction | Broad coverage, gentler per-call price; swappable. |
| Validation | **Zod** (in `@munch/core`) | One schema source for client + server. |
| Tooling | ESLint, Prettier, Vitest/Jest, GitHub Actions | Standard, low-friction quality gates. |

---

## 2. Why this stack for *this* project and *this* builder

The decisive constraints were: **solo developer**, **all three platforms**, a hard
**real-time** requirement, and **cost that must scale**. This stack is chosen specifically
against those.

### 2.1 Expo (React Native) over true native

True native (separate Swift + Kotlin codebases, plus a third for web) means three apps in
two-plus languages for one person to keep in sync — the classic way a solo project stalls.
For a restaurant-swiping app, nothing about the requirements (swipe gestures, real-time
updates, card UI, location) forces native; Expo produces genuine installable iOS and
Android apps and shares a large code surface with the web app. One language to learn
(TypeScript), one codebase to maintain, three real platforms. This was an explicit,
discussed trade-off in favor of shipping.

### 2.2 Supabase over rolling your own real-time backend

The match-the-instant-the-last-person-likes mechanic needs real-time push. Supabase
provides Postgres, Realtime subscriptions, the exact guest+optional-account auth model the
product calls for, and Edge Functions for server-authoritative logic — all managed. A
hand-rolled Node + WebSocket + Postgres + Redis stack gives more control but is a large
amount of undifferentiated plumbing for a solo founder. Supabase gets the product into
users' hands faster; the architecture doc notes exactly when you'd outgrow it.

### 2.3 Google Places (behind an abstraction) over Yelp/Foursquare for v1

Restaurant data is the main external cost and the main external risk. Google's usage-based
pricing is gentler per call than Yelp's current per-call rates, and coverage is broad. The
real protection, though, is the **provider abstraction layer**: all fetching goes through
one interface, so a future switch to Yelp or Foursquare is a single-class change. Providers
change pricing and terms with little notice, so this is risk management, not tidiness.

> **Action before building/launch:** verify current pricing and (critically) caching terms
> on the chosen provider's own pricing page. Third-party summaries drift, and caching limits
> directly shape the per-session caching design.

---

## 3. The cost-defining design decision

Independent of any single vendor, the stack is built around **per-session caching**: fetch
the restaurant pool once when a session starts, cache it for the session, and serve every
swipe from the cache. The app is billed roughly per *session*, not per *swipe*. This is the
single most important reason the chosen data layer is affordable at public-launch scale,
and it is why the provider client lives server-side in an Edge Function, never the client.

---

## 4. Supporting libraries (indicative, not exhaustive)

- **Navigation:** Expo Router (mobile), Next.js App Router (web).
- **Styling/UI:** shared design tokens in `@munch/ui` (platform-agnostic constants); **Quicksand**
  font (`expo-font` on mobile, `next/font` on web); **Tailwind v4** on web (theme seeded from the
  tokens), RN `StyleSheet` on mobile. No `react-native-web` — tokens are shared, components are
  per-app. See `docs/09-design-system.md`.
- **Server state:** TanStack Query layered over the `api-client`.
- **Validation:** Zod (shared).
- **Maps/geo:** lightweight distance math in `@munch/core`; provider supplies coordinates.
  A map view is post-v1 (cards show distance, not a live map, in v1).
- **Testing:** Vitest or Jest for `@munch/core` domain logic; local Supabase for integration
  tests of Edge Functions.
- **CI/CD:** GitHub Actions for typecheck/lint/test/build; Expo EAS for mobile builds and
  store submission; a host such as Vercel for the Next.js web app.

---

## 5. Environments & secrets

- **Client-public:** Supabase URL + anon key (safe to ship).
- **Server-only:** provider API key, Supabase service-role key — only in Edge Functions /
  server env, never in an app bundle. CI should reject provider-key patterns in client code.
- `.env.example` documents required vars; servers validate presence at startup.

---

## 6. Known limitations & exit ramps

- **Supabase ceiling:** very high concurrent session volume or bespoke matchmaking needs may
  eventually warrant a dedicated Node + WebSocket + Redis service in front of the same
  Postgres. The provider abstraction and per-session-cache concept carry over unchanged.
- **Single provider:** v1 ships on one provider; the abstraction makes adding a second a
  contained change if quality or cost demands it.
- **Expo constraints:** if a future feature needs a capability outside Expo's managed
  surface, Expo supports custom native modules (dev/config plugins) without abandoning the
  shared codebase.

---

## 7. What stays constant even if pieces change

The durable architectural commitments — independent of vendor choices — are: TypeScript
end-to-end with a shared core, a server-authoritative real-time match check, the
provider-abstraction boundary, and per-session caching. If any single vendor in the table
above is swapped later, these four principles should survive the change.
