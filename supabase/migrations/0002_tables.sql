-- 0002_tables.sql
-- Core tables, indexes, and the two deferred FKs. Mirrors docs/03-database-schema.md §3-§4.
-- UUID PKs (gen_random_uuid), timestamptz audit columns default now() (doc 03 §1).
-- Tables are created in dependency order; the rooms <-> room_members cycle is broken by
-- leaving rooms.host_member_id FK-less until room_members exists (added at the bottom).
-- RLS is enabled separately in 0003_rls_policies.sql.

-- 3.1 profiles ---------------------------------------------------------------
-- Extends Supabase auth.users; only signed-in users have a profile.
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 3.2 rooms ------------------------------------------------------------------
-- host_member_id is nullable with no FK yet: it points at room_members, which does not
-- exist until below. The rooms_host_member_fk constraint is added at the end of this file.
create table rooms (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,           -- 6-digit join code
  host_member_id      uuid,                            -- set after host member row exists
  anchor_label        text,                            -- human-readable area/address
  anchor_lat          double precision not null,
  anchor_lng          double precision not null,
  filter_open_now     boolean not null default true,
  filter_cuisines     text[] not null default '{}',    -- cuisine identifiers
  filter_price_levels price_level[] not null default '{}',
  default_radius_m    integer not null default 3000,   -- starting radius for the slider
  is_active           boolean not null default true,   -- soft-close the room
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_rooms_code on rooms (code);

-- 3.3 room_members -----------------------------------------------------------
-- A participant in a room; guests (user_id null) and signed-in users both appear here.
create table room_members (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null, -- null for guests
  display_name text not null,
  role         member_role not null default 'member',
  is_present   boolean not null default true,          -- lobby/live presence
  joined_at    timestamptz not null default now(),
  left_at      timestamptz
);

create index idx_room_members_room_id on room_members (room_id);
create unique index idx_room_members_room_user on room_members (room_id, user_id)
  where user_id is not null;                            -- a user joins a room once

-- 3.4 sessions ---------------------------------------------------------------
-- One round of swiping. Filters/radius are snapshotted so later room edits don't mutate an
-- in-flight session. matched_restaurant_id FK is deferred (restaurants created below).
create table sessions (
  id                    uuid primary key default gen_random_uuid(),
  room_id               uuid not null references rooms (id) on delete cascade,
  status                session_status not null default 'lobby',
  radius_m              integer not null,               -- effective radius at start
  filter_open_now       boolean not null,
  filter_cuisines       text[] not null,
  filter_price_levels   price_level[] not null,
  started_at            timestamptz,
  ended_at              timestamptz,
  matched_restaurant_id uuid,                            -- FK added at end of file
  created_at            timestamptz not null default now()
);

create index idx_sessions_room_id on sessions (room_id);
create index idx_sessions_status on sessions (status);

-- 3.5 restaurants ------------------------------------------------------------
-- Normalized provider results, populated once per session and short-lived (expires_at) to
-- respect provider caching terms (CLAUDE.md §3). Not a permanent local mirror.
create table restaurants (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,                           -- 'google' | 'yelp' | ...
  provider_ref text not null,                           -- provider's place id
  name         text not null,
  lat          double precision not null,
  lng          double precision not null,
  rating       numeric(2, 1),                           -- e.g. 4.3
  price_level  price_level,
  cuisines     text[] not null default '{}',
  photo_url    text,
  is_open_now  boolean,
  fetched_at   timestamptz not null default now(),
  expires_at   timestamptz not null                     -- enforce short-lived caching
);

create index idx_restaurants_provider_ref on restaurants (provider, provider_ref);
create index idx_restaurants_expires_at on restaurants (expires_at);

-- 3.6 cached_decks -----------------------------------------------------------
-- Links a session to its ordered pool. Per-member shuffle order is derived deterministically
-- client-side (seed = member id + session id), so it is not stored. added_round lets a
-- "widen" append unseen restaurants without re-dealing existing ones.
create table cached_decks (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  added_round   integer not null default 0,             -- 0 = initial deck, 1+ = widen rounds
  created_at    timestamptz not null default now(),
  unique (session_id, restaurant_id)
);

create index idx_cached_decks_session_id on cached_decks (session_id);

-- 3.7 swipes -----------------------------------------------------------------
-- A member's decision on one restaurant. Session-scoped, purged when the session ends
-- (no long-term swipe logging, CLAUDE.md §3). The (session_id, restaurant_id) index
-- supports the unanimous match check (doc 03 §5).
create table swipes (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions (id) on delete cascade,
  member_id     uuid not null references room_members (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  decision      swipe_decision not null,
  created_at    timestamptz not null default now(),
  unique (session_id, member_id, restaurant_id)         -- one decision per card per member
);

create index idx_swipes_session_restaurant on swipes (session_id, restaurant_id);
create index idx_swipes_session_member on swipes (session_id, member_id);

-- 3.8 matches ----------------------------------------------------------------
-- The outcome of a session (clean unanimous match or host resolution).
create table matches (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null unique references sessions (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id),
  resolution    text not null,                          -- 'unanimous' | 'host_accepted_top'
  decided_at    timestamptz not null default now()
);

-- 3.9 match_history ----------------------------------------------------------
-- Durable outcome record for signed-in users only (guests get none). Stores the app's own
-- outcome snapshot, NOT a copy of provider content (CLAUDE.md §3).
create table match_history (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  match_id             uuid not null references matches (id) on delete cascade,
  restaurant_name      text not null,                   -- denormalized snapshot
  restaurant_photo_url text,
  participant_names    text[] not null default '{}',    -- snapshot of who was there
  decided_at           timestamptz not null,
  created_at           timestamptz not null default now(),
  unique (user_id, match_id)
);

create index idx_match_history_user_id on match_history (user_id);

-- 4. Deferred FKs to resolve table-creation cycles (doc 03 §4) ----------------
alter table rooms
  add constraint rooms_host_member_fk
  foreign key (host_member_id) references room_members (id) on delete set null;

alter table sessions
  add constraint sessions_matched_restaurant_fk
  foreign key (matched_restaurant_id) references restaurants (id) on delete set null;
