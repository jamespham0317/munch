import { startSession } from "@munch/api-client";
import type { StartSessionRequest, StartSessionResponse } from "@munch/core";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "@/lib/supabase";

/**
 * Host-only start-session flow: invoke the start-session Edge Function (the only path
 * that touches the provider — CLAUDE.md §2.1), then route the host to the swipe screen
 * with the new session id. Non-host members land on the same screen via the lobby's
 * session-subscription auto-route, not through this mutation.
 *
 * The api-client envelope's safe message is rethrown so TanStack Query exposes it; raw
 * provider/DB text never reaches the UI (docs/06 §8/§9). PROVIDER_ERROR's message reaches
 * the UI on purpose so the host can retry (sessions.ts header comment).
 */
async function startSessionFlow(
  req: StartSessionRequest,
): Promise<StartSessionResponse> {
  const result = await startSession(getSupabaseClient(), req);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

export function useStartSession(roomId: string) {
  const router = useRouter();
  return useMutation<StartSessionResponse, Error, StartSessionRequest>({
    mutationFn: startSessionFlow,
    onSuccess: (data) => {
      router.push(`/room/${roomId}/session?sessionId=${data.session.id}`);
    },
  });
}
