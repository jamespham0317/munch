-- 0004_functions.sql
-- Home for the security-definer RPCs that back the two highest-risk flows. These are
-- DOCUMENTED STUBS ONLY for Phase 0 — they raise on call so nothing accidentally relies on
-- unimplemented logic. Full, transactional implementations + thorough tests land in
-- Phase 2/3 (CLAUDE.md §2, §7). Do NOT implement match/ranking logic here now.
--
-- (The RLS membership helpers used by 0003 live in 0003 itself, since the policies depend on
--  them at apply time. This file is reserved for the match-check and ranking RPCs.)

-- check_unanimous_match: authoritative server-side unanimous-like check (CLAUDE.md §2.3).
-- Backs submit_swipe (docs/04-api-specification.md §3.7). Runs security definer so it can
-- read all members' swipes (broader scope than the per-member RLS in 0003, doc 03 §3.7).
-- "Every member" = currently PRESENT members; re-evaluate when membership changes.
-- TODO(Phase 2): implement the transactional check per docs/03-database-schema.md §5
--   (present_members vs. likers), with tests for ties, a member leaving mid-session, and
--   deck exhaustion with no match. The client mirror is packages/core matching.ts.
create function public.check_unanimous_match(
  p_session_id uuid,
  p_restaurant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'check_unanimous_match: not implemented until Phase 2';
end;
$$;

-- get_resolution_ranking: closest-to-unanimous ranking for the host resolution prompt
-- (docs/04-api-specification.md §3.8). Return shape mirrors that contract.
-- Ordering is LOAD-BEARING (CLAUDE.md §2.4): rank by how close each restaurant came to a
-- unanimous like, NEVER by raw like count. Tiebreak order:
--   1. fewest passes (pass_count asc)
--   2. highest rating (rating desc)
--   3. nearest distance (distance_m asc)
-- TODO(Phase 3): implement per docs/03-database-schema.md §6, with tests for ties at each
--   level and missing ratings. The client mirror is packages/core ranking.ts.
create function public.get_resolution_ranking(p_session_id uuid)
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
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'get_resolution_ranking: not implemented until Phase 3';
end;
$$;
