import {
  getRoom,
  getRoomMembers,
  setPresence,
  subscribeRoom,
} from "@munch/api-client";
import type { Room, RoomMember } from "@munch/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getSupabaseClient } from "@/lib/supabase";

/**
 * Lobby data layer: the room + its members read under RLS, kept live by a Realtime
 * subscription, plus the caller's own presence reflecting lobby membership. All
 * endpoint/row-mapping lives in @munch/api-client (CLAUDE.md §4); this hook only
 * orchestrates TanStack Query and the subscription/presence lifecycles.
 */

const roomKey = (roomId: string) => ["room", roomId] as const;
const membersKey = (roomId: string) => ["room-members", roomId] as const;
const sessionUserKey = ["session-user-id"] as const;

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

async function fetchSessionUserId(): Promise<string | null> {
  // Local read of the persisted session (no network round-trip) — used only to
  // tell which member row is the caller's, so the host sees the host-only control.
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
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

  const userIdQuery = useQuery<string | null, Error>({
    queryKey: sessionUserKey,
    queryFn: fetchSessionUserId,
    retry: false,
  });

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
    currentUserId: userIdQuery.data ?? null,
  };
}
