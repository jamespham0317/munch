import { exchangeOAuthCode, updatePassword } from "@munch/api-client";
import {
  passwordResetRequestSchema,
  updatePasswordRequestSchema,
} from "@munch/core";
import { useMutation } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Field, Input } from "../../components/ui";
import { getSupabaseClient } from "../../lib/supabase";
import { colors, spacing, typography } from "../../theme";
import { useEmailSignIn } from "./use-email-sign-in";

/**
 * Password reset (RN parity with apps/web's PasswordResetView; docs/04 §2), OUTSIDE any room.
 * Two steps in one screen:
 *  1. Request — email an account a recovery link. redirectTo is the munch://auth/reset deep link,
 *     allow-listed in config.toml additional_redirect_urls (Prompt 3).
 *  2. Update — the recovery link reopens the app at this route with a PKCE `code`; mobile
 *     exchanges it for the recovery session itself (web relies on detectSessionInUrl), then the
 *     user sets a new password via updateUser on that session.
 * Google accounts manage their own credentials and don't use this. Inputs validate against the
 * @munch/core schemas (docs/06 §3); data access lives in @munch/api-client (CLAUDE.md §4).
 */
export function PasswordResetView({ code }: { code?: string | undefined }) {
  const router = useRouter();
  const { requestReset } = useEmailSignIn();

  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  const update = useMutation<void, Error, { password: string }>({
    mutationFn: async (vars) => {
      const result = await updatePassword(getSupabaseClient(), vars);
      if (result.error) {
        throw new Error(result.error.error.message);
      }
    },
  });

  // The recovery link reopens the app at munch://auth/reset?code=… Exchange the code for the
  // recovery session, then flip into the "set a new password" step.
  useEffect(() => {
    if (!code) {
      return;
    }
    let active = true;
    void (async () => {
      const result = await exchangeOAuthCode(getSupabaseClient(), code);
      if (!active) {
        return;
      }
      if (result.error) {
        setExchangeError(result.error.error.message);
        return;
      }
      setRecovery(true);
    })();
    return () => {
      active = false;
    };
  }, [code]);

  function handleRequest() {
    setValidationError(null);
    const parsed = passwordResetRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setValidationError("Enter a valid email.");
      return;
    }
    requestReset.mutate(
      {
        email: parsed.data.email,
        redirectTo: Linking.createURL("auth/reset"),
      },
      { onSuccess: () => setRequested(true) },
    );
  }

  function handleUpdate() {
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
      <View style={styles.container}>
        <Text style={styles.heading}>Set a new password</Text>
        <Field label="New password">
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </Field>
        {errorMessage ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errorMessage}
          </Text>
        ) : null}
        <Button
          label={update.isPending ? "Saving…" : "Save password"}
          onPress={handleUpdate}
          loading={update.isPending}
        />
      </View>
    );
  }

  // A code is present but the exchange failed (expired/used link) — surface the safe message.
  if (code && exchangeError) {
    return (
      <View style={styles.container}>
        <Text style={styles.error} accessibilityRole="alert">
          {exchangeError}
        </Text>
        <Link href="/" style={styles.link}>
          Back home
        </Link>
      </View>
    );
  }
  // A code is present and we're still exchanging it for the recovery session.
  if (code) {
    return <Text style={styles.muted}>Opening your reset link…</Text>;
  }

  if (requested) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>
          Check your email for a link to reset your password.
        </Text>
        <Link href="/" style={styles.link}>
          Back home
        </Link>
      </View>
    );
  }

  const errorMessage =
    validationError ??
    (requestReset.isError ? requestReset.error.message : null);
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Reset your password</Text>
      <Field label="Email">
        <Input
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@example.com"
        />
      </Field>
      {errorMessage ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
      <Button
        label={requestReset.isPending ? "Sending…" : "Send reset link"}
        onPress={handleRequest}
        loading={requestReset.isPending}
      />
      <Link href="/" style={styles.link}>
        Back home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.gutter },
  heading: { ...typography.headlineMd, color: colors.text },
  muted: { ...typography.bodyMd, color: colors.textMuted },
  error: { ...typography.bodyMd, color: colors.error },
  link: {
    ...typography.bodyMd,
    color: colors.heatStrong,
    paddingTop: spacing.base,
  },
});
