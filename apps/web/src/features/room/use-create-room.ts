import {
  createRoom,
  type CreateRoomResult,
  ensureGuestSession,
} from "@munch/api-client";
import type { CreateRoomRequest } from "@munch/core";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "@/lib/supabase";

/**
 * Create-room flow: ensure a (guest) session, then call the create_room RPC and
 * route to the new lobby. Guest is the default identity (CLAUDE.md §3) — the
 * idempotent ensureGuestSession reuses the persisted session so the caller keeps
 * the same auth.uid() as the host member it creates. All endpoint shapes/mapping
 * live in @munch/api-client (CLAUDE.md §4); the api-client envelope is surfaced as
 * a thrown Error so TanStack Query exposes its safe message.
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
      router.push(`/room/${data.room.id}/lobby`);
    },
  });
}
