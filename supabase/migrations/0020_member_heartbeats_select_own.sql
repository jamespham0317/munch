-- 0020_member_heartbeats_select_own.sql
-- Phase 4.7, Prompt 4: corrective RLS fix for member_heartbeats (added in 0017). Adds a
-- self-scoped SELECT policy so the api-client's liveness UPSERT actually passes RLS.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit 0017, add this instead.
--
-- WHY (the 0017 gap): 0017 added INSERT + UPDATE policies and noted that "the api-client's
-- upsert (insert ... on conflict do update) passes RLS. No SELECT policy". That is incorrect:
-- PostgreSQL's `INSERT ... ON CONFLICT DO UPDATE` must read the conflict target row, so without
-- a SELECT policy the statement is rejected with a WITH CHECK violation (42501) — even on the
-- first write where no row exists yet. (A plain INSERT works; the recurring 10s heartbeat needs
-- update-on-conflict, hence the upsert.) Verified directly against local Supabase: adding this
-- policy makes the exact upsert succeed.
--
-- PRIVACY: the policy is scoped to the caller's OWN member row via auth_owns_member (0003), so a
-- client can read ONLY its own { member_id, last_seen_at } — nothing about any other member. The
-- table is still NOT in the realtime publication and the sweeper (prune_absent_members, 0018)
-- still reads it via security definer; this only lets the upsert's conflict read see the caller's
-- own row. No other member's liveness is ever exposed (CLAUDE.md §3).

create policy member_heartbeats_select_own on member_heartbeats
  for select to authenticated
  using (auth_owns_member(member_id));
