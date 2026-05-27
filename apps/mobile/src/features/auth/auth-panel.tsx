import {
  confirmGuestUpgradeRequestSchema,
  signInWithEmailRequestSchema,
  upgradeGuestRequestSchema,
  verifyEmailOtpRequestSchema,
} from "@munch/core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Field } from "../../components/field";
import { colors, spacing } from "../../theme";
import { useEmailSignIn } from "./use-email-sign-in";
import { useUpgradeGuest } from "./use-upgrade-guest";

/**
 * Optional-account panel (RN parity with apps/web's AuthPanel): a lean two-step email →
 * 6-digit-code flow shared by the home "sign in" entry (mode="signin", a fresh account) and
 * the lobby "save my matches" entry (mode="upgrade", links an email to the current guest).
 * Intentionally minimal — full account UX and the history screen are Phase 4 (docs/07). Guest
 * stays the default and is never blocked. Explicit handlers only (docs/06 §6); all data access
 * is in @munch/api-client (CLAUDE.md §4), and inputs are validated against the @munch/core
 * schemas (docs/06 §3) with the server re-validating.
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

  function handleSendCode() {
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

  function handleVerify() {
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
      <Text style={styles.muted}>
        {isUpgrade
          ? "Your matches will be saved to this account."
          : "You're signed in."}
      </Text>
    );
  }

  const mutationError = sendCode.isError
    ? sendCode.error.message
    : verify.isError
      ? verify.error.message
      : null;
  const errorMessage = validationError ?? mutationError;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>
        {isUpgrade ? "Save my matches" : "Sign in"}
      </Text>
      {step === "email" ? (
        <View style={styles.form}>
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
          {isUpgrade ? (
            <Field label="Your name">
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={50}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
              />
            </Field>
          ) : null}
          {errorMessage ? (
            <Text style={styles.error} accessibilityRole="alert">
              {errorMessage}
            </Text>
          ) : null}
          <Pressable
            style={[styles.button, pending && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={pending}
          >
            <Text style={styles.buttonText}>
              {pending ? "Sending…" : "Send code"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.muted}>
            We emailed a 6-digit code to {email}.
          </Text>
          <Field label="Code">
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
            />
          </Field>
          {errorMessage ? (
            <Text style={styles.error} accessibilityRole="alert">
              {errorMessage}
            </Text>
          ) : null}
          <Pressable
            style={[styles.button, pending && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={pending}
          >
            <Text style={styles.buttonText}>
              {pending ? "Verifying…" : "Verify"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  heading: { color: colors.text, fontSize: 18, fontWeight: "600" },
  form: { gap: spacing.md },
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
});
