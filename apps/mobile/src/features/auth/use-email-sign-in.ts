import {
  ensureProfile,
  exchangeOAuthCode,
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
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { getSupabaseClient } from "../../lib/supabase";
import { currentUserKey } from "./use-current-user";

/**
 * Account auth for the home/landing surface and /history (RN parity with apps/web's
 * useEmailSignIn; docs/04 §2): register (email+password, with email confirmation), sign in,
 * Google OAuth, and request-password-reset. Auth happens only OUTSIDE a room and always as a
 * fresh/existing real account — there is no in-place guest upgrade (CLAUDE.md §3). Endpoint
 * shapes live in @munch/api-client (CLAUDE.md §4); each helper returns a ClientResult whose safe
 * ApiError message is rethrown so TanStack Query exposes it.
 *
 * Google differs from web: instead of letting supabase-js perform a browser redirect, mobile
 * runs the PKCE round-trip itself — open the provider URL with expo-web-browser, capture the
 * munch:// redirect, and exchange the code for a session. The redirect target is built from the
 * app scheme (munch://auth/callback) and must be allow-listed in config.toml
 * additional_redirect_urls (Prompt 3).
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

async function googleFlow(): Promise<void> {
  const client = getSupabaseClient();
  // munch://auth/callback — the in-app return URL openAuthSessionAsync watches for, and the
  // OAuth redirect target. No screen renders for it: the browser session resolves with the URL.
  const redirectTo = Linking.createURL("auth/callback");
  const started = await signInWithGoogle(client, {
    redirectTo,
    skipBrowserRedirect: true,
  });
  if (started.error || !started.data.url) {
    throw new Error(
      started.error?.error.message ?? "Could not start Google sign-in.",
    );
  }
  const result = await WebBrowser.openAuthSessionAsync(
    started.data.url,
    redirectTo,
  );
  if (result.type !== "success") {
    // User dismissed the browser or it failed — not an auth error to surface as raw text.
    throw new Error("Google sign-in was cancelled.");
  }
  const code = Linking.parse(result.url).queryParams?.code;
  if (typeof code !== "string") {
    throw new Error("Google sign-in did not complete.");
  }
  const exchanged = await exchangeOAuthCode(client, code);
  if (exchanged.error) {
    throw new Error(exchanged.error.error.message);
  }
  // First Google sign-in writes the profiles row from full_name/name (CLAUDE.md §3).
  const profile = await ensureProfile(client);
  if (profile.error) {
    throw new Error(profile.error.error.message);
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
  const google = useMutation<void, Error, void>({
    mutationFn: googleFlow,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: currentUserKey });
    },
  });
  const requestReset = useMutation<
    void,
    Error,
    PasswordResetRequest & { redirectTo: string }
  >({ mutationFn: resetFlow });

  return { register, signIn, google, requestReset };
}
