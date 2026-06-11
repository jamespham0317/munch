import { fetchOwnProfile } from "@munch/api-client";
import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "../../lib/supabase";
import { useCurrentUser } from "./use-current-user";

/**
 * The signed-in caller's profile display name, used to skip the name prompt on the direct-join
 * flow (docs/10 §3.1/§3.4): a signed-in member joins by code with their profile name instead of
 * typing one. Enabled only when signed-in (a guest has no `profiles` row — CLAUDE.md §3), so the
 * guest join path stays network-free. Returns `null` when no name resolves (guest, or the rare
 * no-profile-row state); callers treat a null name as "fall back to name entry", so the gate is
 * the resolved NAME, not merely the signed-in flag. RN parity with apps/web's useOwnProfile.
 */

export const ownProfileKey = ["own-profile"] as const;

async function fetchDisplayName(): Promise<string | null> {
  const result = await fetchOwnProfile(getSupabaseClient());
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data?.displayName ?? null;
}

export function useOwnProfile() {
  const userQuery = useCurrentUser();
  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  return useQuery<string | null, Error>({
    queryKey: ownProfileKey,
    queryFn: fetchDisplayName,
    enabled: isSignedIn,
    retry: false,
  });
}
