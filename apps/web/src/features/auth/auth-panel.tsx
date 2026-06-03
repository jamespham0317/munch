"use client";

import { registerRequestSchema, signInRequestSchema } from "@munch/core";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { Button, Card, Field, Input, Toggle } from "@/components/ui";

import { useEmailSignIn } from "./use-email-sign-in";

/**
 * Account panel for the Profile destination (docs/01 §10) — always OUTSIDE a room. Toggles
 * between signing in and registering an email+password account, with a "Continue with Google"
 * button and a "Forgot password?" link. There is NO mid-room sign-in and no guest upgrade:
 * signing in here is always a fresh/existing real account (CLAUDE.md §3); guest stays the
 * default elsewhere and is never blocked. Screens stay thin — data access is in
 * @munch/api-client (CLAUDE.md §4); inputs validate against the @munch/core schemas (docs/06 §3)
 * and the server re-validates.
 */
export function AuthPanel({ mode }: { mode: "signin" | "register" }) {
  const { register, signIn, google } = useEmailSignIn();

  const [authMode, setAuthMode] = useState<"signin" | "register">(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  // Presentational only: the mockup shows "Remember me", but session persistence is not yet
  // wired (supabase-js persists the session regardless today). Kept as local state so the
  // control matches the design without changing auth behavior.
  const [rememberMe, setRememberMe] = useState(false);
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
    return (
      <p className="text-body-md text-text-muted">You&apos;re signed in.</p>
    );
  }
  if (registered) {
    return (
      <p className="text-body-md text-text-muted">
        Check your email to confirm your account, then sign in.
      </p>
    );
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
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-gutter">
        <Button
          variant="social"
          label={google.isPending ? "Connecting…" : "Continue with Google"}
          onClick={handleGoogle}
          disabled={pending}
          loading={google.isPending}
          leadingIcon={<GoogleIcon />}
        />

        <div className="flex items-center gap-sm">
          <span className="h-px flex-1 bg-border" />
          <span className="text-label-md uppercase text-text-faint">OR</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Field label="Email address" htmlFor="auth-email">
          <Input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" htmlFor="auth-password">
          <Input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder="At least 8 characters"
          />
        </Field>
        {isRegister ? (
          <Field label="Your name" htmlFor="auth-name">
            <Input
              id="auth-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={50}
              placeholder="Your name"
            />
          </Field>
        ) : (
          <div className="flex items-center justify-between">
            <Toggle
              value={rememberMe}
              onValueChange={setRememberMe}
              label="Remember me"
            />
            <Link
              href="/auth/reset"
              className="text-body-md text-heat-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
            >
              Forgot?
            </Link>
          </div>
        )}

        {errorMessage ? (
          <p role="alert" className="text-body-md text-error">
            {errorMessage}
          </p>
        ) : null}

        <Button
          type="submit"
          label={
            isRegister
              ? register.isPending
                ? "Creating…"
                : "Create account"
              : signIn.isPending
                ? "Signing in…"
                : "Sign In"
          }
          disabled={pending}
          loading={isRegister ? register.isPending : signIn.isPending}
        />

        {isRegister ? (
          <p className="text-center text-body-md text-text-muted">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-heat-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
            >
              Sign in
            </button>
          </p>
        ) : (
          <p className="text-center text-body-md text-text-muted">
            New here?{" "}
            <button
              type="button"
              onClick={() => switchMode("register")}
              className="text-heat-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
            >
              Create an account
            </button>
          </p>
        )}
      </form>
    </Card>
  );
}

/** Multicolour Google "G" mark for the social sign-in button (no icon dependency). */
function GoogleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#ffc107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z"
      />
      <path
        fill="#ff3d00"
        d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.2 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4caf50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.6 5.1A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976d2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.3 35.6 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
