-- 0015_get_resolution_ranking.sql
-- Phase 3, Prompt 2 (part 2/2): the closest-to-unanimous ranking RPC for the host resolution
-- prompt (docs/04 §3.8). Replaces the 0004 stub via `create or replace`, keeping the 0004
-- RETURNS TABLE signature EXACTLY — that signature is the contract the api-client maps
-- (Phase 3, Prompt 4). Migrations are immutable once applied (CLAUDE.md §6): never edit 0004.
--
-- CLOSEST-TO-UNANIMOUS IS LOAD-BEARING (CLAUDE.md §2.4): rank by FEWEST PASSES, then highest
--   rating, then nearest distance — NEVER by raw like count. Mirrors @munch/core ranking.ts.
--
-- PRESENT-MEMBER-SCOPED (pinned Phase-3 decision, consistent with check_unanimous_match and
--   ranking.ts JSDoc): pass_count / like_count count only currently present members, and
--   member_count is the present-member count. The conceptual query in docs/03 §6 is the
--   un-scoped sketch and defers distance to the app; this implementation supersedes it
--   (present-member-scoped, distance computed in SQL via haversine_m).
--
-- ERROR CONVENTION (same as 0005/0010): every failure is `raise exception` whose MESSAGE is
--   EXACTLY one doc-04 code (UNAUTHENTICATED / NOT_HOST); never embed prose. The api-client
--   maps the message onto an ErrorCode and never surfaces raw DB text (docs/06 §9).
--
-- AUTH: host-only. The host check is internal (raises NOT_HOST for a non-host), like
--   start_session — non-host members never call this RPC; their UI is the passive
--   "waiting on host" state keyed off the realtime status event. No session-state guard here
--   (docs/04 §3.8 requires only "host member"); the state guard lives on resolve_session.
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
  with present_members as (
    select rm.id
    from room_members rm
    join sessions s on s.room_id = rm.room_id
    where s.id = p_session_id
      and rm.is_present = true
  )
  select
    r.id,
    r.name,
    count(*) filter (
      where sw.decision = 'pass'
        and sw.member_id in (select id from present_members)
    )::integer as pass_count,
    count(*) filter (
      where sw.decision = 'like'
        and sw.member_id in (select id from present_members)
    )::integer as like_count,
    (select count(*) from present_members)::integer as member_count,
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

-- Execute grant: authenticated only; the host check is internal (like start_session's).
revoke execute on function public.get_resolution_ranking(uuid) from public;
grant  execute on function public.get_resolution_ranking(uuid) to authenticated;
