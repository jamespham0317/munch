"use client";

import { registerRequestSchema, signInRequestSchema } from "@munch/core";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { useEmailSignIn } from "./use-email-sign-in";

/**
 * Account panel for the home/landing surface and /history (docs/01 §10) — both OUTSIDE a room.
 * Toggles between signing in and registering an email+password account, with a "Continue with
 * Google" button and a "Forgot password?" link. There is NO mid-room sign-in and no guest
 * upgrade: signing in here is always a fresh/existing real account (CLAUDE.md §3); guest stays
 * the default elsewhere and is never blocked. Screens stay thin — data access is in
 * @munch/api-client (CLAUDE.md §4); inputs validate against the @munch/core schemas (docs/06 §3)
 * and the server re-validates.
 */
export function AuthPanel({ mode }: { mode: "signin" | "register" }) {
  const { register, signIn, google } = useEmailSignIn();

  const [authMode, setAuthMode] = useState<"signin" | "register">(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const isRegister = authMode === "register";
  const pending = register.isPending || signIn.isPending || google.isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    if (isRegister) {
      const parsed = registerRequestSchema.safeParse({
        email,
        password,
        display_name: displayName,
      });
      if (!parsed.success) {
        setValidationError(
          "Enter a valid email, a password of at least 8 characters, and your name.",
        );
        return;
      }
      register.mutate(parsed.data, {
        onSuccess: () => setRegistered(true),
      });
    } else {
      const parsed = signInRequestSchema.safeParse({ email, password });
      if (!parsed.success) {
        setValidationError("Enter a valid email and password.");
        return;
      }
      signIn.mutate(parsed.data, { onSuccess: () => setSignedIn(true) });
    }
  }

  function handleGoogle() {
    setValidationError(null);
    // supabase-js performs the redirect; the session is established on /auth/callback.
    google.mutate(`${window.location.origin}/auth/callback`);
  }

  function switchMode(next: "signin" | "register") {
    setAuthMode(next);
    setValidationError(null);
  }

  if (signedIn) {
    return <p>You&apos;re signed in.</p>;
  }
  if (registered) {
    return <p>Check your email to confirm your account, then sign in.</p>;
  }

  const mutationError = register.isError
    ? register.error.message
    : signIn.isError
      ? signIn.error.message
      : google.isError
        ? google.error.message
        : null;
  const errorMessage = validationError ?? mutationError;

  return (
    <section>
      <h2>{isRegister ? "Create an account" : "Sign in"}</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
        </label>
        {isRegister ? (
          <label>
            Your name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={50}
            />
          </label>
        ) : null}
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <button type="submit" disabled={pending}>
          {isRegister
            ? register.isPending
              ? "Creating…"
              : "Create account"
            : signIn.isPending
              ? "Signing in…"
              : "Sign in"}
        </button>
      </form>

      <button type="button" onClick={handleGoogle} disabled={pending}>
        {google.isPending ? "Redirecting…" : "Continue with Google"}
      </button>

      {isRegister ? (
        <p>
          Already have an account?{" "}
          <button type="button" onClick={() => switchMode("signin")}>
            Sign in
          </button>
        </p>
      ) : (
        <>
          <p>
            Need an account?{" "}
            <button type="button" onClick={() => switchMode("register")}>
              Create one
            </button>
          </p>
          <Link href="/auth/reset">Forgot password?</Link>
        </>
      )}
    </section>
  );
}
