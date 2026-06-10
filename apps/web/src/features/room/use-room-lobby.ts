import { getRoom, subscribeRoomSessions } from "@munch/api-client";
import type { Room } from "@munch/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  activeSessionKey,
  useActiveSession,
} from "@/features/session/use-active-session";
import { getSupabaseClient } from "@/lib/supabase";

import { useRoomMember } from "./use-room-member";
import { useRoomPresence } from "./use-room-presence";

/**
 * Lobby data layer: the room + its ACTIVE members read under RLS, kept live by the room channel,
 * plus the caller's keepalive (heartbeat) and cosmetic presence (Phase 4.7). All endpoint/
 * row-mapping lives in @munch/api-client (CLAUDE.md §4); this hook only orchestrates TanStack
 * Query and the subscription/presence lifecycles. Presence is purely cosmetic — the match cohort
 * is ACTIVE membership (left_at IS NULL), never the Here/Away dots (CLAUDE.md §2.3/§3).
 */

const roomKey = (roomId: string) => ["room", roomId] as const;

async function fetchRoom(roomId: string): Promise<Room> {
  const result = await getRoom(getSupabaseClient(), roomId);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

export function useRoomLobby(roomId: string) {
  const queryClient = useQueryClient();

  const roomQuery = useQuery<Room, Error>({
    queryKey: roomKey(roomId),
    queryFn: () => fetchRoom(roomId),
    retry: false,
  });

  const { membersQuery, member, memberId, isHost, settled } =
    useRoomMember(roomId);

  const sessionQuery = useActiveSession(roomId);

  // Keepalive + cosmetic presence + the membership channel (which invalidates the member list on
  // any join/leave/role change) all live in useRoomPresence — it owns the single `room:{room_id}`
  // channel for this surface. The lobby no longer writes presence to the DB (Phase 4.7 removed the
  // old sticky setPresence hack); Here/Away comes from this map.
  const presence = useRoomPresence(roomId, memberId);

  // Watch the room's session row so the lobby learns about a host-initiated session start (and any
  // later status transitions while everyone is still in the lobby — e.g. cancelled if the host
  // bails). RLS scopes deliveries to rooms we belong to.
  useEffect(() => {
    const client = getSupabaseClient();
    const channel = subscribeRoomSessions(client, roomId, () => {
      void queryClient.invalidateQueries({
        queryKey: activeSessionKey(roomId),
      });
    });
    return () => {
      void client.removeChannel(channel);
    };
  }, [roomId, queryClient]);

  return {
    roomQuery,
    membersQuery,
    sessionQuery,
    activeSession: sessionQuery.data ?? null,
    member,
    memberId,
    isHost,
    membersSettled: settled,
    presence,
  };
}
