import {
  ensureProfile,
  registerWithEmailPassword,
  requestPasswordReset,
  signInWithEmailPassword,
  signInWithGoogle,
} from "@munch/api-client";
import type {
  PasswordResetRequest,
  RegisterRequest,
  SignInRequest,
} from "@munch/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getSupabaseClient } from "@/lib/supabase";

import { currentUserKey } from "./use-current-user";

/**
 * Account auth for the home/landing surface (docs/04 §2): register (email+password, with email
 * confirmation), sign in, Google OAuth, and request-password-reset. Auth happens only OUTSIDE a
 * room and always as a fresh/existing real account — there is no in-place guest upgrade
 * (CLAUDE.md §3). Endpoint shapes live in @munch/api-client (CLAUDE.md §4); each helper returns
 * a ClientResult whose safe ApiError message is rethrown so TanStack Query exposes it.
 *
 * Redirect targets must be allow-listed in supabase/config.toml additional_redirect_urls.
 * On web (implicit flow, detectSessionInUrl), Google lands on /auth/callback where supabase-js
 * establishes the session; the reset email lands on /auth/reset.
 */

/** Returned by register so the panel can show the "confirm your email" state vs. a live session. */
interface RegisterResult {
  needsEmailConfirmation: boolean;
}

async function registerFlow(req: RegisterRequest): Promise<RegisterResult> {
  const result = await registerWithEmailPassword(getSupabaseClient(), {
    email: req.email,
    password: req.password,
    displayName: req.display_name,
  });
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

async function signInFlow(req: SignInRequest): Promise<void> {
  const client = getSupabaseClient();
  const signedIn = await signInWithEmailPassword(client, {
    email: req.email,
    password: req.password,
  });
  if (signedIn.error) {
    throw new Error(signedIn.error.error.message);
  }
  // First sign-in writes the profiles row from the metadata display name (CLAUDE.md §3); the
  // helper is idempotent (upsert) so repeat sign-ins are harmless.
  const profile = await ensureProfile(client);
  if (profile.error) {
    throw new Error(profile.error.error.message);
  }
}

async function googleFlow(redirectTo: string): Promise<void> {
  // skipBrowserRedirect:false → supabase-js performs the web redirect; the session is detected
  // from the callback URL on /auth/callback. The promise resolves as the browser navigates away.
  const result = await signInWithGoogle(getSupabaseClient(), {
    redirectTo,
    skipBrowserRedirect: false,
  });
  if (result.error) {
    throw new Error(result.error.error.message);
  }
}

async function resetFlow(
  req: PasswordResetRequest & { redirectTo: string },
): Promise<void> {
  const result = await requestPasswordReset(getSupabaseClient(), {
    email: req.email,
    redirectTo: req.redirectTo,
  });
  if (result.error) {
    throw new Error(result.error.error.message);
  }
}

export function useEmailSignIn() {
  const queryClient = useQueryClient();

  const register = useMutation<RegisterResult, Error, RegisterRequest>({
    mutationFn: registerFlow,
  });
  const signIn = useMutation<void, Error, SignInRequest>({
    mutationFn: signInFlow,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: currentUserKey });
    },
  });
  const google = useMutation<void, Error, string>({ mutationFn: googleFlow });
  const requestReset = useMutation<
    void,
    Error,
    PasswordResetRequest & { redirectTo: string }
  >({ mutationFn: resetFlow });

  return { register, signIn, google, requestReset };
}
