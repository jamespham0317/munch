-- 0006_realtime_room_members.sql
-- Enable Supabase Realtime on room_members so lobby presence (join/leave/is_present) fans out
-- to co-members live (docs/02-system-architecture.md §5, docs/04 §4 `room:{room_id}` presence).
-- Migrations are immutable once applied (CLAUDE.md §6): never edit this file, add another.
--
-- RLS still applies to Realtime postgres_changes: a client only receives row changes it could
-- read under its own policies. room_members_select_same_room (0003) already scopes reads to
-- co-members of the same room, so a subscriber sees only members of rooms it belongs to and
-- never any other room's membership. No individual swipe data is ever published (none exists
-- in Phase 1, and swipes are not added to this publication).
--
-- Phase-1 presence/leave are soft UPDATEs (is_present=false, left_at=now()) whose NEW row
-- carries room_id, so subscribers can filter on room_id without REPLICA IDENTITY FULL. If a
-- future phase needs to filter DELETE events by room_id, revisit replica identity then.

alter publication supabase_realtime add table room_members;
