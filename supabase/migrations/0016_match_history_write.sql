-- 0016_match_history_write.sql
-- Phase 4, Prompt 2: the server-authoritative match_history write — the retention hook for
-- signed-in users (docs/01 §10, docs/03 §3.9). Adds record_match_history (a security-definer
-- writer) and replaces submit_swipe (0014) via `create or replace` so a unanimous match also
-- snapshots one history row per signed-in present member. NO history read here (that is an
-- RLS-scoped read in the api-client, Prompt 4); NO resolve-session change here (that Edge
-- Function gains the host_accepted_top call in Prompt 3).
-- Migrations are immutable once applied (CLAUDE.md §6): never edit 0014, replace in place here.
--
-- GUEST EPHEMERALITY IS LOAD-BEARING (CLAUDE.md §3, docs/01 §10): a history row is written ONLY
--   for a member that HAS a `profiles` row. The signed-in test is the PRESENCE OF A profiles row,
--   NOT a non-null user_id — guests have a user_id too (an anonymous auth.users id, docs/03 §3.3).
--   Guests appear in participant_names (they were there) but get no row of their own.
--
-- PRESENT-MEMBER-SCOPED (CLAUDE.md §2.3): the participant snapshot and the set of recipients are
--   the CURRENTLY PRESENT members of the session's room — the same cohort the unanimous match
--   check uses (check_unanimous_match / is_deck_exhausted, 0010/0014).

-- record_match_history: snapshot one history row per signed-in present member -----
-- The ONLY writer of match_history. The table has NO insert RLS policy on purpose (docs/03 §3.9)
-- — writes go exclusively through this security-definer function, called from submit_swipe (the
-- unanimous path, below) and the resolve-session Edge Function (the host_accepted_top path,
-- Prompt 3). No internal auth check: both callers have already authenticated and authorized.
-- Idempotent on the existing unique (user_id, match_id) so re-entry / a double-fire writes
-- nothing extra. security definer so it can write a table the caller cannot insert into directly.
create function public.record_match_history(p_session_id uuid)
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

  -- participant_names = every CURRENTLY PRESENT member of the session's room (guests included —
  -- they were there). Same present-member cohort as the match check (CLAUDE.md §2.3).
  select array_agg(rm.display_name order by rm.joined_at)
    into v_participants
  from room_members rm
  join sessions s on s.room_id = rm.room_id
  where s.id = p_session_id
    and rm.is_present = true;

  -- One row per present member that HAS a profiles row (the signed-in test — guests with a
  -- user_id but no profile are EXCLUDED via the inner join). Idempotent on (user_id, match_id).
  insert into match_history (
    user_id, match_id, restaurant_name, restaurant_photo_url, participant_names, decided_at
  )
  select rm.user_id, v_match_id, v_name, v_photo_url, v_participants, v_decided_at
  from room_members rm
  join sessions s on s.room_id = rm.room_id
  join profiles p on p.id = rm.user_id
  where s.id = p_session_id
    and rm.is_present = true
  on conflict (user_id, match_id) do nothing;
end;
$$;

-- submit_swipe: 0014 body + the record_match_history call on a unanimous match -----
-- Identical to 0014 EXCEPT one added line in the unanimous branch: after writing `matches` and
-- flipping the session to `matched`, `perform record_match_history(p_session_id)` so signed-in
-- present members get a history row. Calling it unconditionally in this branch is safe even when
-- the status='active'-guarded update touches 0 rows under a race — the `matches` row still
-- exists and the insert is idempotent. Every other guard, error code, the exhaustion tail, and
-- the idempotent no-overwrite insert are copied verbatim; the return shape is unchanged.
create or replace function public.submit_swipe(
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

  -- A pass can never declare a match; skip the (read-heavy) unanimous check for it.
  if p_decision <> 'like' then
    v_unanimous := false;
  else
    v_unanimous := check_unanimous_match(p_session_id, p_restaurant_id);
  end if;

  -- No match (a pass, or a like that wasn't unanimous): record-only. Before returning, run
  -- the lightweight exhaustion check; if every present member has now seen every card, flip
  -- the session to awaiting_host_resolution (non-terminal: no ended_at). The status='active'
  -- guard keeps this from racing past a match another writer just declared.
  if not v_unanimous then
    if is_deck_exhausted(p_session_id) then
      update sessions
         set status = 'awaiting_host_resolution'
       where id = p_session_id
         and status = 'active';
    end if;
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

  -- Retention hook: snapshot a match_history row for each signed-in present member
  -- (guests get none — CLAUDE.md §3). Idempotent, so a retried unanimous call writes nothing
  -- extra. Single source of the signed-in-only + snapshot logic (record_match_history above).
  perform record_match_history(p_session_id);

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

-- Execute grants. record_match_history is called internally (by submit_swipe's definer path and,
-- in Prompt 3, by resolve-session via the service-role client) — granted to authenticated for the
-- service-role rpc path; it is not a client-facing endpoint. submit_swipe is replaced via
-- `create or replace` (grants inherit), but re-pinned explicitly to avoid drift (parity with 0014).
revoke execute on function public.record_match_history(uuid) from public;
grant  execute on function public.record_match_history(uuid) to authenticated;

revoke execute on function public.submit_swipe(uuid, uuid, swipe_decision) from public;
grant  execute on function public.submit_swipe(uuid, uuid, swipe_decision) to authenticated;
