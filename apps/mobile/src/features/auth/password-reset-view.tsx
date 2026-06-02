import { exchangeOAuthCode, updatePassword } from "@munch/api-client";
import {
  passwordResetRequestSchema,
  updatePasswordRequestSchema,
} from "@munch/core";
import { useMutation } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Field } from "../../components/field";
import { getSupabaseClient } from "../../lib/supabase";
import { colors, spacing } from "../../theme";
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
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textMuted}
          />
        </Field>
        {errorMessage ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errorMessage}
          </Text>
        ) : null}
        <Pressable
          style={[styles.button, update.isPending && styles.buttonDisabled]}
          onPress={handleUpdate}
          disabled={update.isPending}
        >
          <Text style={styles.buttonText}>
            {update.isPending ? "Saving…" : "Save password"}
          </Text>
        </Pressable>
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
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
        />
      </Field>
      {errorMessage ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
      <Pressable
        style={[styles.button, requestReset.isPending && styles.buttonDisabled]}
        onPress={handleRequest}
        disabled={requestReset.isPending}
      >
        <Text style={styles.buttonText}>
          {requestReset.isPending ? "Sending…" : "Send reset link"}
        </Text>
      </Pressable>
      <Link href="/" style={styles.link}>
        Back home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  heading: { color: colors.text, fontSize: 18, fontWeight: "600" },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 16,
  },
  muted: { color: colors.textMuted },
  error: { color: colors.danger },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: "600" },
  link: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600",
    paddingTop: spacing.sm,
  },
});
