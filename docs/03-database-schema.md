# Database Schema

**Project:** Munch
**Document:** Database Schema (Postgres / Supabase)
**Status:** Draft v1 — for build
**Last updated:** 2026-05-25

---

## 1. Conventions

- Postgres (via Supabase). UUID primary keys (`gen_random_uuid()`).
- `created_at` / `updated_at` are `timestamptz`, default `now()`.
- Enums are Postgres enum types.
- Row-Level Security (RLS) is **enabled on every table**; policies summarized per table.
- "Member" = a participant row in a room (guest or signed-in). "User" = a persistent
  account in `auth.users` (Supabase-managed) plus our `profiles` extension.

---

## 2. Enum types

```sql
create type session_status as enum (
  'lobby',
  'active',
  'awaiting_host_resolution',
  'matched',
  'resolved',
  'cancelled'
);

create type swipe_decision as enum ('like', 'pass');

create type price_level as enum ('1', '2', '3', '4'); -- $ to $$$$

create type member_role as enum ('host', 'member');
```

---

## 3. Tables

### 3.1 `profiles` (optional accounts)

Extends Supabase `auth.users`. Only signed-in users have a profile.

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

- **RLS:** a user may select/update only their own profile row.

---

### 3.2 `rooms`

A private room created by a host.

```sql
create table rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,            -- 6-digit join code
  host_member_id uuid,                            -- set after host member row exists
  anchor_label  text,                             -- human-readable area/address
  anchor_lat    double precision not null,
  anchor_lng    double precision not null,
  filter_open_now boolean not null default true,
  filter_cuisines text[] not null default '{}',   -- cuisine identifiers
  filter_price_levels price_level[] not null default '{}',
  default_radius_m integer not null default 3000,  -- starting radius for the slider
  is_active     boolean not null default true,    -- soft-close the room
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on rooms (code);
```

- `host_member_id` references `room_members(id)`; added as an FK after that table exists
  (it is nullable to break the circular dependency at creation time).
- **RLS:** a member may select a room only if they have a `room_members` row for it (or by
  knowing the code during join, handled via a join RPC). Only the host may update room
  settings.

---

### 3.3 `room_members`

A participant in a room. Guests and signed-in users both appear here.

```sql
create table room_members (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null, -- anon uid for guests; null only if that auth user is deleted
  display_name text not null,
  role        member_role not null default 'member',
  is_present  boolean not null default true,    -- lobby/live presence
  joined_at   timestamptz not null default now(),
  left_at     timestamptz
);

create index on room_members (room_id);
create unique index on room_members (room_id, user_id)
  where user_id is not null;                     -- a user joins a room once
```

- **Every member has a `user_id`.** Guests sign in anonymously (`signInAnonymously`, see
  doc 04 §2), which creates an `auth.users` row; that anonymous id is stored as the guest's
  `user_id`. Signed-in users store their permanent id. The guest-vs-account distinction is
  the presence of a `profiles` row, **not** a null `user_id`. `user_id` goes null only if the
  underlying auth user is later deleted (`on delete set null`); the partial unique index
  tolerates those orphaned rows. The join RPC must always set `user_id` — the RLS policies
  below match on `user_id = auth.uid()`, so a member with a null `user_id` could not read
  even their own room.
- **RLS:** a member may select other members of the same room; may update only their own
  row (e.g. presence). Inserts go through a join RPC that validates the code.

---

### 3.4 `sessions`

One round of swiping toward a decision.

```sql
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  status        session_status not null default 'lobby',
  radius_m      integer not null,                -- effective radius at start
  -- snapshot of filters used for this session (rooms settings may change later)
  filter_open_now boolean not null,
  filter_cuisines text[] not null,
  filter_price_levels price_level[] not null,
  started_at    timestamptz,
  ended_at      timestamptz,
  matched_restaurant_id uuid,                     -- FK added after restaurants table
  created_at    timestamptz not null default now()
);

create index on sessions (room_id);
create index on sessions (status);
```

- A session snapshots the filters/radius so later room edits don't mutate an in-flight
  session.
- A session moves to the terminal **`cancelled`** status when the **host leaves
  mid-session** (or ends the room) — there is no host left to resolve it, so the room is
  soft-closed (`rooms.is_active = false`) and the session ends with no decision. `cancelled`
  is a terminal state for retention/cleanup (§7). Host role is not transferred.
- **RLS:** selectable by members of the session's room; status transitions performed by
  Edge Functions / host-only RPCs.

---

### 3.5 `restaurants` (normalized provider results)

The app's normalized restaurant model. Populated from the provider at session start.
Session-scoped and short-lived to respect provider caching terms.

```sql
create table restaurants (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,                   -- 'google' | 'yelp' | ...
  provider_ref  text not null,                   -- provider's place id
  name          text not null,
  lat           double precision not null,
  lng           double precision not null,
  rating        numeric(2,1),                    -- e.g. 4.3
  price_level   price_level,
  cuisines      text[] not null default '{}',
  photo_url     text,
  is_open_now   boolean,
  fetched_at    timestamptz not null default now(),
  expires_at    timestamptz not null             -- enforce short-lived caching
);

create index on restaurants (provider, provider_ref);
create index on restaurants (expires_at);
```

- A background job (or check on read) purges/refreshes rows past `expires_at` to respect
  provider terms. Restaurants are not a permanent local mirror of the provider.

---

### 3.6 `cached_decks`

Links a session to its ordered pool of restaurants. One row per (session, restaurant).

```sql
create table cached_decks (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  added_round   integer not null default 0,      -- 0 = initial deck, 1+ = widen rounds
  created_at    timestamptz not null default now(),
  unique (session_id, restaurant_id)
);

create index on cached_decks (session_id);
```

- Per-member shuffle order is derived deterministically client-side (e.g. seeded by
  member id + session id) so it need not be stored. `added_round` lets a "widen" append
  unseen restaurants without re-dealing existing ones.

---

### 3.7 `swipes`

A member's decision on one restaurant in a session.

```sql
create table swipes (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  member_id     uuid not null references room_members(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  decision      swipe_decision not null,
  created_at    timestamptz not null default now(),
  unique (session_id, member_id, restaurant_id)  -- one decision per card per member
);

create index on swipes (session_id, restaurant_id);
create index on swipes (session_id, member_id);
```

- The match check queries: for a given (session, restaurant), is there a `like` from every
  present member? The `(session_id, restaurant_id)` index supports this efficiently.
- **Privacy:** swipes are session-scoped and not exposed to other members beyond aggregate
  progress; purged when the session ends (no long-term swipe logging in v1).
- **RLS:** a member may insert/select only their own swipes; the match check runs in a
  `security definer` function with broader read scope.

---

### 3.8 `matches`

The outcome of a session (clean match or host resolution).

```sql
create table matches (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null unique references sessions(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id),
  resolution    text not null,                   -- 'unanimous' | 'host_accepted_top'
  decided_at    timestamptz not null default now()
);
```

- `resolution` records whether it ended by unanimous match or host acceptance of the
  closest-to-unanimous top pick.

---

### 3.9 `match_history` (signed-in users only)

Durable record of outcomes, saved only for members who are signed-in users.

```sql
create table match_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  match_id      uuid not null references matches(id) on delete cascade,
  restaurant_name text not null,                 -- denormalized snapshot
  restaurant_photo_url text,
  participant_names text[] not null default '{}',-- snapshot of who was there
  decided_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  unique (user_id, match_id)
);

create index on match_history (user_id);
```

- Stores the app's own outcome (name snapshot, who participated, when) — **not** a durable
  copy of provider content. Guests get no history row.
- **RLS:** a user may select only their own history rows.

---

## 4. Foreign keys deferred to resolve cycles

```sql
alter table rooms
  add constraint rooms_host_member_fk
  foreign key (host_member_id) references room_members(id) on delete set null;

alter table sessions
  add constraint sessions_matched_restaurant_fk
  foreign key (matched_restaurant_id) references restaurants(id) on delete set null;
```

---

## 5. Key query: the match check (conceptual)

```sql
-- Does `:restaurant_id` have a like from EVERY present member of `:session_id`?
with present_members as (
  select rm.id
  from room_members rm
  join sessions s on s.room_id = rm.room_id
  where s.id = :session_id and rm.is_present = true
),
likers as (
  select member_id
  from swipes
  where session_id = :session_id
    and restaurant_id = :restaurant_id
    and decision = 'like'
)
select (select count(*) from present_members) > 0
   and (select count(*) from present_members)
     = (select count(*) from likers
        where member_id in (select id from present_members)) as is_unanimous;
```

## 6. Key query: closest-to-unanimous ranking (host resolution)

```sql
-- Rank restaurants in a session by fewest passes, then rating, then distance.
select r.id,
       r.name,
       count(*) filter (where sw.decision = 'pass') as pass_count,
       r.rating,
       r.lat, r.lng
from cached_decks cd
join restaurants r on r.id = cd.restaurant_id
left join swipes sw
  on sw.session_id = cd.session_id and sw.restaurant_id = r.id
where cd.session_id = :session_id
group by r.id
order by pass_count asc, r.rating desc nulls last;  -- distance tiebreak applied in app
```

---

## 7. Retention & cleanup

- `restaurants` rows purged after `expires_at` (provider ToS compliance).
- `swipes` and `cached_decks` purged when a session reaches a terminal state (`matched`,
  `resolved`, or `cancelled` — e.g. the host left mid-session) — no long-term swipe logging.
- `match_history` retained for signed-in users until they delete it or their account.
- Guest `room_members` rows and ephemeral data cleared after the room closes.
