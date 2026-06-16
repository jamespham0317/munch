-- 0021_realtime_rooms.sql
-- Editable lobby location map: enable Supabase Realtime on `rooms` so a host's
-- in-lobby anchor/filter edits (update_room_filters, 0005) push to every member's lobby
-- instantly (docs/04 §4, docs/10 §3.5). Before this, `rooms` was unpublished: the lobby read
-- the room row once and only the editing host re-read it on save, so non-hosts saw stale
-- settings until a refetch. The api-client's subscribeRoomSettings listens here via
-- postgres_changes filtered to the room id and invalidates the ["room", id] query.
--
-- RLS still applies to Realtime postgres_changes: subscribers only receive row changes they
-- could read under their own policies. rooms_select_member (0003) already scopes reads to
-- rooms the caller belongs to, so a subscriber sees only changes for rooms they're in. The
-- published columns (anchor_lat/anchor_lng/filters/default_radius_m) are already
-- member-readable settings — nothing sensitive is exposed, and the provider/service-role keys
-- are never involved (CLAUDE.md §3). Default replica identity (PK) suffices: clients only
-- invalidate + refetch the room, never read the changed columns off the payload.

alter publication supabase_realtime add table rooms;
