-- 0018_membership_lifecycle.sql
-- Phase 4.7, Prompt 3: the server-side membership lifecycle on top of the active-member cohort
-- (0017). Adds explicit leave, immediate match-on-membership-change, and disconnect
-- auto-removal. The cohort for every matchmaking check is ACTIVE members (room_members.left_at
-- IS NULL); cosmetic Here/Away never reaches this code (CLAUDE.md §2.3, docs/02 §5, roadmap §6.7).
-- Migrations are immutable once applied (CLAUDE.md §6): never edit this file, add another.
--
-- WHY THESE ARE SERVER-AUTHORITATIVE (CLAUDE.md §2.3): leaving must read ALL members' swipes,
-- delete the leaver's swipes, and write matches/sessions for an immediate re-check — none of
-- which a client may do under RLS. So the removal effect is security-definer SQL, not a client
-- write. Errors are the bare doc-04 code as the exception MESSAGE (same convention as 0005/0010/
-- 0011); the api-client maps them to ErrorCodes.
--
-- ONE AUTH-FREE REMOVAL PATH (deviation from the prompt's literal wording — intentional):
--   The prompt sketched the non-host empty-room and host paths as calling cancel_active_session
--   (0011). But cancel_active_session ENFORCES auth_is_room_host, and the sweeper below runs from
--   pg_cron with NO auth.uid() at all. A non-host emptying a room, and an unauthenticated cron
--   sweep, both must still cancel the session — so the shared removal logic CANNOT route through
--   the host-checked RPC. Instead `remove_member` (auth-free, security definer) is the single
--   removal effect, called by leave_room AFTER it authorizes the caller and by
--   prune_absent_members with no auth context. cancel_active_session (0011) is unchanged and
--   still serves the api-client end-room path.

-- recheck_unanimous_on_membership_change: declare a match if the SHRUNK cohort is now unanimous
-- -----------------------------------------------------------------------------------------------
-- Called after a member is removed: if any deck restaurant is now liked by EVERY remaining active
-- member, the match fires immediately — server-side, without waiting for another swipe (roadmap
-- §6.7). A unanimous card has 0 active passes by construction, so the closest-to-unanimous
-- tiebreak (CLAUDE.md §2.4) collapses to (rating desc nulls last, distance asc); haversine_m from
-- the room anchor mirrors get_resolution_ranking (0015/0017). Idempotent: the matches insert is
-- on-conflict-do-nothing and the status flip is guarded on a non-terminal status. INTERNAL ONLY —
-- callable by the security-definer removal paths, never granted to clients.
create function public.recheck_unanimous_on_membership_change(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status        session_status;
  v_active_count  integer;
  v_restaurant_id uuid;
begin
  -- Only non-terminal sessions can newly match. matched/resolved/cancelled are terminal no-ops.
  select status into v_status from sessions where id = p_session_id;
  if v_status is null or v_status not in ('active', 'awaiting_host_resolution') then
    return;
  end if;

  -- Active cohort size for this session's room (left_at is null). Min cohort is 1; an empty
  -- cohort never matches — the caller handles the empty-room cancel.
  select count(*) into v_active_count
  from room_members rm
  join sessions s on s.room_id = rm.room_id
  where s.id = p_session_id
    and rm.left_at is null;
  if v_active_count = 0 then
    return;
  end if;

  -- The best deck card liked by EVERY active member, if any. The like count joins back to
  -- room_members on left_at is null so only active members count (the leaver's swipes are also
  -- already deleted by remove_member — belt-and-suspenders).
  select cd.restaurant_id
    into v_restaurant_id
  from cached_decks cd
  join restaurants r  on r.id  = cd.restaurant_id
  join sessions    s  on s.id  = cd.session_id
  join rooms       rm on rm.id = s.room_id
  where cd.session_id = p_session_id
    and (
      select count(*)
      from swipes sw
      join room_members m on m.id = sw.member_id
      where sw.session_id    = p_session_id
        and sw.restaurant_id = cd.restaurant_id
        and sw.decision      = 'like'
        and m.left_at is null
    ) = v_active_count
  order by r.rating desc nulls last,
           haversine_m(rm.anchor_lat, rm.anchor_lng, r.lat, r.lng) asc
  limit 1;

  if v_restaurant_id is null then
    return;  -- no card unanimous across the current active cohort
  end if;

  -- Declare the match (idempotent on session_id), then re-read the authoritative restaurant from
  -- `matches` so a pre-existing row wins, flip the session, and snapshot history (active-scoped).
  insert into matches (session_id, restaurant_id, resolution)
  values (p_session_id, v_restaurant_id, 'unanimous')
  on conflict (session_id) do nothing;

  select restaurant_id into v_restaurant_id
  from matches where session_id = p_session_id;

  update sessions
     set status                = 'matched',
         matched_restaurant_id = v_restaurant_id,
         ended_at              = now()
   where id = p_session_id
     and status in ('active', 'awaiting_host_resolution');

  perform record_match_history(p_session_id);
end;
$$;

-- remove_member: the single, auth-free removal effect (see header) ------------------------------
-- Marks a member gone, deletes their swipes for the room's non-terminal sessions (so they truly
-- stop counting and can't resurrect on re-join — CLAUDE.md §3), then closes/recheck per role:
--   * HOST -> cancel any non-terminal session + soft-close the room (resolved host-leave policy:
--     no transfer — CLAUDE.md invariant 3).
--   * non-host -> per non-terminal session: an emptied cohort (0 active) cancels the session +
--     closes the room; otherwise re-check for an immediate match across the smaller cohort.
-- Returns true iff the room was closed. Idempotent: an unknown or already-left member is a no-op.
-- INTERNAL ONLY — callers (leave_room, prune_absent_members) must authorize; never granted to
-- clients. The owning role's execute right lets the security-definer callers invoke it.
create function public.remove_member(p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room_id      uuid;
  v_role         member_role;
  v_left_at      timestamptz;
  v_room_ended   boolean := false;
  v_session_id   uuid;
  v_active_count integer;
begin
  select room_id, role, left_at
    into v_room_id, v_role, v_left_at
  from room_members
  where id = p_member_id;

  -- Unknown or already-removed member: idempotent no-op (this call did not end the room).
  if v_room_id is null or v_left_at is not null then
    return false;
  end if;

  update room_members set left_at = now() where id = p_member_id;

  delete from swipes sw
  using sessions s
  where sw.member_id  = p_member_id
    and sw.session_id = s.id
    and s.room_id     = v_room_id
    and s.status in ('active', 'awaiting_host_resolution');

  -- Host departure closes the room (no transfer). cancel-equivalent of cancel_active_session
  -- (0011) inlined here so it works without the host auth-check this definer path doesn't need.
  if v_role = 'host' then
    update sessions
       set status = 'cancelled', ended_at = now()
     where room_id = v_room_id
       and status in ('lobby', 'active', 'awaiting_host_resolution');
    update rooms set is_active = false, updated_at = now() where id = v_room_id;
    return true;
  end if;

  -- Non-host: re-evaluate each non-terminal session against the now-smaller active cohort.
  for v_session_id in
    select id from sessions
    where room_id = v_room_id
      and status in ('active', 'awaiting_host_resolution')
  loop
    select count(*) into v_active_count
    from room_members
    where room_id = v_room_id and left_at is null;

    if v_active_count = 0 then
      -- Everybody left -> the session ends cancelled and the room closes (roadmap §6.7).
      update sessions set status = 'cancelled', ended_at = now() where id = v_session_id;
      update rooms set is_active = false, updated_at = now() where id = v_room_id;
      v_room_ended := true;
    else
      perform recheck_unanimous_on_membership_change(v_session_id);
    end if;
  end loop;

  return v_room_ended;
end;
$$;

-- leave_room: client-facing self-leave RPC -----------------------------------------------------
-- Replaces the api-client's former direct-write leave path. Resolves the caller's OWN active
-- membership, then applies remove_member. Non-host "Leave room" removes the caller (and may fire
-- an immediate match for the rest); host "End room" / host-leave closes the room. Returns
-- { member: { id, left_at }, room_ended }. Bare-code errors: UNAUTHENTICATED / FORBIDDEN.
create function public.leave_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_member_id  uuid;
  v_left_at    timestamptz;
  v_room_ended boolean;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- The caller's OWN active membership in this room. A non-member or already-left caller is
  -- FORBIDDEN — we never leak room existence (parity with submit_swipe's member check, 0016).
  select id into v_member_id
  from room_members
  where room_id = p_room_id
    and user_id = v_uid
    and left_at is null;
  if v_member_id is null then
    raise exception 'FORBIDDEN';
  end if;

  v_room_ended := remove_member(v_member_id);

  select left_at into v_left_at from room_members where id = v_member_id;

  return jsonb_build_object(
    'member', jsonb_build_object('id', v_member_id, 'left_at', v_left_at),
    'room_ended', v_room_ended
  );
end;
$$;

-- prune_absent_members: disconnect auto-removal sweeper ----------------------------------------
-- Removes every active member whose authoritative liveness is stale: COALESCE(last_seen_at,
-- joined_at) older than the absence grace. A member with the app/tab merely backgrounded keeps
-- heartbeating (Away is still in the cohort); only a real disconnect lets the heartbeat age out.
-- Applies the SAME remove_member path as an explicit leave, so a stale host closes the room and a
-- stale last member cancels the session. Returns the count removed. INTERNAL — driven by pg_cron
-- (below); never granted to clients.
create function public.prune_absent_members()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- KEEP IN SYNC with @munch/core MEMBER_ABSENCE_GRACE_S (packages/core/src/constants.ts). SQL
  -- can't import the package, so the grace is duplicated here — change both together (same
  -- pattern as the radius bounds duplicated in start-session, and 0017's keep-in-sync note).
  c_grace_seconds constant integer := 45;
  v_member_id     uuid;
  v_removed       integer := 0;
begin
  for v_member_id in
    select rm.id
    from room_members rm
    left join member_heartbeats hb on hb.member_id = rm.id
    where rm.left_at is null
      and coalesce(hb.last_seen_at, rm.joined_at)
            < now() - (c_grace_seconds || ' seconds')::interval
  loop
    perform remove_member(v_member_id);
    v_removed := v_removed + 1;
  end loop;

  return v_removed;
end;
$$;

-- Schedule the sweeper on pg_cron every SWEEP_INTERVAL_S seconds -------------------------------
-- KEEP IN SYNC with @munch/core SWEEP_INTERVAL_S (15s). cron.schedule upserts by job name, so a
-- re-run is safe; the sub-minute 'N seconds' form needs pg_cron >= 1.5 (Supabase ships a new
-- enough build). Wrapped in a tolerant block so a dev environment WITHOUT pg_cron doesn't break
-- `supabase db reset`: the function still exists and the documented fallback (docs/04) is a
-- scheduled Edge Function calling prune_absent_members() on the same cadence.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'prune-absent-members',
    '15 seconds',
    'select public.prune_absent_members();'
  );
exception
  when others then
    raise notice
      'pg_cron scheduling skipped (%): run prune_absent_members() via a scheduled Edge Function',
      sqlerrm;
end;
$$;

-- Execute grants -------------------------------------------------------------------------------
-- leave_room is the only client-facing addition. remove_member / recheck / prune are INTERNAL —
-- they carry NO auth check (the caller authorizes), so a client must never reach them directly:
-- remove_member would let any caller evict any member, prune would let any caller sweep the room.
--
-- Supabase's default privileges auto-grant EXECUTE on new public functions to anon + authenticated
-- (the client JWT roles), so `revoke ... from public` alone is NOT enough — those role grants must
-- be revoked explicitly. The internal calls still work: leave_room/prune are security definer owned
-- by postgres, so their nested calls run as the owner (which always has execute), and pg_cron runs
-- prune as postgres too. service_role is left intact: it is the trusted server key (it bypasses RLS
-- regardless) and the deterministic auto-removal test drives prune_absent_members through it.
revoke execute on function public.leave_room(uuid) from public;
grant  execute on function public.leave_room(uuid) to authenticated;

revoke execute on function public.recheck_unanimous_on_membership_change(uuid)
  from public, anon, authenticated;
revoke execute on function public.remove_member(uuid) from public, anon, authenticated;
revoke execute on function public.prune_absent_members() from public, anon, authenticated;
