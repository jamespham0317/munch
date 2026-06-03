import { registerRequestSchema, signInRequestSchema } from "@munch/core";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Field } from "../../components/ui/field";
import { colors, spacing } from "../../theme";
import { useEmailSignIn } from "./use-email-sign-in";

/**
 * Account panel for the home/landing surface and /history (RN parity with apps/web's AuthPanel;
 * docs/01 §10) — both OUTSIDE a room. Toggles between signing in and registering an email+password
 * account, with a "Continue with Google" button and a "Forgot password?" link. There is NO
 * mid-room sign-in and no guest upgrade: signing in here is always a fresh/existing real account
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
    <View style={styles.panel}>
      <Text style={styles.heading}>
        {isRegister ? "Create an account" : "Sign in"}
      </Text>
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
        <Field label="Password">
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textMuted}
          />
        </Field>
        {isRegister ? (
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
          onPress={handleSubmit}
          disabled={pending}
        >
          <Text style={styles.buttonText}>
            {isRegister
              ? register.isPending
                ? "Creating…"
                : "Create account"
              : signIn.isPending
                ? "Signing in…"
                : "Sign in"}
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.buttonSecondary, pending && styles.buttonDisabled]}
        onPress={handleGoogle}
        disabled={pending}
      >
        <Text style={styles.buttonSecondaryText}>
          {google.isPending ? "Connecting…" : "Continue with Google"}
        </Text>
      </Pressable>

      {isRegister ? (
        <Pressable onPress={() => switchMode("signin")}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </Pressable>
      ) : (
        <View style={styles.footerLinks}>
          <Pressable onPress={() => switchMode("register")}>
            <Text style={styles.link}>Need an account? Create one</Text>
          </Pressable>
          <Link href="/auth/reset" style={styles.link}>
            Forgot password?
          </Link>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.gutter },
  heading: { color: colors.text, fontSize: 18, fontWeight: "600" },
  form: { gap: spacing.gutter },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.base,
    color: colors.text,
    fontSize: 16,
  },
  muted: { color: colors.textMuted },
  error: { color: colors.error },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: spacing.gutter,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.onBrand, fontSize: 16, fontWeight: "600" },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.gutter,
    alignItems: "center",
  },
  buttonSecondaryText: { color: colors.text, fontSize: 16, fontWeight: "600" },
  footerLinks: { gap: spacing.base },
  link: { color: colors.brand, fontSize: 14, fontWeight: "600" },
});
