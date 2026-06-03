import { AntDesign } from "@expo/vector-icons";
import { registerRequestSchema, signInRequestSchema } from "@munch/core";
import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Field, Input, Toggle } from "../../components/ui";
import { colors, spacing, typography } from "../../theme";
import { useEmailSignIn } from "./use-email-sign-in";

/**
 * Account panel for the Profile tab (RN parity with apps/web's AuthPanel; docs/01 §10) —
 * always OUTSIDE a room. Toggles between signing in and registering an email+password account,
 * with a "Continue with Google" button and a "Forgot password?" link. There is NO mid-room
 * sign-in and no guest upgrade: signing in here is always a fresh/existing real account
 * (CLAUDE.md §3); guest stays the default elsewhere and is never blocked. Explicit handlers only
 * (docs/06 §6); all data access is in @munch/api-client (CLAUDE.md §4), and inputs are validated
 * against the @munch/core schemas (docs/06 §3) with the server re-validating.
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

  function handleSubmit() {
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
      register.mutate(parsed.data, { onSuccess: () => setRegistered(true) });
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
    google.mutate(undefined, { onSuccess: () => setSignedIn(true) });
  }

  function switchMode(next: "signin" | "register") {
    setAuthMode(next);
    setValidationError(null);
  }

  if (signedIn) {
    return <Text style={styles.muted}>You&apos;re signed in.</Text>;
  }
  if (registered) {
    return (
      <Text style={styles.muted}>
        Check your email to confirm your account, then sign in.
      </Text>
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
      <View style={styles.inner}>
        <Button
          label={google.isPending ? "Connecting…" : "Continue with Google"}
          variant="social"
          onPress={handleGoogle}
          disabled={pending}
          loading={google.isPending}
          leadingIcon={
            <AntDesign name="google" size={18} color={colors.heatStrong} />
          }
        />

        <View style={styles.divider}>
          <View style={styles.rule} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.rule} />
        </View>

        <Field label="Email address">
          <Input
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder="At least 8 characters"
          />
        </Field>
        {isRegister ? (
          <Field label="Your name">
            <Input
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={50}
              placeholder="Your name"
            />
          </Field>
        ) : (
          <View style={styles.rememberRow}>
            <Toggle
              value={rememberMe}
              onValueChange={setRememberMe}
              label="Remember me"
            />
            <Link href="/auth/reset" style={styles.link}>
              Forgot?
            </Link>
          </View>
        )}

        {errorMessage ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errorMessage}
          </Text>
        ) : null}

        <Button
          label={
            isRegister
              ? register.isPending
                ? "Creating…"
                : "Create account"
              : signIn.isPending
                ? "Signing in…"
                : "Sign In"
          }
          onPress={handleSubmit}
          disabled={pending}
          loading={isRegister ? register.isPending : signIn.isPending}
        />

        {isRegister ? (
          <Text style={styles.footer}>
            Already have an account?{" "}
            <Text style={styles.link} onPress={() => switchMode("signin")}>
              Sign in
            </Text>
          </Text>
        ) : (
          <Text style={styles.footer}>
            New here?{" "}
            <Text style={styles.link} onPress={() => switchMode("register")}>
              Create an account
            </Text>
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  inner: { gap: spacing.gutter },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.labelMd, color: colors.textFaint },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  muted: { ...typography.bodyMd, color: colors.textMuted },
  error: { ...typography.bodyMd, color: colors.error },
  footer: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
  },
  link: { ...typography.bodyMd, color: colors.heatStrong },
});
