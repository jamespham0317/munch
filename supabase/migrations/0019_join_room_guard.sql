-- 0019_join_room_guard.sql
-- Phase 4.7, Prompt 3: freeze the roster at session start and make lobby re-join reactivate the
-- SAME member row cleanly. Replaces join_room (last set in 0017) via create-or-replace.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit 0017, replace in place here.
--
-- TWO CHANGES vs 0017, everything else verbatim:
--   1. ROOM_IN_SESSION guard: once ANY session row exists for the room, the session has started
--      (start-session inserts the row at start time — there is none in the lobby), so the cohort
--      can only shrink. Joining — NEW or RETURNING — is rejected (roadmap §6.7, docs/04 §3.2).
--   2. Lobby re-join reactivation: a member who left in the lobby (left_at set, no session yet)
--      has a row blocked by the partial unique index (room_id, user_id). Instead of tripping
--      ALREADY_JOINED, reactivate that row (left_at = null, fresh joined_at, updated name) and
--      drop any stale heartbeat so the sweeper (0018) doesn't immediately re-prune them. A still-
--      active prior row is a genuine double-join -> ALREADY_JOINED.

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
  v_left_at   timestamptz;
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

  -- Roster freezes at session start: any session row means swiping has begun. No join mid-session
  -- (new OR returning) — the cohort can only shrink once a session exists. Lobby joins (no session
  -- yet) fall through unaffected.
  if exists (select 1 from sessions where room_id = v_room.id) then
    raise exception 'ROOM_IN_SESSION';
  end if;

  -- A user joins a room once (partial unique index on (room_id, user_id) where user_id not null).
  -- Resolve any prior row for this identity:
  --   * still active (left_at is null) -> genuine double-join -> ALREADY_JOINED.
  --   * previously left -> reactivate THE SAME row (lobby re-join): clear left_at, refresh
  --     joined_at, update the display name, and drop any stale heartbeat so the 0018 sweeper
  --     doesn't immediately re-prune the returning member.
  select id, left_at into v_member_id, v_left_at
  from room_members
  where room_id = v_room.id and user_id = v_uid;

  if v_member_id is not null then
    if v_left_at is null then
      raise exception 'ALREADY_JOINED';
    end if;
    update room_members
       set left_at      = null,
           joined_at    = now(),
           display_name = p_display_name,
           role         = 'member'
     where id = v_member_id;
    delete from member_heartbeats where member_id = v_member_id;
  else
    insert into room_members (room_id, user_id, display_name, role)
    values (v_room.id, v_uid, p_display_name, 'member')
    returning id into v_member_id;
  end if;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id, 'code', v_room.code
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
        and rm.left_at is null   -- live roster only; left members are not in the cohort
    )
  );
end;
$$;

-- Re-pin the execute grant (inherited across create-or-replace, explicit to avoid drift).
revoke execute on function public.join_room(text, text) from public;
grant  execute on function public.join_room(text, text) to authenticated;
