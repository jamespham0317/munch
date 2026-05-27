-- 0005_room_rpcs.sql
-- Server-authoritative membership RPCs for Phase 1: create_room, join_room,
-- update_room_filters (docs/04-api-specification.md §3.1–§3.3). These are the privileged
-- writes that cross an RLS boundary, so they are `security definer` (rooms/room_members have
-- no insert policy on purpose — doc 03 §3.2/§3.3, phase-1-prompts.md). They reuse the
-- membership helpers from 0003 (auth_is_room_host); they do NOT touch match/ranking logic.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit this file, add another.
--
-- ERROR CONVENTION (relied on by the api-client in Prompt 3 — keep it exact):
--   Every failure is `raise exception` whose MESSAGE is EXACTLY one of the doc-04 error
--   codes — UNAUTHENTICATED, ROOM_NOT_FOUND, ROOM_CLOSED, NOT_HOST, ALREADY_JOINED,
--   RATE_LIMITED, SESSION_INVALID_STATE, VALIDATION_ERROR. The api-client maps the message
--   onto an ErrorCode and never surfaces raw DB text (docs/06 §9). Do not add prose to these
--   messages and do not leak provider/DB internals through them.
--
-- RATE LIMITING (doc-04 §6): per-identity, computed from existing tables (no new table).
--   create_room counts the caller's recently-created rooms (rooms.host_member_id →
--   room_members.user_id); join_room counts the caller's recent member joins
--   (room_members.user_id, role 'member'). Thresholds are conservative defaults, tunable
--   via the constants below. IP-based limiting belongs at the edge/gateway and is DEFERRED
--   (Supabase already rate-limits anonymous sign-ins per IP — config.toml [auth.rate_limit]).
--
-- All RPCs return jsonb shaped EXACTLY like the doc-04 response so the api-client maps
-- snake_case → camelCase 1:1 at its boundary (docs/06 §5).

-- 3.1 create_room ------------------------------------------------------------
-- Creates the room + the host's member row and links rooms.host_member_id. The host_member_id
-- FK is nullable (0002) precisely to allow this two-step insert inside one transaction.
create function public.create_room(
  p_host_display_name   text,
  p_anchor_label        text,
  p_anchor_lat          double precision,
  p_anchor_lng          double precision,
  p_filter_open_now     boolean       default true,
  p_filter_cuisines     text[]        default '{}',
  p_filter_price_levels price_level[] default '{}',
  p_default_radius_m    integer       default 3000
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Per-identity create limit: at most this many rooms created per rolling window.
  c_max_creates    constant integer  := 10;
  c_window         constant interval := interval '1 hour';
  c_code_attempts  constant integer  := 10;  -- retries before giving up on a unique code
  v_uid            uuid := (select auth.uid());
  v_recent         integer;
  v_room_id        uuid;
  v_member_id      uuid;
  v_code           text;
  v_attempts       integer := 0;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- Rate limit: count rooms this identity created within the window.
  select count(*) into v_recent
  from rooms r
  join room_members m on m.id = r.host_member_id
  where m.user_id = v_uid
    and r.created_at > now() - c_window;
  if v_recent >= c_max_creates then
    raise exception 'RATE_LIMITED';
  end if;

  -- Generate a unique 6-digit code (000000–999999, leading zeros allowed). Retry on the
  -- rooms.code unique violation; bail with VALIDATION_ERROR if we somehow can't allocate one.
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    begin
      insert into rooms (
        code, anchor_label, anchor_lat, anchor_lng,
        filter_open_now, filter_cuisines, filter_price_levels, default_radius_m
      )
      values (
        v_code, p_anchor_label, p_anchor_lat, p_anchor_lng,
        coalesce(p_filter_open_now, true),
        coalesce(p_filter_cuisines, '{}'),
        coalesce(p_filter_price_levels, '{}'),
        coalesce(p_default_radius_m, 3000)
      )
      returning id into v_room_id;
      exit;  -- inserted successfully
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= c_code_attempts then
        raise exception 'VALIDATION_ERROR';
      end if;
    end;
  end loop;

  -- Host member row (role 'host'); user_id is the caller's (anonymous or permanent) auth id.
  insert into room_members (room_id, user_id, display_name, role)
  values (v_room_id, v_uid, p_host_display_name, 'host')
  returning id into v_member_id;

  update rooms set host_member_id = v_member_id, updated_at = now()
  where id = v_room_id;

  return jsonb_build_object(
    'room', jsonb_build_object('id', v_room_id, 'code', v_code),
    'member', jsonb_build_object(
      'id', v_member_id, 'role', 'host', 'display_name', p_host_display_name
    )
  );
end;
$$;

-- 3.2 join_room --------------------------------------------------------------
-- Joins by code. Security definer because the caller is NOT yet a member, so the code
-- lookup must bypass rooms_select_member (0003) which would block a non-member read.
create function public.join_room(
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
            'role', rm.role,
            'is_present', rm.is_present
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

-- 3.3 update_room_filters (host only) ----------------------------------------
-- p_room_id is explicit (not in the doc-04 request body): a host may host more than one
-- room, so the api-client supplies the target room id. Only non-null params mutate their
-- column (null = "field not provided"); this means you cannot clear an array to '{}' via this
-- RPC — acceptable for Phase 1's lobby editing.
create function public.update_room_filters(
  p_room_id             uuid,
  p_anchor_label        text          default null,
  p_anchor_lat          double precision default null,
  p_anchor_lng          double precision default null,
  p_filter_open_now     boolean       default null,
  p_filter_cuisines     text[]        default null,
  p_filter_price_levels price_level[] default null,
  p_default_radius_m    integer       default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room rooms%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- Host check (auth_is_room_host bypasses RLS; also false for non-existent rooms, so we
  -- don't leak room existence to non-hosts).
  if not auth_is_room_host(p_room_id) then
    raise exception 'NOT_HOST';
  end if;

  -- Forward-compatible guard: filters are editable only while in lobby. No sessions exist
  -- until Phase 2, so this never fires yet — implemented, not skipped (phase-1-prompts.md).
  if exists (
    select 1 from sessions s
    where s.room_id = p_room_id and s.status <> 'lobby'
  ) then
    raise exception 'SESSION_INVALID_STATE';
  end if;

  update rooms set
    anchor_label        = coalesce(p_anchor_label, anchor_label),
    anchor_lat          = coalesce(p_anchor_lat, anchor_lat),
    anchor_lng          = coalesce(p_anchor_lng, anchor_lng),
    filter_open_now     = coalesce(p_filter_open_now, filter_open_now),
    filter_cuisines     = coalesce(p_filter_cuisines, filter_cuisines),
    filter_price_levels = coalesce(p_filter_price_levels, filter_price_levels),
    default_radius_m    = coalesce(p_default_radius_m, default_radius_m),
    updated_at          = now()
  where id = p_room_id
  returning * into v_room;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id,
      'anchor_label', v_room.anchor_label,
      'anchor_lat', v_room.anchor_lat,
      'anchor_lng', v_room.anchor_lng,
      'filters', jsonb_build_object(
        'open_now', v_room.filter_open_now,
        'cuisines', to_jsonb(v_room.filter_cuisines),
        'price_levels', to_jsonb(v_room.filter_price_levels)
      ),
      'default_radius_m', v_room.default_radius_m
    )
  );
end;
$$;

-- Execute grants: only authenticated sessions (which include anonymous guests) may call.
-- Revoking from PUBLIC stops the `anon` role (truly unauthenticated requests) from executing;
-- the in-body auth.uid() null check is belt-and-suspenders.
revoke execute on function public.create_room(
  text, text, double precision, double precision, boolean, text[], price_level[], integer
) from public;
grant execute on function public.create_room(
  text, text, double precision, double precision, boolean, text[], price_level[], integer
) to authenticated;

revoke execute on function public.join_room(text, text) from public;
grant execute on function public.join_room(text, text) to authenticated;

revoke execute on function public.update_room_filters(
  uuid, text, double precision, double precision, boolean, text[], price_level[], integer
) from public;
grant execute on function public.update_room_filters(
  uuid, text, double precision, double precision, boolean, text[], price_level[], integer
) to authenticated;
