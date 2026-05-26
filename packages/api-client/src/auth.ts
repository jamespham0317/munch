import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { type ClientResult, toApiError } from "./errors";

/**
 * Sign in as an anonymous guest (docs/04 §2). Anonymous sessions are first-class
 * here — they are what lets a guest create a `room_members` row. Returns the new
 * session or a safe `ApiError`; raw auth errors are never surfaced.
 */
export async function signInAnonymously(
  client: SupabaseClient,
): Promise<ClientResult<Session>> {
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return { data: data.session, error: null };
}
