-- 0011_cancel_active_session.sql
-- Phase 2, Prompt 2 (part 3/4): the host-leave session-cancel half of the resolved
-- host-leave policy (CLAUDE.md §2 invariant 3; docs/04 §3.10). Phase 1's api-client
-- (leaveRoom + endRoom) already soft-closes the room; this RPC is what Phase 2's update
-- to those endpoints will call next to also cancel any non-terminal session for the room.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit this file, add another.
--
-- `sessions` intentionally has NO update policy (0003) — status transitions are owned by
-- privileged paths only: start_session (Edge Function, Prompt 3), submit_swipe (0010), and
-- this cancel RPC. resolve_session lands in Phase 3.
--
-- ERROR CONVENTION (same as 0005/0010): every failure is `raise exception` whose MESSAGE is
--   EXACTLY one of the doc-04 codes — UNAUTHENTICATED, NOT_HOST. The api-client maps these
--   to ErrorCodes. NO-RAISE no-op when there is no non-terminal session: host-leave in the
--   lobby (Phase 1 behavior) must continue to succeed even though no session exists yet.

create function public.cancel_active_session(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- Host check via the 0003 helper (also false for non-existent rooms, so we don't leak
  -- room existence to non-hosts).
  if not auth_is_room_host(p_room_id) then
    raise exception 'NOT_HOST';
  end if;

  -- Flip any non-terminal session for the room. Terminal statuses (matched, resolved,
  -- cancelled) are intentionally excluded so a re-call after the fact is a no-op.
  -- A room only ever has one non-terminal session at a time (start_session enforces this
  -- in Prompt 3), but writing it as a set update is robust either way and `returning id`
  -- captures the (at most one) cancelled session for the response.
  update sessions
     set status   = 'cancelled',
         ended_at = now()
   where room_id = p_room_id
     and status in ('lobby', 'active', 'awaiting_host_resolution')
  returning id into v_session_id;

  return jsonb_build_object('cancelled_session_id', v_session_id);
end;
$$;

-- Execute grants: authenticated sessions (incl. anonymous guests) only.
revoke execute on function public.cancel_active_session(uuid) from public;
grant  execute on function public.cancel_active_session(uuid) to authenticated;
