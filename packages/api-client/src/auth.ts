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

// --- accounts (docs/04 §2; CLAUDE.md §3) ------------------------------------
// Two account methods sit beside the guest flow: email + password (register with email
// confirmation, sign in, password reset) and Google OAuth. Auth happens only OUTSIDE a room
// (home + /history); there is no in-place guest->account upgrade — a guest who joined a room
// stays a guest for that room (CLAUDE.md §3). Every account is its own fresh/existing real
// user (`auth.uid()`), established before creating or joining a room. A profiles row is the
// guest/account boundary: written only by `ensureProfile`, only for a permanent
// (non-anonymous) user. Raw GoTrue errors are mapped to a safe `ApiError` (UNAUTHENTICATED),
// never surfaced — a bad password or unconfirmed email reads as UNAUTHENTICATED.

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
 * Register a FRESH email + password account (docs/04 §2). `displayName` is carried into the
 * user metadata (`display_name`) so it survives the email-confirmation round-trip and is
 * available to {@link ensureProfile} after the user confirms and signs in. With email
 * confirmation enabled, `signUp` returns a user but NO session, so no profile is written here —
 * the result only reports whether confirmation is still required. Confirm, then
 * {@link signInWithEmailPassword}.
 */
export async function registerWithEmailPassword(
  client: SupabaseClient,
  params: { email: string; password: string; displayName: string },
): Promise<ClientResult<{ needsEmailConfirmation: boolean }>> {
  const { data, error } = await client.auth.signUp({
    email: params.email,
    password: params.password,
    options: { data: { display_name: params.displayName } },
  });
  if (error) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return {
    data: { needsEmailConfirmation: data.session === null },
    error: null,
  };
}

/**
 * Sign in to an existing email + password account; returns the new session. A bad password or
 * an unconfirmed email maps to UNAUTHENTICATED — the raw GoTrue text (which can echo the email)
 * is never surfaced.
 */
export async function signInWithEmailPassword(
  client: SupabaseClient,
  params: { email: string; password: string },
): Promise<ClientResult<Session>> {
  const { data, error } = await client.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });
  if (error || !data.session) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return { data: data.session, error: null };
}

/**
 * Begin Google OAuth (docs/04 §2): returns the provider authorization URL for the caller to
 * open. On web, pass `skipBrowserRedirect: false` to let supabase-js perform the redirect (the
 * session is then detected from the callback URL). On mobile, keep the default
 * `skipBrowserRedirect: true`, open the returned URL in an auth session, capture the
 * `munch://` redirect, and finish with {@link exchangeOAuthCode} (PKCE).
 */
export async function signInWithGoogle(
  client: SupabaseClient,
  params: { redirectTo: string; skipBrowserRedirect?: boolean },
): Promise<ClientResult<{ url: string | null }>> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: params.redirectTo,
      skipBrowserRedirect: params.skipBrowserRedirect ?? true,
    },
  });
  if (error) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return { data: { url: data.url }, error: null };
}

/**
 * Exchange an OAuth authorization `code` for a session (PKCE). Used by mobile after capturing
 * the `munch://` redirect from {@link signInWithGoogle}; web's supabase-js detects the session
 * from the URL directly and does not need this.
 */
export async function exchangeOAuthCode(
  client: SupabaseClient,
  code: string,
): Promise<ClientResult<Session>> {
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return { data: data.session, error: null };
}

/**
 * Send a password-reset (recovery) email (docs/04 §2). `redirectTo` is the app surface that
 * lands the recovery session on a "set a new password" screen, which calls
 * {@link updatePassword}. Google accounts manage their own credentials and don't use this.
 */
export async function requestPasswordReset(
  client: SupabaseClient,
  params: { email: string; redirectTo: string },
): Promise<ClientResult<void>> {
  const { error } = await client.auth.resetPasswordForEmail(params.email, {
    redirectTo: params.redirectTo,
  });
  if (error) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return { data: undefined, error: null };
}

/** Set a new password on the current (recovery) session — the second half of the reset flow. */
export async function updatePassword(
  client: SupabaseClient,
  params: { password: string },
): Promise<ClientResult<void>> {
  const { error } = await client.auth.updateUser({ password: params.password });
  if (error) {
    return { data: null, error: toApiError(error, "UNAUTHENTICATED") };
  }
  return { data: undefined, error: null };
}

/**
 * Upsert the caller's own profiles row on first sign-in (docs/03 §3.1; RLS profiles_insert_own
 * / _update_own). The display name is resolved from the current user's metadata first —
 * `display_name` for password accounts (carried through {@link registerWithEmailPassword}),
 * `full_name`/`name` for Google — falling back to `fallbackDisplayName`. Refuses while the user
 * is still anonymous: guests stay profile-less (CLAUDE.md §3), and this is the app-side gate the
 * insert policy intentionally relies on (supabase/migrations/0008).
 */
export async function ensureProfile(
  client: SupabaseClient,
  fallbackDisplayName?: string,
): Promise<ClientResult<Profile>> {
  const { data: userData, error: userError } = await client.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return { data: null, error: toApiError(userError, "UNAUTHENTICATED") };
  }
  if (user.is_anonymous) {
    return { data: null, error: makeApiError("FORBIDDEN") };
  }
  const metadata = user.user_metadata ?? {};
  const displayName =
    asNonEmptyString(metadata.display_name) ??
    asNonEmptyString(metadata.full_name) ??
    asNonEmptyString(metadata.name) ??
    fallbackDisplayName;
  if (!displayName) {
    return { data: null, error: makeApiError("VALIDATION_ERROR") };
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

/**
 * Read the caller's OWN profiles row (docs/03 §3.1). A direct RLS-scoped read — the
 * `profiles_select_own` policy (0008) scopes it to `id = auth.uid()`, so no privileged RPC is
 * needed (cf. getMatchHistory in endpoints/history.ts). Returns `null` data (no error) when
 * there is no row: an anonymous guest has no profile (CLAUDE.md §3), so callers branch
 * guest-vs-signed-in off this `null`, not an error. Used to resolve a signed-in member's display
 * name for the direct-join flow, where signed-in users skip the name prompt (docs/10 §3.1/§3.4).
 * Maps snake_case → camelCase at this boundary (docs/06 §5); raw DB text is never surfaced.
 */
export async function fetchOwnProfile(
  client: SupabaseClient,
): Promise<ClientResult<Profile | null>> {
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, created_at, updated_at")
    .maybeSingle()
    .returns<ProfileRow | null>();
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  return { data: data ? mapProfileRow(data) : null, error: null };
}

/** Narrow an unknown user_metadata field to a non-empty trimmed string, else undefined. */
function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}
