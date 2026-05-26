# Product Specification

**Project:** Munch
**Document:** Product Specification
**Status:** Draft v1 — for build
**Last updated:** 2026-05-25

---

## 1. Overview

Munch is a private-room app that helps a group of friends collectively
decide where to eat. A host creates a room, members swipe Tinder-style through nearby
restaurants, and the session ends the moment every member has independently liked the same
place. It is available as native iOS and Android apps and as a web app.

The product solves the everyday "where should we eat?" deadlock by turning it into a fast,
playful, low-friction group game with a clear stopping condition.

---

## 2. Goals and non-goals

### Goals

- Let a group reach a unanimous restaurant decision in minutes, with no debate.
- Work the instant friends are together (shared code) or remote (shared link).
- Require zero setup friction: guests join with only a name.
- Ship to real users on all three platforms from a single primary codebase.
- Keep per-user data minimal and the running cost predictable.

### Non-goals (v1)

- Not a reservation or ordering platform (no booking, no payments to restaurants).
- Not a reviews platform; restaurant content comes from a third-party data provider.
- Not a persistent social network; no friend graphs, feeds, or profiles beyond an
  optional lightweight account.
- No personalization engine or recommendation learning at launch.

---

## 3. Target users

- Small social groups (2–10 people) deciding on a meal together, in person or remotely.
- Primary persona: the "organizer" friend who usually ends up making the decision and
  wants to offload it.
- Secondary persona: the "I don't care, anything's fine" friend who will happily swipe
  but won't research options.

---

## 4. Core concepts and terminology

- **Room** — a private space created by a host that members join to swipe together.
- **Host** — the member who creates the room, sets the area and filters, and starts and
  resolves sessions.
- **Member** — anyone in the room, including the host. May be a guest or a signed-in user.
- **Guest** — a member who joined with only a name and no account. Ephemeral.
- **Session** — one round of swiping toward a single decision, from start to match (or
  host resolution).
- **Deck** — the pool of restaurants fetched once at session start and cached for the
  session's life. Each member swipes their own shuffled order of this same deck.
- **Like / Pass** — a member's swipe decision on a restaurant card.
- **Match** — the end state where a restaurant has been liked by every member.
- **Host resolution** — the fallback when the deck is exhausted with no unanimous match.

---

## 5. Core user flow

1. **Create room.** Host opens the app and creates a room. Host sets the search anchor
   (an area or address) and room-wide filters (open-now, cuisine, price range).
2. **Invite.** Host shares a 6-digit code (for groups physically together) and/or a
   link/QR (for a group chat).
3. **Join.** Friends enter the code or tap the link. They join as a guest (enter a name)
   or as a signed-in user. They land in a room lobby showing who's present.
4. **Start session.** When the group is ready, the host starts the session. The deck is
   fetched once and cached.
5. **Swipe.** Each member swipes their own shuffled order through the shared deck. A radius
   slider lets members adjust how far out the search reaches (within the host's anchor).
6. **Match.** The instant a restaurant has a like from every member, the session ends and
   the match is announced live to the whole room with the restaurant's details.
7. **Resolve (fallback).** If the deck is exhausted before a unanimous match, the host is
   prompted to either accept the most-liked restaurant or widen the criteria (see §7).

---

## 6. Matching mechanic

The matching rule is the heart of the product and constrains several other decisions.

- **Unanimous.** A match requires a like from *every* current member of the room.
- **Live.** All members swipe during the same live session; the match is detected and
  broadcast in real time.
- **Independent decks.** Each member swipes their own shuffled order, so the experience
  feels personal and no one is "led" by another's choices.
- **One shared pool.** Critically, all members draw from the *same* cached deck. This is
  what makes unanimous matching possible — if decks did not overlap, a unanimous match
  could never occur. This is why filters are host-controlled (see §8), not per-member.

### Why these constraints interlock

Independent shuffle orders are only sound because the underlying pool is identical for
everyone. Host-controlled filters are required because per-member filters could produce
non-overlapping decks, making a unanimous match impossible. These are not arbitrary
choices; they are the minimum set of rules that makes the core mechanic resolvable.

---

## 7. Deck exhaustion and host resolution

A session ends in one of two ways:

1. **Clean match** — a restaurant reaches unanimous likes mid-deck; the session ends
   immediately on that restaurant.
2. **Host resolution** — the deck is exhausted with no unanimous winner. The app
   transitions to a host resolution prompt.

### Host resolution prompt

The host is shown the ranked results and chooses one of two actions:

- **Accept the top pick** — ends the session on the highest-ranked restaurant.
- **Widen the criteria** — loosens filters and/or increases the radius, fetches a fresh
  deck of restaurants *not already seen*, and resumes swiping. Earlier likes still count.

### Ranking rule: "closest to unanimous"

The ranking is by **closest to unanimous** — the restaurant with the *fewest members who
passed on it* ranks highest, not the one with the most raw likes. In a live race members
may have swiped different numbers of cards, so "fewest blockers" is truer to the app's
premise than raw like count.

- **Tie-break order:** fewest passes → highest average rating → nearest distance.

### Behavior details

- When widening re-fetches, members only swipe the *new* restaurants not already in the
  exhausted pool. Nobody re-swipes a card they have already seen.
- A member's earlier likes carry forward and still count toward unanimous.
- While the host is deciding, the room enters a brief **"waiting on host"** state so
  members are not swiping into a void.

---

## 8. Filters and preferences

- **Controlled by the host** for the whole room. This keeps the shared deck identical for
  all members, which the matching mechanic requires.
- **v1 filters:** open-now, cuisine type, price range ($–$$$$).
- **Radius:** a user-adjustable slider, operating within the host's chosen anchor.
- **Future (post-v1):** a "hybrid" mode where individual members may *narrow within* the
  host's set but never *expand beyond* it — preserving deck overlap. Dietary filters
  (vegetarian/vegan/halal/gluten-free) are a natural early addition.

---

## 9. Restaurant cards

### v1 card content

- Photo
- Name
- Rating
- Price level ($–$$$$)
- Distance from anchor

### Post-v1

- Menu links, review excerpts, multiple photos, hours detail, map preview.

Rich card content is explicitly a nice-to-have, not a launch blocker.

---

## 10. Identity and persistence

- **Guest by default.** Members can join with only a name; no account required.
- **Optional accounts.** A lightweight optional account unlocks persistence and is the
  primary funnel for retention.
- **Sessions are ephemeral.** Nothing is retained for guests after a session ends.
- **Match history** is saved only for signed-in users (e.g. "You matched on Pizzeria
  Libretto with Sara and Tom on May 12").
- **No full swipe logging** at launch. Individual like/pass history is not retained;
  it is privacy-sensitive and no v1 feature uses it. It can be added later if a
  personalization feature justifies it.

---

## 11. Monetization and scale

- **Free at launch.** No ads, no premium tier in v1.
- **Aiming for a public launch**, so the architecture is lean but not throwaway.
- Design leaves room for later monetization (e.g. premium rooms, larger groups,
  "super-like"-style mechanics) without a rewrite.

---

## 12. Out-of-scope risks to track

These are tracked in the architecture and roadmap docs and revisited before/at launch:

- **Data-provider pricing and ToS volatility** — providers change pricing and caching
  terms with little notice; mitigated by the provider-abstraction layer.
- **Abuse/spam on public rooms** — rate-limiting room creation, guest-name moderation.
- **Deck exhaustion edge cases** — resolved by the host-resolution design in §7, but
  worth monitoring in real usage (e.g. very sparse restaurant areas).

---

## 13. Success criteria for v1

- A group of 2–10 can go from room creation to a decision in a single sitting.
- Median time-to-decision under a few minutes for a typical urban area.
- A session reliably ends either in a clean match or a clear host resolution — never an
  ambiguous or stuck state.
- Cost per session stays bounded by the per-session caching design (see architecture doc).
