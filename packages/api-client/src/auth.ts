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

/**
 * Ensure the caller has a session, signing in anonymously only if none exists.
 *
 * Guest is the default identity in Phase 1, so create/join flows call this before
 * touching a room. It is idempotent on purpose: `signInAnonymously` mints a NEW
 * anonymous user every call, so re-signing in would give the caller a different
 * `auth.uid()` than the `room_members` row they just created — and RLS would then
 * block every read of that room. Reusing the persisted session keeps the same uid
 * across create → lobby and join → lobby.
 */
export async function ensureGuestSession(
  client: SupabaseClient,
): Promise<ClientResult<Session>> {
  const { data } = await client.auth.getSession();
  if (data.session) {
    return { data: data.session, error: null };
  }
  return signInAnonymously(client);
}
