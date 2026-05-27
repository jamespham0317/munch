"use client";

import {
  confirmGuestUpgradeRequestSchema,
  signInWithEmailRequestSchema,
  upgradeGuestRequestSchema,
  verifyEmailOtpRequestSchema,
} from "@munch/core";
import { type FormEvent, useState } from "react";

import { useEmailSignIn } from "./use-email-sign-in";
import { useUpgradeGuest } from "./use-upgrade-guest";

/**
 * Optional-account panel: a lean two-step email → 6-digit-code flow shared by the home
 * "sign in" entry (mode="signin", a fresh account) and the lobby "save my matches" entry
 * (mode="upgrade", links an email to the current guest). Intentionally minimal — full account
 * UX and the history screen are Phase 4 (docs/07). Guest stays the default and is never blocked.
 * Screens stay thin: all data access is in @munch/api-client (CLAUDE.md §4); inputs are
 * validated against the @munch/core schemas (docs/06 §3), and the server re-validates.
 */
export function AuthPanel({ mode }: { mode: "signin" | "upgrade" }) {
  const signIn = useEmailSignIn();
  const upgrade = useUpgradeGuest();

  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const isUpgrade = mode === "upgrade";
  const sendCode = isUpgrade ? upgrade.sendCode : signIn.sendCode;
  const verify = isUpgrade ? upgrade.confirm : signIn.verify;
  const pending = sendCode.isPending || verify.isPending;

  function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    if (isUpgrade) {
      const parsed = upgradeGuestRequestSchema.safeParse({
        email,
        display_name: displayName,
      });
      if (!parsed.success) {
        setValidationError("Enter a valid email and your name.");
        return;
      }
      upgrade.sendCode.mutate(parsed.data, {
        onSuccess: () => setStep("code"),
      });
    } else {
      const parsed = signInWithEmailRequestSchema.safeParse({ email });
      if (!parsed.success) {
        setValidationError("Enter a valid email.");
        return;
      }
      signIn.sendCode.mutate(parsed.data, { onSuccess: () => setStep("code") });
    }
  }

  function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    if (isUpgrade) {
      const parsed = confirmGuestUpgradeRequestSchema.safeParse({
        email,
        token: code.trim(),
        display_name: displayName,
      });
      if (!parsed.success) {
        setValidationError("Enter the 6-digit code.");
        return;
      }
      upgrade.confirm.mutate(parsed.data, { onSuccess: () => setStep("done") });
    } else {
      const parsed = verifyEmailOtpRequestSchema.safeParse({
        email,
        token: code.trim(),
      });
      if (!parsed.success) {
        setValidationError("Enter the 6-digit code.");
        return;
      }
      signIn.verify.mutate(parsed.data, { onSuccess: () => setStep("done") });
    }
  }

  if (step === "done") {
    return (
      <p>
        {isUpgrade
          ? "Your matches will be saved to this account."
          : "You're signed in."}
      </p>
    );
  }

  const mutationError = sendCode.isError
    ? sendCode.error.message
    : verify.isError
      ? verify.error.message
      : null;
  const errorMessage = validationError ?? mutationError;

  return (
    <section>
      <h2>{isUpgrade ? "Save my matches" : "Sign in"}</h2>
      {step === "email" ? (
        <form onSubmit={handleSendCode}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          {isUpgrade ? (
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
            {pending ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify}>
          <p>We emailed a 6-digit code to {email}.</p>
          <label>
            Code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
            />
          </label>
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
          <button type="submit" disabled={pending}>
            {pending ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}
    </section>
  );
}
