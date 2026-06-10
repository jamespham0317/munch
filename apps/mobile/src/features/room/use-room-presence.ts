import {
  heartbeat,
  onPresenceSync,
  subscribeRoom,
  trackPresence,
} from "@munch/api-client";
import { HEARTBEAT_INTERVAL_S } from "@munch/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { getSupabaseClient } from "../../lib/supabase";
import { membersKey } from "./use-room-member";

/**
 * Keepalive + cosmetic presence for a room surface (lobby or session), Phase 4.7 (RN parity with
 * apps/web's useRoomPresence). Replaces the old sticky `setPresence(true)` hack. Three concerns, all
 * gated on a resolved `memberId`:
 *
 *   1. MEMBERSHIP channel — subscribeRoom on `room:{room_id}` invalidates the shared member list
 *      on any join/leave/role change, so every surface reflects the live ACTIVE roster (and can
 *      detect its own removal). This is the authoritative layer (the row).
 *   2. COSMETIC presence — Realtime Presence on the SAME channel: track `{ memberId, focused }`
 *      (focused from React Native's AppState) and expose the synced `Map<memberId,{focused}>`.
 *      Purely presentational — ephemeral, zero DB writes, NEVER read by matchmaking (CLAUDE.md
 *      §2.3/§3).
 *   3. HEARTBEAT — upsert member_heartbeats every HEARTBEAT_INTERVAL_S so the server-side sweeper
 *      (prune_absent_members) keeps the caller in the cohort; a dropped connection lapses past the
 *      grace window and auto-removes them.
 *
 * All endpoint/channel knowledge stays in @munch/api-client (CLAUDE.md §4); this hook only wires
 * the React lifecycles. Returns the cosmetic presence map for the member list's Here/Away dots.
 */
export function useRoomPresence(
  roomId: string,
  memberId: string | null,
): Map<string, { focused: boolean }> {
  const queryClient = useQueryClient();
  const [presence, setPresenceMap] = useState<
    Map<string, { focused: boolean }>
  >(() => new Map());
  // Latest focus state, read by the subscribe + AppState handlers without re-subscribing.
  const focusedRef = useRef(true);

  // Membership channel + cosmetic presence (one `room:{room_id}` channel for both).
  useEffect(() => {
    if (!memberId) return;
    const client = getSupabaseClient();
    focusedRef.current = AppState.currentState === "active";

    const channel = subscribeRoom(
      client,
      roomId,
      () => {
        void queryClient.invalidateQueries({ queryKey: membersKey(roomId) });
      },
      () => {
        // SUBSCRIBED: announce our cosmetic presence (track() is only valid post-join).
        void trackPresence(channel, {
          memberId,
          focused: focusedRef.current,
        });
      },
    );
    onPresenceSync(channel, setPresenceMap);

    const subscription = AppState.addEventListener("change", (state) => {
      // 'active' is focused; 'background'/'inactive' is Away (still in the cohort, Phase 4.7).
      focusedRef.current = state === "active";
      // track() replaces our payload, so re-tracking is how a focus toggle is published.
      void trackPresence(channel, { memberId, focused: focusedRef.current });
    });

    return () => {
      subscription.remove();
      void client.removeChannel(channel);
    };
  }, [roomId, memberId, queryClient]);

  // Authoritative liveness heartbeat. Fire-and-forget; a lapse past the grace window is what the
  // sweeper acts on, so a transient failure here is harmless and intentionally not surfaced.
  useEffect(() => {
    if (!memberId) return;
    const client = getSupabaseClient();
    void heartbeat(client, memberId);
    const id = setInterval(() => {
      void heartbeat(client, memberId);
    }, HEARTBEAT_INTERVAL_S * 1000);
    return () => clearInterval(id);
  }, [memberId]);

  return presence;
}
