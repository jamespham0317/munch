import type {
  DeckRestaurant,
  MatchResolution,
  SessionMatchEvent,
  SessionStatus,
  SessionStatusChange,
} from "@munch/core";
import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
  type RealtimePostgresInsertPayload,
  type RealtimePostgresUpdatePayload,
  type SupabaseClient,
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
  left_at: string | null;
}>;

/**
 * Subscribe to a room's MEMBERSHIP changes (`room:{room_id}`). Fires `onChange` on any
 * insert/update/delete of a `room_members` row for this room so the lobby can refresh its
 * roster — a join, a leave/auto-removal (left_at set), or a role change. This is the
 * AUTHORITATIVE membership layer (the row); cosmetic Here/Away is a separate, ephemeral
 * Realtime Presence layer on the SAME channel (see trackPresence / onPresenceSync below) and
 * is never persisted or read by matchmaking (Phase 4.7; CLAUDE.md §2.3/§3).
 * room_members_select_same_room (0003) means a subscriber only receives changes for rooms it
 * belongs to. Returns the channel; the caller unsubscribes via `client.removeChannel(channel)`
 * on teardown.
 *
 * `onSubscribed` fires once the channel reaches `SUBSCRIBED`. Cosmetic presence rides this SAME
 * channel (trackPresence / onPresenceSync), and `channel.track()` is only valid after the join
 * completes — so the caller layers presence by tracking from this callback (Phase 4.7).
 *
 * `onPresence`, if supplied, registers the cosmetic presence-sync listener. It is wired here —
 * not by the caller after this returns — because Supabase forbids adding `presence` (and any
 * other) `.on()` callbacks once `subscribe()` has been called; this function owns the channel's
 * join, so all listeners must be registered before it subscribes.
 */
export function subscribeRoom(
  client: SupabaseClient,
  roomId: string,
  onChange: (payload: RoomMemberChange) => void,
  onSubscribed?: () => void,
  onPresence?: (presence: Map<string, { focused: boolean }>) => void,
): RealtimeChannel {
  const channel = client.channel(`room:${roomId}`).on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "room_members",
      filter: `room_id=eq.${roomId}`,
    },
    onChange,
  );
  // Presence listeners must be registered BEFORE subscribe() (Supabase throws otherwise).
  if (onPresence) onPresenceSync(channel, onPresence);
  channel.subscribe((status) => {
    if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) onSubscribed?.();
  });
  return channel;
}

/**
 * Cosmetic presence payload tracked on the `room:{room_id}` channel. This is the Realtime
 * Presence layer: ephemeral, zero DB writes, and NEVER read by any matchmaking code — Here/Away
 * is presentation-only (Phase 4.7; CLAUDE.md §2.3/§3). The match cohort is ACTIVE membership
 * (room_members.left_at IS NULL), surfaced by subscribeRoom above. `focused` is driven by the
 * app's focus signal (web `visibilitychange`, mobile `AppState`): true = Here, false = connected
 * but Away. A member absent from the channel renders as "no dot" while still in the cohort.
 */
export interface PresenceMeta {
  memberId: string;
  focused: boolean;
}

/**
 * Track (or re-track) the caller's cosmetic presence on a `room:{room_id}` channel. Call once on
 * join and again whenever `focused` changes — `channel.track` replaces the caller's payload, so
 * passing the full meta each time is how focus toggles are published. No DB write.
 */
export async function trackPresence(
  channel: RealtimeChannel,
  meta: PresenceMeta,
): Promise<void> {
  await channel.track(meta);
}

/**
 * Register a callback for presence sync on a `room:{room_id}` channel. Fires on every Realtime
 * Presence change (join/leave/update) with a `Map<memberId, { focused }>` built from
 * `channel.presenceState()` — the cosmetic source for the member list's Here/Away dots. Returns
 * the channel for chaining; presence state is purely client-side and never read by matchmaking.
 *
 * MUST be called before `channel.subscribe()` — Supabase rejects `presence` `.on()` registrations
 * once a channel has subscribed. For the `room:{room_id}` channel, prefer passing `onPresence` to
 * subscribeRoom, which guarantees this ordering.
 */
export function onPresenceSync(
  channel: RealtimeChannel,
  cb: (presence: Map<string, { focused: boolean }>) => void,
): RealtimeChannel {
  return channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<PresenceMeta>();
    const map = new Map<string, { focused: boolean }>();
    for (const presences of Object.values(state)) {
      for (const p of presences) {
        // Last write per memberId wins; a member may briefly appear from >1 ref while reconnecting.
        map.set(p.memberId, { focused: p.focused });
      }
    }
    cb(map);
  });
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

/** A row-change event on `rooms` delivered to a `subscribeRoomSettings` callback. */
export type RoomSettingsChange = RealtimePostgresChangesPayload<{
  id: string;
}>;

/**
 * Subscribe to a room's settings row on `room-settings:{room_id}`. Fires `onChange` on any
 * update of the `rooms` row so every member's lobby learns about a host's in-lobby anchor/
 * filter/radius edit (update_room_filters) live (docs/04 §4, docs/10 §3.5). RLS
 * (rooms_select_member from 0003) scopes deliveries to rooms the caller belongs to; 0021 added
 * `rooms` to the supabase_realtime publication. The callback should invalidate the room query
 * and refetch — the changed columns are not read off the payload. Returns the channel; the
 * caller tears down via `client.removeChannel(channel)` — same pattern as subscribeRoom.
 */
export function subscribeRoomSettings(
  client: SupabaseClient,
  roomId: string,
  onChange: (payload: RoomSettingsChange) => void,
): RealtimeChannel {
  return client
    .channel(`room-settings:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`,
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
