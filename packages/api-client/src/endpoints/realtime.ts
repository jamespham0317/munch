import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { notImplemented } from "../errors";

/**
 * Realtime channel helpers (docs/04 §4). Clients subscribe to per-room/session
 * channels for live state; authoritative reads still come from RPC/table reads
 * under RLS. Only aggregate progress is ever exposed — never another member's
 * individual swipes (CLAUDE.md §3). Stubs only in Phase 0.
 */

/** Subscribe to a room channel: member join/leave/presence (`room:{room_id}`). */
export function subscribeRoom(
  _client: SupabaseClient,
  _roomId: string,
): RealtimeChannel {
  return notImplemented("room realtime subscription", "Phase 2");
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
