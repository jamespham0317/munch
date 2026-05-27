import {
  getRoom,
  getRoomMembers,
  setPresence,
  subscribeRoom,
} from "@munch/api-client";
import type { Room, RoomMember } from "@munch/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * Lobby data layer (RN parity with apps/web's useRoomLobby): the room + its members
 * read under RLS, kept live by a Realtime subscription, plus the caller's own
 * presence reflecting lobby membership. All endpoint/row-mapping lives in
 * @munch/api-client (CLAUDE.md §4); this hook only orchestrates TanStack Query and
 * the subscription/presence lifecycles.
 */

const roomKey = (roomId: string) => ["room", roomId] as const;
const membersKey = (roomId: string) => ["room-members", roomId] as const;
const sessionUserKey = ["session-user"] as const;

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

interface SessionUser {
  id: string;
  /** Anonymous guests have no profile (CLAUDE.md §3); drives the lobby upgrade affordance. */
  isAnonymous: boolean;
}

async function fetchSessionUser(): Promise<SessionUser | null> {
  // Local read of the persisted session (no network round-trip) — tells which member row is
  // the caller's (so the host sees the host-only control) and whether they are a guest.
  const { data } = await getSupabaseClient().auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id, isAnonymous: user.is_anonymous ?? false } : null;
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

  const userQuery = useQuery<SessionUser | null, Error>({
    queryKey: sessionUserKey,
    queryFn: fetchSessionUser,
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

  // Reflect lobby membership: present on focus, away on blur. On mobile a screen can
  // be backgrounded while still mounted, so focus/blur (not mount/unmount) is the
  // right signal. Presence is best-effort, so failures are intentionally not surfaced.
  useFocusEffect(
    useCallback(() => {
      const client = getSupabaseClient();
      void setPresence(client, roomId, { is_present: true });
      return () => {
        void setPresence(client, roomId, { is_present: false });
      };
    }, [roomId]),
  );

  return {
    roomQuery,
    membersQuery,
    currentUserId: userQuery.data?.id ?? null,
    isGuest: userQuery.data?.isAnonymous ?? false,
  };
}
