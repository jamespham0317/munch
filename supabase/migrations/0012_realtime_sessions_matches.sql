-- 0012_realtime_sessions_matches.sql
-- Phase 2, Prompt 2 (part 4/4): enable Supabase Realtime on `sessions` and `matches` so the
-- session channel (docs/04 §4) can deliver status transitions and the match announcement
-- to all co-members (docs/02 §5). The api-client's subscribeSession (Prompt 4) listens on
-- both via postgres_changes filtered to the session id.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit this file, add another.
--
-- RLS still applies to Realtime postgres_changes: subscribers only receive row changes they
-- could read under their own policies. sessions_select_member and matches_select_member
-- (0003) already scope reads to rooms the caller belongs to, so a subscriber sees only
-- transitions/matches for sessions in rooms they're a member of.
--
-- DELIBERATELY NOT PUBLISHED:
--   * `swipes` — raw per-member decisions are never exposed (CLAUDE.md §3). The session UI
--     never shows another member's individual swipes; only the (server-authoritative) match
--     event matters, and aggregate progress (if surfaced later) reads via non-realtime
--     queries. Adding swipes to the publication would leak private state through RLS-scoped
--     deliveries.
--   * `cached_decks` — the deck is static for a session in Phase 2 (per-session caching,
--     CLAUDE.md §2.1). The widen flow that appends rows lands in Phase 3 and is the only
--     reason to ever stream deck changes; do not pre-publish it here.

alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table matches;
