-- 0010_submit_swipe.sql
-- Phase 2, Prompt 2 (part 2/4): the server-authoritative swipe path. Replaces the
-- check_unanimous_match stub from 0004 with the real check (docs/03 §5), and adds the
-- submit_swipe RPC (docs/04 §3.7) that idempotently records a swipe and, on a `like`,
-- transactionally evaluates the unanimous check, writes `matches`, and flips the session
-- to `matched` — all in one function call so the entire path is atomic per swipe.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit this file, add another.
--
-- ERROR CONVENTION (same as 0005): every failure is `raise exception` whose MESSAGE is
--   EXACTLY one of the doc-04 codes — UNAUTHENTICATED, FORBIDDEN, SESSION_INVALID_STATE,
--   VALIDATION_ERROR. The api-client maps the message onto an ErrorCode and never surfaces
--   raw DB text (docs/06 §9). Do not add prose to these messages.
--
-- RATE LIMITING (doc 04 §6): the (session_id, member_id, restaurant_id) unique index on
--   `swipes` (0002) is the primary abuse guard for the swipe path — submit_swipe is cheap
--   and never calls the provider (CLAUDE.md §2.1). A real per-identity rate limit lands at
--   the edge if scripted abuse appears; no new table here.

-- check_unanimous_match: authoritative unanimous-like check (docs/03 §5) ---------
-- Real implementation replaces the 0004 stub. Pure SQL translation of the doc query:
--   present_members = rows in the session's room with is_present = true
--   likers          = (member_id) tuples for like-swipes on (session, restaurant)
--   unanimous       iff |present| > 0 AND |present| = |likers ∩ present|
-- Security definer: reads `swipes` across all members, broader than swipes_select_own.
-- "Currently PRESENT members" semantics — re-evaluated against the live cohort on every
-- call, so a member toggling is_present mid-session changes the answer (CLAUDE.md §2.3,
-- docs/02 §5). No auth check inside: the only caller, submit_swipe, has already authn'd.
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
  with present_members as (
    select rm.id
    from room_members rm
    join sessions s on s.room_id = rm.room_id
    where s.id = p_session_id
      and rm.is_present = true
  ),
  likers as (
    select member_id
    from swipes
    where session_id = p_session_id
      and restaurant_id = p_restaurant_id
      and decision = 'like'
  )
  select (select count(*) from present_members) > 0
     and (select count(*) from present_members)
       = (select count(*) from likers
          where member_id in (select id from present_members));
$$;

-- submit_swipe: the hot path (docs/04 §3.7) ------------------------------------
-- Single-transaction body: authn → member lookup → state guards → idempotent insert →
-- (on like) authoritative match check → on match, write matches + flip session — all
-- under one implicit BEGIN/COMMIT. Idempotency keys: swipes is (session,member,restaurant)
-- unique (0002) so a retried call is a no-op; matches.session_id is unique (0002) so a
-- near-simultaneous tie still produces at most one match row; the sessions update guards
-- on `status = 'active'` so a second writer cannot regress an already-matched session.
create function public.submit_swipe(
  p_session_id    uuid,
  p_restaurant_id uuid,
  p_decision      swipe_decision
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_member_id    uuid;
  v_status       session_status;
  v_unanimous    boolean;
  v_match_name   text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- Caller must be a member of the session's room. Single join, single row expected.
  -- A non-member or a session that doesn't exist both surface as FORBIDDEN — we do not
  -- leak session existence to non-members.
  select rm.id
    into v_member_id
  from sessions s
  join room_members rm on rm.room_id = s.room_id
  where s.id = p_session_id
    and rm.user_id = v_uid;
  if v_member_id is null then
    raise exception 'FORBIDDEN';
  end if;

  -- Session must be `active`. lobby (pre-start), matched/resolved/cancelled (terminal),
  -- and awaiting_host_resolution (Phase 3) all reject — only `active` accepts swipes.
  select status into v_status from sessions where id = p_session_id;
  if v_status is distinct from 'active' then
    raise exception 'SESSION_INVALID_STATE';
  end if;

  -- The swipe must target a card in THIS session's cached deck. Guards against a client
  -- forging a restaurant_id from another session/deck (RLS would still block reads, but
  -- swipes_insert_own would otherwise let the insert through).
  if not exists (
    select 1 from cached_decks
    where session_id = p_session_id
      and restaurant_id = p_restaurant_id
  ) then
    raise exception 'VALIDATION_ERROR';
  end if;

  -- Idempotent insert: existing decision wins (do NOT overwrite). A retried call returns
  -- the same shape as the original (and, on a like that already matched, the match row is
  -- still present so the match payload below still resolves).
  insert into swipes (session_id, member_id, restaurant_id, decision)
  values (p_session_id, v_member_id, p_restaurant_id, p_decision)
  on conflict (session_id, member_id, restaurant_id) do nothing;

  -- A pass can never declare a match; short-circuit.
  if p_decision <> 'like' then
    return jsonb_build_object('recorded', true, 'match', null);
  end if;

  v_unanimous := check_unanimous_match(p_session_id, p_restaurant_id);
  if not v_unanimous then
    return jsonb_build_object('recorded', true, 'match', null);
  end if;

  -- Unanimous: write the match row (idempotent on session_id) and flip the session.
  -- The status='active' guard on the update is the regression-safety belt: if another
  -- transaction won the race and already set 'matched', this update affects 0 rows.
  insert into matches (session_id, restaurant_id, resolution)
  values (p_session_id, p_restaurant_id, 'unanimous')
  on conflict (session_id) do nothing;

  update sessions
     set status                = 'matched',
         matched_restaurant_id = p_restaurant_id,
         ended_at              = now()
   where id = p_session_id
     and status = 'active';

  -- Build the match payload from `matches` (so we surface the AUTHORITATIVE row, not
  -- whatever the caller passed) joined to `restaurants` for the name snapshot.
  select r.name
    into v_match_name
  from matches m
  join restaurants r on r.id = m.restaurant_id
  where m.session_id = p_session_id;

  return jsonb_build_object(
    'recorded', true,
    'match', jsonb_build_object(
      'restaurant_id',   p_restaurant_id,
      'restaurant_name', v_match_name,
      'resolution',      'unanimous'
    )
  );
end;
$$;

-- Execute grants: authenticated sessions (incl. anonymous guests) only.
-- check_unanimous_match is replaced via `create or replace`; re-pin its grants to be safe
-- (the original grants from 0004 are inherited, but being explicit avoids any drift).
revoke execute on function public.check_unanimous_match(uuid, uuid) from public;
grant  execute on function public.check_unanimous_match(uuid, uuid) to authenticated;

revoke execute on function public.submit_swipe(uuid, uuid, swipe_decision) from public;
grant  execute on function public.submit_swipe(uuid, uuid, swipe_decision) to authenticated;
