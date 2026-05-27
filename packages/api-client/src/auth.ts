import type { Profile } from "@munch/core";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { type ClientResult, makeApiError, toApiError } from "./errors";

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

// --- optional accounts (docs/04 §2; CLAUDE.md §3) ---------------------------
// Verification is by 6-digit email OTP, which works identically on web and mobile and
// keeps the caller on the SAME Supabase client/session — important on mobile, where the
// anonymous session is in-memory for the launch, so the guest keeps their auth.uid()
// (and room membership) through an upgrade. A profiles row is the guest/account boundary
// (CLAUDE.md §3): created only here, only for a permanent (non-anonymous) user.

interface ProfileRow {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Start a FRESH email account: email the caller a 6-digit OTP (creating the user if new).
 * Distinct from the guest upgrade — this signs in as a brand-new permanent user, so it is for
 * the home "sign in" entry, NOT for a guest already in a room (that would abandon their
 * anonymous session and room membership; use {@link upgradeGuestToAccount} there). Verify the
 * emailed code with {@link verifyEmailOtp}.
 */
export async function signInWithEmail(
  client: SupabaseClient,
  email: string,
): Promise<ClientResult<void>> {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return { data: undefined, error: null };
}

/** Verify the 6-digit OTP from {@link signInWithEmail}; returns the new permanent session. */
export async function verifyEmailOtp(
  client: SupabaseClient,
  email: string,
  token: string,
): Promise<ClientResult<Session>> {
  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error || !data.session) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return { data: data.session, error: null };
}

/**
 * Begin upgrading the CURRENT anonymous guest to an email account: link `email` to the existing
 * anonymous user (GoTrue converts it in place), emailing a 6-digit confirmation OTP. The
 * user_id is unchanged, so the guest keeps their room membership (CLAUDE.md §3). Finish with
 * {@link confirmGuestUpgrade}, which verifies the code and writes the profiles row.
 */
export async function upgradeGuestToAccount(
  client: SupabaseClient,
  email: string,
): Promise<ClientResult<void>> {
  const { error } = await client.auth.updateUser({ email });
  if (error) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return { data: undefined, error: null };
}

/**
 * Confirm a guest upgrade: verify the `email_change` OTP from {@link upgradeGuestToAccount},
 * then ensure a profiles row exists with `displayName`. On success the same user is now a
 * permanent account (same user_id, new profile).
 */
export async function confirmGuestUpgrade(
  client: SupabaseClient,
  email: string,
  token: string,
  displayName: string,
): Promise<ClientResult<Profile>> {
  const { error } = await client.auth.verifyOtp({
    email,
    token,
    type: "email_change",
  });
  if (error) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return ensureProfile(client, displayName);
}

/**
 * Upsert the caller's own profiles row (docs/03 §3.1; RLS profiles_insert_own / _update_own).
 * Refuses while the user is still anonymous — guests stay profile-less (CLAUDE.md §3), and this
 * is the app-side gate the insert policy intentionally relies on (supabase/migrations/0008).
 */
export async function ensureProfile(
  client: SupabaseClient,
  displayName: string,
): Promise<ClientResult<Profile>> {
  const { data: userData, error: userError } = await client.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return { data: null, error: toApiError(userError, "UNAUTHENTICATED") };
  }
  if (user.is_anonymous) {
    return { data: null, error: makeApiError("FORBIDDEN") };
  }
  const { data, error } = await client
    .from("profiles")
    .upsert({ id: user.id, display_name: displayName })
    .select("id, display_name, created_at, updated_at")
    .single()
    .returns<ProfileRow>();
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  return { data: mapProfileRow(data), error: null };
}
