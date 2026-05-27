-- 0007_drop_phase0_smoke.sql
-- Tear down the Phase-0 connectivity-smoke read path on `restaurants` (set up in 0003 + the
-- seed row). Phase 1 no longer reads restaurants from the client; per-session, deck-scoped
-- reads arrive in Phase 2 (docs/04 §3.5/§3.6). CLAUDE.md §3: restaurants are not a permanent
-- local mirror, and no table ships without RLS.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit this file, add another.
--
-- After this migration `restaurants` keeps RLS enabled with NO select policy, so it is
-- unreadable by clients until Phase 2 adds a deck-membership-scoped policy. The seed fixture
-- row is removed alongside this (seed/seed.sql cleared to a comment).

-- Drop the permissive smoke select policy added in 0003.
drop policy restaurants_select_phase0_smoke on restaurants;

-- Revoke the anon select grant added in 0003. The authenticated grant stays but is inert
-- without a select policy; Phase 2's deck-scoped policy will make use of it.
revoke select on restaurants from anon;
