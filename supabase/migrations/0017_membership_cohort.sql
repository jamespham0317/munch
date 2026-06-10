-- 0017_membership_cohort.sql
-- Phase 4.7, Prompt 2: split cosmetic presence from the match cohort. The cohort is no longer
-- "present members" but ACTIVE members (room_members.left_at IS NULL); cosmetic Here/Away moves
-- to Realtime Presence and is never read by any matchmaking code (CLAUDE.md §2.3, docs/02 §5,
-- roadmap §6.7). This migration:
--   1. adds member_heartbeats (authoritative liveness; the sweeper in Prompt 3 reaps stale rows),
--   2. re-bases EVERY is_present-scoped function onto `left_at is null`, and
--   3. drops room_members.is_present and adds a partial active-member index.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit an applied file, add another.
--
-- SCOPE NOTE: Prompt 2 names three matchmaking functions, but FIVE objects scope to is_present —
-- check_unanimous_match (0010), is_deck_exhausted (0014), get_resolution_ranking (0015),
-- record_match_history (0016), and join_room's member payload (0005). All five are re-based here;
-- dropping the column while any still referenced it would break that function at call time.
-- Functions are replaced BEFORE the column drop so there is no window where they reference a
-- missing column.
--
-- REALTIME: room_members is in supabase_realtime (0006); a per-10s heartbeat on that table would
-- storm subscribeRoom, so member_heartbeats is a SEPARATE, UNPUBLISHED table. Do NOT add it to the
-- publication. Dropping a column from a published table is safe (default replica identity = PK).

-- member_heartbeats: authoritative liveness (docs/03 §3.x) ----------------------
-- One row per member, upserted by the client every HEARTBEAT_INTERVAL_S (10s). Only the
-- security-definer sweeper (prune_absent_members, Prompt 3) reads it — clients get no SELECT
-- policy. NOT published to realtime. last_seen_at defaults to now() so an initial insert is a
-- valid heartbeat on its own.
create table member_heartbeats (
  member_id    uuid primary key references room_members (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table member_heartbeats enable row level security;

-- A caller may write ONLY its own heartbeat. auth_owns_member (0003) is the security-definer
-- "this member row belongs to auth.uid()" helper — reused here. Both INSERT and UPDATE policies
-- exist so the api-client's upsert (insert ... on conflict do update) passes RLS. No SELECT
-- policy: clients never read heartbeats (only the definer sweeper does).
create policy member_heartbeats_insert_own on member_heartbeats
  for insert to authenticated
  with check (auth_owns_member(member_id));

create policy member_heartbeats_update_own on member_heartbeats
  for update to authenticated
  using (auth_owns_member(member_id))
  with check (auth_owns_member(member_id));

grant insert, update on member_heartbeats to authenticated;

-- check_unanimous_match: now ACTIVE-member-scoped (docs/03 §5) -------------------
-- Replaces 0010. The cohort is the session's room members with left_at is null — cosmetic
-- presence (Here/Away) no longer affects the answer. Every other line is verbatim 0010: the
-- >0-and-equal logic, security definer, and stable volatility are unchanged.
create or replace function public.check_unanimous_match(
  p_session_id uuid,
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active_members as (
    select rm.id
    from room_members rm
    join sessions s on s.room_id = rm.room_id
    where s.id = p_session_id
      and rm.left_at is null
  ),
  likers as (
    select member_id
    from swipes
    where session_id = p_session_id
      and restaurant_id = p_restaurant_id
      and decision = 'like'
  )
  select (select count(*) from active_members) > 0
     and (select count(*) from active_members)
       = (select count(*) from likers
          where member_id in (select id from active_members));
$$;

-- is_deck_exhausted: now ACTIVE-member-scoped ----------------------------------
-- Replaces 0014. True iff there is at least one active member AND no (active_member ×
-- cached_deck_card) pair lacks a swipe. Cohort swap only; logic verbatim from 0014.
create or replace function public.is_deck_exhausted(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active_members as (
    select rm.id
    from room_members rm
    join sessions s on s.room_id = rm.room_id
    where s.id = p_session_id
      and rm.left_at is null
  ),
  deck as (
    select restaurant_id
    from cached_decks
    where session_id = p_session_id
  )
  select exists (select 1 from active_members)
     and not exists (
       select 1
       from active_members pm
       cross join deck d
       where not exists (
         select 1 from swipes sw
         where sw.session_id    = p_session_id
           and sw.member_id     = pm.id
           and sw.restaurant_id = d.restaurant_id
       )
     );
$$;

-- get_resolution_ranking: now ACTIVE-member-scoped (docs/04 §3.8) ---------------
-- Replaces 0015. pass_count / like_count / member_count are scoped to active members
-- (left_at is null). The closest-to-unanimous order (pass_count asc, rating desc nulls last,
-- distance_m asc) and the host-only auth are verbatim from 0015 (CLAUDE.md §2.4).
create or replace function public.get_resolution_ranking(p_session_id uuid)
returns table (
  restaurant_id uuid,
  name          text,
  pass_count    integer,
  like_count    integer,
  member_count  integer,
  rating        numeric(2, 1),
  distance_m    integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_room_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- Resolve the session's room, then assert the caller hosts it. A nonexistent session leaves
  -- v_room_id null, so auth_is_room_host(null) is false → NOT_HOST: we never leak existence.
  select s.room_id into v_room_id from sessions s where s.id = p_session_id;
  if not auth_is_room_host(v_room_id) then
    raise exception 'NOT_HOST';
  end if;

  return query
  with active_members as (
    select rm.id
    from room_members rm
    join sessions s on s.room_id = rm.room_id
    where s.id = p_session_id
      and rm.left_at is null
  )
  select
    r.id,
    r.name,
    count(*) filter (
      where sw.decision = 'pass'
        and sw.member_id in (select id from active_members)
    )::integer as pass_count,
    count(*) filter (
      where sw.decision = 'like'
        and sw.member_id in (select id from active_members)
    )::integer as like_count,
    (select count(*) from active_members)::integer as member_count,
    r.rating,
    haversine_m(rm.anchor_lat, rm.anchor_lng, r.lat, r.lng) as distance_m
  from cached_decks cd
  join restaurants r on r.id = cd.restaurant_id
  join sessions   s on s.id = cd.session_id
  join rooms      rm on rm.id = s.room_id
  left join swipes sw
    on sw.session_id = cd.session_id
   and sw.restaurant_id = r.id
  where cd.session_id = p_session_id
  group by r.id, r.name, r.rating, r.lat, r.lng, rm.anchor_lat, rm.anchor_lng
  order by pass_count asc, r.rating desc nulls last, distance_m asc;
end;
$$;

-- record_match_history: participants/recipients now ACTIVE-member-scoped --------
-- Replaces 0016's writer. The participant snapshot and the set of history recipients are the
-- session's ACTIVE members (left_at is null) — the same cohort the match check now uses. The
-- signed-in test (a profiles row), guest exclusion, and (user_id, match_id) idempotency are
-- verbatim from 0016. submit_swipe (0016) is NOT replaced here: it only calls this function and
-- the two cohort checks, all of which are re-based in place, so the hot path picks up the new
-- semantics automatically.
create or replace function public.record_match_history(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match_id      uuid;
  v_restaurant_id uuid;
  v_decided_at    timestamptz;
  v_name          text;
  v_photo_url     text;
  v_participants  text[];
begin
  -- The authoritative outcome lives in `matches` (unique per session). If it isn't written yet
  -- this is a no-op — defensive only; the callers invoke this AFTER writing the match row.
  select m.id, m.restaurant_id, m.decided_at
    into v_match_id, v_restaurant_id, v_decided_at
  from matches m
  where m.session_id = p_session_id;
  if v_match_id is null then
    return;
  end if;

  -- Snapshot the restaurant name + photo from the matched `restaurants` row. We store the app's
  -- own outcome snapshot, not a live provider mirror (CLAUDE.md §3).
  select r.name, r.photo_url
    into v_name, v_photo_url
  from restaurants r
  where r.id = v_restaurant_id;

  -- participant_names = every ACTIVE member of the session's room (guests included — they were
  -- there). Same active-member cohort as the match check (CLAUDE.md §2.3).
  select array_agg(rm.display_name order by rm.joined_at)
    into v_participants
  from room_members rm
  join sessions s on s.room_id = rm.room_id
  where s.id = p_session_id
    and rm.left_at is null;

  -- One row per active member that HAS a profiles row (the signed-in test — guests with a
  -- user_id but no profile are EXCLUDED via the inner join). Idempotent on (user_id, match_id).
  insert into match_history (
    user_id, match_id, restaurant_name, restaurant_photo_url, participant_names, decided_at
  )
  select rm.user_id, v_match_id, v_name, v_photo_url, v_participants, v_decided_at
  from room_members rm
  join sessions s on s.room_id = rm.room_id
  join profiles p on p.id = rm.user_id
  where s.id = p_session_id
    and rm.left_at is null
  on conflict (user_id, match_id) do nothing;
end;
$$;

-- join_room: drop the is_present key from the member payload --------------------
-- Replaces 0005. is_present no longer exists, so the embedded members list omits it. This is the
-- MINIMAL change for the column drop; Prompt 3 replaces join_room again to add the ROOM_IN_SESSION
-- roster-freeze guard and lobby re-join reactivation. Every other line is verbatim 0005.
create or replace function public.join_room(
  p_code         text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Per-identity join limit: at most this many rooms joined (as a non-host) per window.
  c_max_joins constant integer  := 10;
  c_window    constant interval := interval '1 hour';
  v_uid       uuid := (select auth.uid());
  v_recent    integer;
  v_room      rooms%rowtype;
  v_member_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- Rate limit: count member joins by this identity within the window (host rows excluded
  -- so creating rooms doesn't consume the join budget).
  select count(*) into v_recent
  from room_members
  where user_id = v_uid
    and role = 'member'
    and joined_at > now() - c_window;
  if v_recent >= c_max_joins then
    raise exception 'RATE_LIMITED';
  end if;

  select * into v_room from rooms where code = p_code;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if not v_room.is_active then
    raise exception 'ROOM_CLOSED';
  end if;
  if exists (
    select 1 from room_members
    where room_id = v_room.id and user_id = v_uid
  ) then
    raise exception 'ALREADY_JOINED';
  end if;

  insert into room_members (room_id, user_id, display_name, role)
  values (v_room.id, v_uid, p_display_name, 'member')
  returning id into v_member_id;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id, 'code', v_room.code, 'anchor_label', v_room.anchor_label
    ),
    'member', jsonb_build_object(
      'id', v_member_id, 'role', 'member', 'display_name', p_display_name
    ),
    'members', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', rm.id,
            'display_name', rm.display_name,
            'role', rm.role
          )
          order by rm.joined_at
        ),
        '[]'::jsonb
      )
      from room_members rm
      where rm.room_id = v_room.id
    )
  );
end;
$$;

-- Schema change: drop the cohort column, add the active-member partial index -----
-- No RLS policy or the supabase_realtime publication references is_present (they key on
-- user_id / room_id), so the drop is clean. The partial index serves cheap cohort and sweeper
-- scans (active members of a room).
alter table room_members drop column is_present;

create index idx_room_members_active on room_members (room_id) where left_at is null;

-- Re-pin execute grants on every replaced function to match their originals (grants inherit
-- across create-or-replace, but being explicit avoids drift — same pattern as 0010/0014/0016).
revoke execute on function public.check_unanimous_match(uuid, uuid) from public;
grant  execute on function public.check_unanimous_match(uuid, uuid) to authenticated;

revoke execute on function public.is_deck_exhausted(uuid) from public;
grant  execute on function public.is_deck_exhausted(uuid) to authenticated;

revoke execute on function public.get_resolution_ranking(uuid) from public;
grant  execute on function public.get_resolution_ranking(uuid) to authenticated;

revoke execute on function public.record_match_history(uuid) from public;
grant  execute on function public.record_match_history(uuid) to authenticated;

revoke execute on function public.join_room(text, text) from public;
grant  execute on function public.join_room(text, text) to authenticated;
