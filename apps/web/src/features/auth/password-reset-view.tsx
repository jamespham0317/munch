"use client";

import { updatePassword } from "@munch/api-client";
import {
  passwordResetRequestSchema,
  updatePasswordRequestSchema,
} from "@munch/core";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";

import { useEmailSignIn } from "./use-email-sign-in";

/**
 * Password reset (docs/04 §2), OUTSIDE any room. Two steps in one screen:
 *  1. Request — email an account a recovery link (redirectTo lands back here).
 *  2. Update — the recovery link establishes a PASSWORD_RECOVERY session; the user sets a new
 *     password via updateUser on that session.
 * Google accounts manage their own credentials and don't use this. Inputs validate against the
 * @munch/core schemas (docs/06 §3); data access lives in @munch/api-client (CLAUDE.md §4).
 */
export function PasswordResetView() {
  const router = useRouter();
  const { requestReset } = useEmailSignIn();

  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const update = useMutation<void, Error, { password: string }>({
    mutationFn: async (vars) => {
      const result = await updatePassword(getSupabaseClient(), vars);
      if (result.error) {
        throw new Error(result.error.error.message);
      }
    },
  });

  // The recovery link redirects here with a recovery token; detectSessionInUrl parses it and
  // fires PASSWORD_RECOVERY, which flips us into the "set a new password" step.
  useEffect(() => {
    const client = getSupabaseClient();
    const { data: sub } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    const parsed = passwordResetRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setValidationError("Enter a valid email.");
      return;
    }
    requestReset.mutate(
      {
        email: parsed.data.email,
        redirectTo: `${window.location.origin}/auth/reset`,
      },
      { onSuccess: () => setRequested(true) },
    );
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    const parsed = updatePasswordRequestSchema.safeParse({ password });
    if (!parsed.success) {
      setValidationError("Enter a new password of at least 8 characters.");
      return;
    }
    update.mutate(parsed.data, { onSuccess: () => router.replace("/") });
  }

  if (recovery) {
    const errorMessage =
      validationError ?? (update.isError ? update.error.message : null);
    return (
      <section>
        <h2>Set a new password</h2>
        <form onSubmit={handleUpdate}>
          <label>
            New password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
          <button type="submit" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save password"}
          </button>
        </form>
      </section>
    );
  }

  if (requested) {
    return (
      <section>
        <p>Check your email for a link to reset your password.</p>
        <Link href="/">Back home</Link>
      </section>
    );
  }

  const errorMessage =
    validationError ??
    (requestReset.isError ? requestReset.error.message : null);
  return (
    <section>
      <h2>Reset your password</h2>
      <form onSubmit={handleRequest}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <button type="submit" disabled={requestReset.isPending}>
          {requestReset.isPending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <Link href="/">Back home</Link>
    </section>
  );
}
