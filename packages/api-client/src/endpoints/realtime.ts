import type {
  DeckRestaurant,
  MatchResolution,
  SessionMatchEvent,
  SessionStatus,
  SessionStatusChange,
} from "@munch/core";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  SupabaseClient,
} from "@supabase/supabase-js";

import { getDeck } from "./sessions";

/**
 * Realtime channel helpers (docs/04 §4). Clients subscribe to per-room/session channels for
 * live state; authoritative reads still come from RPC/table reads under RLS. Realtime respects
 * RLS, so only aggregate/co-member data is ever delivered — never another member's individual
 * swipes (CLAUDE.md §3; the `swipes` table is deliberately NOT in the supabase_realtime
 * publication, see 0012).
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

/** A row-change event on `sessions` delivered to a `subscribeRoomSessions` callback. */
export type RoomSessionChange = RealtimePostgresChangesPayload<{
  id: string;
  room_id: string;
  status: SessionStatus;
}>;

/**
 * Subscribe to a room's session lifecycle on `room-sessions:{room_id}`. Fires `onChange` on
 * insert/update of a `sessions` row for this room so the lobby can detect the host starting a
 * session (a new row, or `lobby → active`) and route members into the swipe screen. RLS
 * (sessions_select_member from 0003) scopes deliveries to rooms the caller belongs to; 0012
 * added `sessions` to the supabase_realtime publication. Returns the channel; the caller
 * tears down via `client.removeChannel(channel)` — same pattern as subscribeRoom.
 */
export function subscribeRoomSessions(
  client: SupabaseClient,
  roomId: string,
  onChange: (payload: RoomSessionChange) => void,
): RealtimeChannel {
  return client
    .channel(`room-sessions:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "sessions",
        filter: `room_id=eq.${roomId}`,
      },
      onChange,
    )
    .subscribe();
}

/**
 * Typed union of events delivered on the session channel: a `sessions` row status transition
 * or a new `matches` row. The match-event payload mirrors @munch/core's SessionMatchEvent
 * shape — restaurant fields are fetched (RLS-scoped via getDeck) on receipt because the
 * matches row alone only carries restaurant_id.
 */
export type SessionEvent =
  | { kind: "status"; payload: SessionStatusChange }
  | { kind: "match"; payload: SessionMatchEvent };

/** Subset of the `sessions` row delivered by postgres_changes (only fields we read). */
interface SessionRowDelta {
  id: string;
  status: SessionStatus;
}

/** Subset of the `matches` row delivered by postgres_changes. */
interface MatchRow {
  session_id: string;
  restaurant_id: string;
  resolution: MatchResolution;
}

/**
 * Subscribe to a session's authoritative state changes (`session:{session_id}`):
 *   * `sessions` row updates → SessionStatusChange (status only; other column updates
 *     like `matched_restaurant_id` or `ended_at` are de-duped by comparing payload.old).
 *   * `matches` row insert → SessionMatchEvent. The matches row carries restaurant_id +
 *     resolution; we fetch the full DeckRestaurant via getDeck (RLS-scoped) so the
 *     subscriber's UI lands on the same card shape regardless of entry point (the swiper
 *     gets the match in submit_swipe's response; co-members get it via this channel).
 *
 * 0012 added `sessions` and `matches` to the supabase_realtime publication, scoped by their
 * 0003 RLS policies. Returns the channel; the caller tears down via
 * `client.removeChannel(channel)` — same pattern as subscribeRoom.
 */
export function subscribeSession(
  client: SupabaseClient,
  sessionId: string,
  onEvent: (event: SessionEvent) => void,
): RealtimeChannel {
  return client
    .channel(`session:${sessionId}`)
    .on<SessionRowDelta>(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload: RealtimePostgresUpdatePayload<SessionRowDelta>) => {
        const next = payload.new.status;
        const prev = payload.old.status;
        // De-dupe: an update that didn't change the status (e.g. matched_restaurant_id
        // alone) doesn't warrant a notification — the UI's only interest is the status.
        if (prev !== undefined && prev === next) return;
        onEvent({
          kind: "status",
          payload: { session_id: payload.new.id, status: next },
        });
      },
    )
    .on<MatchRow>(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "matches",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload: RealtimePostgresInsertPayload<MatchRow>) => {
        void emitMatch(client, sessionId, payload.new, onEvent);
      },
    )
    .subscribe();
}

/**
 * Resolve the full DeckRestaurant for an incoming matches row and emit the typed event.
 * Failures are logged and swallowed: the swiper themselves still has the match from
 * submit_swipe's response, and on a transient read failure the result screen falls back
 * to its own re-read. Surfacing a raw error through the realtime callback would violate
 * the "no raw provider/DB text" rule (docs/06 §9).
 */
async function emitMatch(
  client: SupabaseClient,
  sessionId: string,
  row: MatchRow,
  onEvent: (event: SessionEvent) => void,
): Promise<void> {
  const deck = await getDeck(client, { session_id: sessionId });
  if (deck.error) {
    console.error("[api-client] subscribeSession deck lookup failed for match");
    return;
  }
  const restaurant: DeckRestaurant | undefined = deck.data.restaurants.find(
    (r) => r.id === row.restaurant_id,
  );
  if (!restaurant) {
    console.error("[api-client] subscribeSession match restaurant not in deck");
    return;
  }
  onEvent({
    kind: "match",
    payload: {
      session_id: row.session_id,
      match: {
        restaurant_id: row.restaurant_id,
        restaurant_name: restaurant.name,
        resolution: row.resolution,
      },
      restaurant,
    },
  });
}
