-- 0014_deck_exhaustion.sql
-- Phase 3, Prompt 2 (part 1/2): the deck-exhaustion terminal path. Adds is_deck_exhausted
-- (the lightweight "everyone has seen everything" check) and replaces submit_swipe (0010)
-- via `create or replace` to flip an exhausted session `active → awaiting_host_resolution`
-- (docs/02 §6 state machine, docs/04 §3.7). NO provider work and NO accept/widen here —
-- those live in the resolve-session Edge Function (Phase 3, Prompt 3).
-- Migrations are immutable once applied (CLAUDE.md §6): never edit 0010, replace in place here.
--
-- SERVER-AUTHORITATIVE (CLAUDE.md §2.3): exhaustion is decided server-side against the LIVE
--   present-member cohort (room_members.is_present = true), exactly like check_unanimous_match
--   — an away member's unswiped cards do not block exhaustion; a present member with an
--   unswiped card keeps the session `active`.
--
-- TRACKED LIMITATION (pinned Phase-3 decision): detection lives only on submit_swipe, which is
--   sufficient for the exit criterion. The rarer "last active swiper leaves while the others
--   are already exhausted" path is NOT handled this phase — it cannot strand the room (the host
--   can always leave → `cancelled`).

-- is_deck_exhausted: has every present member seen every card? -------------------
-- True iff there is at least one present member AND no (present_member × cached_deck_card)
-- pair lacks a `swipes` row (any decision counts — a card is "seen" once swiped). Mirrors the
-- present_members CTE of check_unanimous_match (0010); security definer so it reads all
-- members' swipes, broader than swipes_select_own (docs/03 §3.7). No internal auth check: the
-- only caller, submit_swipe, has already authenticated and verified room membership.
create function public.is_deck_exhausted(p_session_id uuid)
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
  deck as (
    select restaurant_id
    from cached_decks
    where session_id = p_session_id
  )
  select exists (select 1 from present_members)
     and not exists (
       select 1
       from present_members pm
       cross join deck d
       where not exists (
         select 1 from swipes sw
         where sw.session_id    = p_session_id
           and sw.member_id     = pm.id
           and sw.restaurant_id = d.restaurant_id
       )
     );
$$;

-- submit_swipe: 0010 body + the exhaustion tail (docs/04 §3.7) -----------------
-- Replaces 0010 verbatim EXCEPT for the no-match path: the two former no-match returns (a
-- pass, and a like that wasn't unanimous) now converge on a single tail that runs
-- is_deck_exhausted before returning, so the exhaustion check is evaluated exactly once and is
-- never duplicated. Every guard, error code, and the idempotent-insert/no-overwrite semantics
-- are preserved verbatim from 0010. The return shape is unchanged ({ recorded, match }); the
-- client learns of the `awaiting_host_resolution` transition via the realtime status event
-- (0012), not the swipe response.
--
-- ORDERING IS LOAD-BEARING: the unanimous match check runs FIRST. A swipe that is
-- simultaneously the last card in the deck AND the last unanimous like ends the session
-- `matched`, never `awaiting_host_resolution` — exhaustion is only considered when there is no
-- match. The `status = 'active'` guard on both updates prevents a racing writer from regressing
-- an already-`matched` session.
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

-- Execute grants: authenticated sessions (incl. anonymous guests) only. Re-pin for every
-- function created/replaced here (submit_swipe is replaced; is_deck_exhausted is new). The
-- 0010 grants on submit_swipe are inherited across `create or replace`, but being explicit
-- avoids drift. is_deck_exhausted is granted for parity with check_unanimous_match, though its
-- only caller is submit_swipe.
revoke execute on function public.is_deck_exhausted(uuid) from public;
grant  execute on function public.is_deck_exhausted(uuid) to authenticated;

revoke execute on function public.submit_swipe(uuid, uuid, swipe_decision) from public;
grant  execute on function public.submit_swipe(uuid, uuid, swipe_decision) to authenticated;
