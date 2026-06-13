import { Feather } from "@expo/vector-icons";
import { exchangeOAuthCode, updatePassword } from "@munch/api-client";
import {
  passwordResetRequestSchema,
  updatePasswordRequestSchema,
} from "@munch/core";
import { useMutation } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Field, IconBadge, Input } from "../../components/ui";
import { getSupabaseClient } from "../../lib/supabase";
import { colors, radii, spacing, typography } from "../../theme";
import { useEmailSignIn } from "./use-email-sign-in";

/**
 * "Back" → the Profile tab, where the sign-in panel lives (docs/10 §3.2). Styled as the Join
 * page's text Button (arrow + "Back"). Uses router.replace (not a Link push) so the (tabs)
 * screen's animationTypeForReplace="pop" carries /history in from the LEFT, like a retreat.
 */
function BackToLogin() {
  const router = useRouter();
  return (
    <Button
      variant="text"
      label="Back"
      leadingIcon={<Feather name="arrow-left" size={20} color={colors.brand} />}
      onPress={() => router.replace("/history")}
    />
  );
}

/** The centered reset card shared by the message-only states (09-design-system.md §7). */
function ResetCard({ children }: { children: ReactNode }) {
  return (
    <View style={styles.outer}>
      <Card>
        <View style={styles.cardInner}>{children}</View>
      </Card>
    </View>
  );
}

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
      <View style={styles.formOuter}>
        <View style={styles.hero}>
          <IconBadge
            variant="tonalCircle"
            icon={<Feather name="lock" size={36} color={colors.brandDeep} />}
          />
          <Text style={styles.heading}>Set a new password</Text>
        </View>
        <Card>
          <View style={styles.formBlock}>
            <Field label="New password">
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                leadingIcon={
                  <Feather name="lock" size={20} color={colors.textFaint} />
                }
                style={styles.pill}
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
              trailingIcon={
                <Feather name="arrow-right" size={20} color={colors.onBrand} />
              }
            />
          </View>
        </Card>
      </View>
    );
  }

  // A code is present but the exchange failed (expired/used link) — surface the safe message.
  if (code && exchangeError) {
    return (
      <ResetCard>
        <IconBadge
          variant="tonalCircle"
          icon={<Feather name="alert-circle" size={36} color={colors.error} />}
        />
        <Text style={styles.error} accessibilityRole="alert">
          {exchangeError}
        </Text>
        <BackToLogin />
      </ResetCard>
    );
  }
  // A code is present and we're still exchanging it for the recovery session.
  if (code) {
    return <Text style={styles.muted}>Opening your reset link…</Text>;
  }

  if (requested) {
    return (
      <ResetCard>
        <IconBadge
          variant="tonalCircle"
          icon={
            <Feather name="check-circle" size={36} color={colors.brandDeep} />
          }
        />
        <Text style={styles.muted}>
          Check your email for a link to reset your password.
        </Text>
        <BackToLogin />
      </ResetCard>
    );
  }

  const errorMessage =
    validationError ??
    (requestReset.isError ? requestReset.error.message : null);
  return (
    <View style={styles.formOuter}>
      <View style={styles.hero}>
        <IconBadge
          variant="tonalCircle"
          icon={<Feather name="info" size={36} color={colors.brandDeep} />}
        />
        <Text style={styles.heading}>Lost your way?</Text>
        <Text style={styles.subtext}>
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </Text>
      </View>
      <Card>
        <View style={styles.formBlock}>
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="Email Address"
              style={styles.pill}
            />
          </Field>
          {errorMessage ? (
            <Text style={styles.error} accessibilityRole="alert">
              {errorMessage}
            </Text>
          ) : null}
          <Button
            label={requestReset.isPending ? "Sending…" : "Send Reset Link"}
            onPress={handleRequest}
            loading={requestReset.isPending}
            trailingIcon={
              <Feather name="arrow-right" size={20} color={colors.onBrand} />
            }
          />
          <BackToLogin />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { gap: spacing.lg, alignItems: "center" },
  // Form steps mirror the Join page: a centered icon + heading hero ABOVE a full-width card.
  formOuter: { gap: spacing.md },
  hero: { alignItems: "center", gap: spacing.sm },
  cardInner: { gap: spacing.md, alignItems: "center" },
  // The centered card centers the badge + headings; the interactive block stretches full
  // width so the Field/Input/Button don't collapse to their content width.
  formBlock: { width: "100%", gap: spacing.md },
  pill: { borderRadius: radii.full, backgroundColor: colors.surfaceHighest },
  heading: {
    ...typography.headlineMd,
    color: colors.text,
    textAlign: "center",
  },
  subtext: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
  },
  muted: { ...typography.bodyMd, color: colors.textMuted, textAlign: "center" },
  error: { ...typography.bodyMd, color: colors.error, textAlign: "center" },
});
