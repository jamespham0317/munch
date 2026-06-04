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

  // Mark the caller present while they're in the room surface (lobby or session).
  // STICKY: we assert `true` on mount but never fire a `false` on unmount. The
  // lobby↔session navigation and React StrictMode's dev double-invoke both unmount/
  // remount this effect, and a fire-and-forget away-write there races the present-write
  // and can leave the member stuck `away` — which breaks the present-member-scoped match
  // + deck-exhaustion checks (CLAUDE.md §2.3, docs/03 §3.3, docs/04 §3.4). Departure is an
  // explicit action instead: leaveRoom/endRoom (and the host-leave cancel path) set
  // is_present=false directly. Best-effort — failures are intentionally not surfaced.
  useEffect(() => {
    void setPresence(getSupabaseClient(), roomId, { is_present: true });
  }, [roomId]);

  return {
    roomQuery,
    membersQuery,
    sessionQuery,
    activeSession: sessionQuery.data ?? null,
    currentUserId: userQuery.data?.id ?? null,
  };
}
