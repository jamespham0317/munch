import {
  getRoom,
  getRoomMembers,
  setPresence,
  subscribeRoom,
  subscribeRoomSessions,
} from "@munch/api-client";
import type { Room, RoomMember } from "@munch/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import {
  activeSessionKey,
  useActiveSession,
} from "@/features/session/use-active-session";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * Lobby data layer: the room + its members read under RLS, kept live by a Realtime
 * subscription, plus the caller's own presence reflecting lobby membership. All
 * endpoint/row-mapping lives in @munch/api-client (CLAUDE.md §4); this hook only
 * orchestrates TanStack Query and the subscription/presence lifecycles.
 */

const roomKey = (roomId: string) => ["room", roomId] as const;
const membersKey = (roomId: string) => ["room-members", roomId] as const;

async function fetchRoom(roomId: string): Promise<Room> {
  const result = await getRoom(getSupabaseClient(), roomId);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

async function fetchMembers(roomId: string): Promise<RoomMember[]> {
  const result = await getRoomMembers(getSupabaseClient(), roomId);
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

  const membersQuery = useQuery<RoomMember[], Error>({
    queryKey: membersKey(roomId),
    queryFn: () => fetchMembers(roomId),
    retry: false,
  });

  const userQuery = useCurrentUser();

  const sessionQuery = useActiveSession(roomId);

  // Live presence: refetch the member list whenever a room_members row changes.
  // subscribeRoom only delivers co-member rows for this room (RLS); no swipes exist.
  useEffect(() => {
    const client = getSupabaseClient();
    const channel = subscribeRoom(client, roomId, () => {
      void queryClient.invalidateQueries({ queryKey: membersKey(roomId) });
    });
    return () => {
      void client.removeChannel(channel);
    };
  }, [roomId, queryClient]);

  // Watch the room's session row so the lobby learns about a host-initiated session
  // start (and any later status transitions while everyone is still in the lobby —
  // e.g. cancelled if the host bails). RLS scopes deliveries to rooms we belong to.
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

  // Reflect lobby membership: present on mount, away on unmount. Presence is
  // best-effort, so failures are intentionally not surfaced.
  useEffect(() => {
    const client = getSupabaseClient();
    void setPresence(client, roomId, { is_present: true });
    return () => {
      void setPresence(client, roomId, { is_present: false });
    };
  }, [roomId]);

  return {
    roomQuery,
    membersQuery,
    sessionQuery,
    activeSession: sessionQuery.data ?? null,
    currentUserId: userQuery.data?.id ?? null,
    isGuest: userQuery.data?.isAnonymous ?? false,
  };
}
