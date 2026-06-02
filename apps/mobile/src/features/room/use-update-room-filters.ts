import {
  updateRoomFilters,
  type UpdateRoomFiltersResult,
} from "@munch/api-client";
import type { UpdateRoomFiltersRequest } from "@munch/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * Host-only lobby filter edit (docs/04 §3.3), RN parity with apps/web's useUpdateRoomFilters.
 * Calls update_room_filters and, on success, invalidates the room query so the lobby's filter
 * summary reflects the new values; the next start_session snapshots them onto the session (the
 * only place filters touch the provider — CLAUDE.md §2.1). The RPC is lobby-only and raises
 * SESSION_INVALID_STATE once a session is active; that safe message surfaces via the mutation
 * error (docs/06 §8/§9). Endpoint shapes live in @munch/api-client (CLAUDE.md §4); the envelope
 * is rethrown so TanStack Query exposes it.
 */
async function updateRoomFiltersFlow(
  roomId: string,
  req: UpdateRoomFiltersRequest,
): Promise<UpdateRoomFiltersResult> {
  const result = await updateRoomFilters(getSupabaseClient(), roomId, req);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

export function useUpdateRoomFilters(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation<UpdateRoomFiltersResult, Error, UpdateRoomFiltersRequest>({
    mutationFn: (req) => updateRoomFiltersFlow(roomId, req),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    },
  });
}
