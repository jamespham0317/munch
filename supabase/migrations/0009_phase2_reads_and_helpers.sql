-- 0009_phase2_reads_and_helpers.sql
-- Phase 2, Prompt 2 (part 1/4): the deck-scoped read on `restaurants`, a pure distance helper,
-- and a thin read RPC that projects the doc-04 §3.6 `get_deck` response shape (incl. the
-- server-computed `distance_m`). No privileged writes here — those land in 0010/0011.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit this file, add another.
--
-- restaurants kept RLS enabled with NO select policy after 0007 (the Phase-0 smoke was torn
-- down). This migration restores a single, narrowly scoped read path: a restaurant row is
-- selectable iff it appears in a cached_decks row for a session whose room the caller is a
-- member of. Mirrors cached_decks_select_member (0003); reuses the auth_is_room_member helper.

-- Deck-scoped restaurants read --------------------------------------------------
create policy restaurants_select_deck_member on restaurants
  for select to authenticated
  using (
    exists (
      select 1
      from cached_decks cd
      join sessions s on s.id = cd.session_id
      where cd.restaurant_id = restaurants.id
        and auth_is_room_member(s.room_id)
    )
  );

-- haversine_m: great-circle distance in metres ---------------------------------
-- WGS-84 mean radius (6_371_000 m). Pure function (no I/O, no GUC reads): `immutable
-- parallel safe` lets the planner reuse it across rows. get_deck_for_session below is the
-- Phase-2 caller; Phase 3's ranking distance-tiebreak (docs/03 §6) will reuse this helper.
create function public.haversine_m(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns integer
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select round(
    2 * 6371000 * asin(
      sqrt(
        sin(radians((lat2 - lat1) / 2)) ^ 2
        + cos(radians(lat1)) * cos(radians(lat2))
        * sin(radians((lng2 - lng1) / 2)) ^ 2
      )
    )
  )::integer;
$$;

-- get_deck_for_session: thin read RPC backing docs/04 §3.6 -------------------
-- A `security invoker` RPC (the default for `language sql`) so the existing RLS still
-- applies: the caller only sees rows for sessions in rooms they belong to (via the
-- cached_decks_select_member and restaurants_select_deck_member policies above). The RPC
-- exists only because projecting a computed distance alongside a PostgREST embed is
-- awkward — the api-client (Prompt 4) maps the snake_case rows to DeckRestaurant[].
-- Ordering by cached_decks.created_at keeps the deck stable per session; per-member
-- shuffle order is derived client-side (seed = member id + session id) so it's NOT stored.
create function public.get_deck_for_session(p_session_id uuid)
returns table (
  id           uuid,
  name         text,
  lat          double precision,
  lng          double precision,
  rating       numeric(2, 1),
  price_level  price_level,
  cuisines     text[],
  photo_url    text,
  is_open_now  boolean,
  distance_m   integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    r.id,
    r.name,
    r.lat,
    r.lng,
    r.rating,
    r.price_level,
    r.cuisines,
    r.photo_url,
    r.is_open_now,
    haversine_m(rm.anchor_lat, rm.anchor_lng, r.lat, r.lng) as distance_m
  from cached_decks cd
  join restaurants r on r.id = cd.restaurant_id
  join sessions s    on s.id = cd.session_id
  join rooms rm      on rm.id = s.room_id
  where cd.session_id = p_session_id
  order by cd.created_at;
$$;

-- Execute grants: authenticated sessions (incl. anonymous guests) only.
revoke execute on function public.get_deck_for_session(uuid) from public;
grant  execute on function public.get_deck_for_session(uuid) to authenticated;
