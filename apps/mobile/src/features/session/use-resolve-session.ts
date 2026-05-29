import { resolveSession } from "@munch/api-client";
import type {
  ResolveSessionRequest,
  ResolveSessionResponse,
} from "@munch/core";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * Host-only resolution flow (docs/04 §3.9; RN parity with apps/web's useResolveSession):
 * accept the top pick or widen the search. Both actions go through the resolve-session Edge
 * Function — widen needs the server-only provider key, and accept_top rides along on the same
 * endpoint (CLAUDE.md §2.1). The discriminated request is passed straight through; the server
 * validates and dispatches by `action`.
 *
 *   * accept_top → on success route to the result screen. The Edge Function also inserts the
 *     matches row, so co-members land on the same result screen via subscribeSession's match
 *     event; navigating here just makes it instant for the host.
 *   * widen → do NOT navigate. The session goes back to `active` and useSwipeSession's status
 *     channel resumes swiping (re-reading the larger cached deck). No provider call happens
 *     client-side — the one widen-round fetch is server-side.
 *
 * The api-client envelope's safe message is rethrown for the UI; raw provider/DB text never
 * leaks (docs/06 §8/§9). A transport failure surfaces as PROVIDER_ERROR's message so the host
 * can retry a widen (sessions.ts header comment).
 */
async function resolveSessionFlow(
  req: ResolveSessionRequest,
): Promise<ResolveSessionResponse> {
  const result = await resolveSession(getSupabaseClient(), req);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

export function useResolveSession(roomId: string, sessionId: string) {
  const router = useRouter();
  return useMutation<ResolveSessionResponse, Error, ResolveSessionRequest>({
    mutationFn: resolveSessionFlow,
    onSuccess: (_data, variables) => {
      if (variables.action === "accept_top") {
        router.replace({
          pathname: "/room/[roomId]/result",
          params: { roomId, sessionId },
        });
      }
      // widen: stay put — the status → active transition resumes the swipe screen.
    },
  });
}
