import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/lib/supabase";

/**
 * The caller's auth identity, read locally from the persisted session (no network round-trip).
 * `isAnonymous` distinguishes a guest (no `profiles` row — CLAUDE.md §3) from a signed-in user;
 * it drives the history screen's "sign in to save" gate. Shared across screens via a single
 * query key so the read dedupes. (There is no mid-room sign-in: a guest in a room stays a guest.)
 */

export interface CurrentUser {
  id: string;
  /** Anonymous guests have no profile (CLAUDE.md §3); guests still have a user_id. */
  isAnonymous: boolean;
}

export const currentUserKey = ["session-user"] as const;

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id, isAnonymous: user.is_anonymous ?? false } : null;
}

export function useCurrentUser() {
  return useQuery<CurrentUser | null, Error>({
    queryKey: currentUserKey,
    queryFn: fetchCurrentUser,
    retry: false,
  });
}
