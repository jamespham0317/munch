"use client";

import { updatePassword } from "@munch/api-client";
import {
  passwordResetRequestSchema,
  updatePasswordRequestSchema,
} from "@munch/core";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Info,
  Lock,
  Mail,
  MailCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { Button, Card, Field, IconBadge, Input } from "@/components/ui";
import { getSupabaseClient } from "@/lib/supabase";

import { useEmailSignIn } from "./use-email-sign-in";

/** "Back to Login" → the Profile tab, where the sign-in panel lives (docs/10 §3.2). */
function BackToLogin() {
  return (
    <Link
      href="/history"
      className="inline-flex items-center gap-base text-label-md uppercase text-heat-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
    >
      <ArrowLeft size={18} aria-hidden />
      Back to Login
    </Link>
  );
}

/** The centered reset card + legal footer shared by every state (09-design-system.md §7). */
function ResetCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-xl">
      <Card className="flex w-full flex-col items-center gap-md text-center">
        {children}
      </Card>
    </div>
  );
}

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
      <ResetCard>
        <IconBadge
          variant="tonalCircle"
          icon={<Lock size={36} aria-hidden />}
        />
        <h2 className="text-headline-md text-text">Set a new password</h2>
        <form
          onSubmit={handleUpdate}
          className="flex w-full flex-col gap-md text-left"
        >
          <Field label="New password" htmlFor="reset-new-password">
            <Input
              id="reset-new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              leadingIcon={<Lock size={20} aria-hidden />}
              className="rounded-full bg-surface-highest"
            />
          </Field>
          {errorMessage ? (
            <p role="alert" className="text-body-md text-error">
              {errorMessage}
            </p>
          ) : null}
          <Button
            type="submit"
            label={update.isPending ? "Saving…" : "Save password"}
            loading={update.isPending}
            elevated
            trailingIcon={<ArrowRight size={20} aria-hidden />}
          />
        </form>
      </ResetCard>
    );
  }

  if (requested) {
    return (
      <ResetCard>
        <IconBadge
          variant="tonalCircle"
          icon={<MailCheck size={36} aria-hidden />}
        />
        <p className="text-body-md text-text-muted">
          Check your email for a link to reset your password.
        </p>
        <BackToLogin />
      </ResetCard>
    );
  }

  const errorMessage =
    validationError ??
    (requestReset.isError ? requestReset.error.message : null);
  return (
    <ResetCard>
      <IconBadge variant="tonalCircle" icon={<Info size={36} aria-hidden />} />
      <div className="flex flex-col gap-sm">
        <h2 className="text-headline-md text-text">Lost your way?</h2>
        <p className="mx-auto max-w-[280px] text-body-md text-text-muted">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>
      <form
        onSubmit={handleRequest}
        className="flex w-full flex-col gap-md text-left"
      >
        <Field label="Email address" htmlFor="reset-email">
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            placeholder="Email Address"
            leadingIcon={<Mail size={20} aria-hidden />}
            className="rounded-full bg-surface-highest"
          />
        </Field>
        {errorMessage ? (
          <p role="alert" className="text-body-md text-error">
            {errorMessage}
          </p>
        ) : null}
        <Button
          type="submit"
          label={requestReset.isPending ? "Sending…" : "Send Reset Link"}
          loading={requestReset.isPending}
          elevated
          trailingIcon={<ArrowRight size={20} aria-hidden />}
        />
      </form>
      <BackToLogin />
    </ResetCard>
  );
}
