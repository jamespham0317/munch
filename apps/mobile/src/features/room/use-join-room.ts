import {
  ensureGuestSession,
  joinRoom,
  type JoinRoomResult,
} from "@munch/api-client";
import type { JoinRoomRequest } from "@munch/core";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * Join-room flow: ensure a (guest) session, then call the join_room RPC by code and
 * route to the lobby. Mirrors useCreateRoom — see its note on the idempotent session
 * and the thrown-envelope pattern.
 */
async function joinRoomFlow(req: JoinRoomRequest): Promise<JoinRoomResult> {
  const client = getSupabaseClient();

  const auth = await ensureGuestSession(client);
  if (auth.error) {
    throw new Error(auth.error.error.message);
  }

  const result = await joinRoom(client, req);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

export function useJoinRoom() {
  const router = useRouter();
  return useMutation<JoinRoomResult, Error, JoinRoomRequest>({
    mutationFn: joinRoomFlow,
    onSuccess: (data) => {
      router.push({
        pathname: "/room/[roomId]/lobby",
        params: { roomId: data.room.id },
      });
    },
  });
}
