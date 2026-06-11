import {
  createRoom,
  type CreateRoomResult,
  ensureGuestSession,
} from "@munch/api-client";
import type { CreateRoomRequest } from "@munch/core";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * Create-room flow: ensure a (guest) session, then call the create_room RPC and
 * route to the new lobby. RN parity with apps/web's useCreateRoom — all endpoint
 * shapes/mapping live in @munch/api-client (CLAUDE.md §4). Guest is the default
 * identity (CLAUDE.md §3); the idempotent ensureGuestSession reuses the persisted
 * session so the caller keeps the same auth.uid() as the host member it creates. The
 * api-client envelope is surfaced as a thrown Error so TanStack Query exposes its
 * safe message (never raw DB text).
 */
async function createRoomFlow(
  req: CreateRoomRequest,
): Promise<CreateRoomResult> {
  const client = getSupabaseClient();

  const auth = await ensureGuestSession(client);
  if (auth.error) {
    throw new Error(auth.error.error.message);
  }

  const result = await createRoom(client, req);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

export function useCreateRoom() {
  const router = useRouter();
  return useMutation<CreateRoomResult, Error, CreateRoomRequest>({
    mutationFn: createRoomFlow,
    onSuccess: (data) => {
      router.push({
        pathname: "/room/[roomId]/lobby",
        params: { roomId: data.room.id },
      });
    },
  });
}

/**
 * Cancel an in-progress room creation. No room exists yet (create_room only fires on
 * submit — Start Room), so this is a pure client-side discard: no RPC, no cleanup, no
 * invariant impact. Routes to the Match tab ("/"), matching the app's explicit-destination
 * exit convention (useRoomExit's router.replace home — the app never pops the back stack).
 */
export function useCancelCreateRoom() {
  const router = useRouter();
  return () => {
    router.replace("/");
  };
}
