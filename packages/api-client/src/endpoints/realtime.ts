import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";

import { notImplemented } from "../errors";

/**
 * Realtime channel helpers (docs/04 §4). Clients subscribe to per-room/session channels for
 * live state; authoritative reads still come from RPC/table reads under RLS. Realtime respects
 * RLS, so only aggregate/co-member data is ever delivered — never another member's individual
 * swipes (CLAUDE.md §3; none exist in Phase 1).
 */

/** A row-change event on `room_members` delivered to a `subscribeRoom` callback. */
export type RoomMemberChange = RealtimePostgresChangesPayload<{
  id: string;
  room_id: string;
  display_name: string;
  role: string;
  is_present: boolean;
}>;

/**
 * Subscribe to a room's presence changes (`room:{room_id}`). Fires `onChange` on any
 * insert/update/delete of a `room_members` row for this room so the lobby can refresh its
 * member list. room_members_select_same_room (0003) means a subscriber only receives changes
 * for rooms it belongs to. Returns the channel; the caller unsubscribes via
 * `client.removeChannel(channel)` on teardown.
 */
export function subscribeRoom(
  client: SupabaseClient,
  roomId: string,
  onChange: (payload: RoomMemberChange) => void,
): RealtimeChannel {
  return client
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "room_members",
        filter: `room_id=eq.${roomId}`,
      },
      onChange,
    )
    .subscribe();
}

/**
 * Subscribe to a session channel: status transitions, aggregate swipe progress,
 * and the match event (`session:{session_id}`).
 */
export function subscribeSession(
  _client: SupabaseClient,
  _sessionId: string,
): RealtimeChannel {
  return notImplemented("session realtime subscription", "Phase 2");
}
