import { signOut } from "@munch/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getSupabaseClient } from "../../lib/supabase";
import { matchHistoryKey } from "../history/use-match-history";
import { currentUserKey } from "./use-current-user";
import { ownProfileKey } from "./use-own-profile";

/**
 * Sign out from the Profile hub (RN parity with apps/web's useSignOut; docs/04 §2) — only reachable
 * outside a room (CLAUDE.md §3). The api-client `signOut` ends the session (clearing the local
 * session even if the server revoke fails); its safe ApiError message is rethrown so TanStack Query
 * exposes it. On success we invalidate the auth-identity query so the Profile re-renders into the
 * guest gate (useCurrentUser doesn't subscribe to auth-state changes), and drop the per-account
 * caches so the previous user's profile name / match history can't linger. No anonymous session is
 * minted here — that happens lazily on the next create/join (ensureGuestSession). Thin by design
 * (CLAUDE.md §4).
 */
async function signOutFlow(): Promise<void> {
  const result = await signOut(getSupabaseClient());
  if (result.error) {
    throw new Error(result.error.error.message);
  }
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: signOutFlow,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: currentUserKey });
      queryClient.removeQueries({ queryKey: ownProfileKey });
      queryClient.removeQueries({ queryKey: matchHistoryKey });
    },
  });
}
