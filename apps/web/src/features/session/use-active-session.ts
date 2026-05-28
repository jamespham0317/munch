import { getActiveSession } from "@munch/api-client";
import type { Session } from "@munch/core";
import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/lib/supabase";

/**
 * Read the room's latest non-terminal session under RLS. Used by the lobby (to detect a
 * host start and route everyone in) and by the session screen (to pull the session's
 * snapshotted radius for the local-only filter slider). A null result means no session
 * is in flight.
 */

export const activeSessionKey = (roomId: string) =>
  ["room-active-session", roomId] as const;

async function fetchActiveSession(roomId: string): Promise<Session | null> {
  const result = await getActiveSession(getSupabaseClient(), roomId);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

export function useActiveSession(roomId: string) {
  return useQuery<Session | null, Error>({
    queryKey: activeSessionKey(roomId),
    queryFn: () => fetchActiveSession(roomId),
    retry: false,
  });
}
