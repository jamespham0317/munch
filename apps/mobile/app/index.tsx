import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

import { AuthPanel } from "../src/features/auth/auth-panel";
import { colors, spacing } from "../src/theme";

/**
 * Home screen. Thin by design (CLAUDE.md §4): it offers the two guest-by-default entry
 * points — create a room or join one — and routes into those flows, which own all data
 * access via @munch/api-client. Anonymous sign-in happens inside the create/join flows.
 * An optional account (guest is never required, docs/01 §10) unlocks saved matches.
 */
export default function HomeScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Munch</Text>
      <Text style={styles.subtitle}>
        Swipe through nearby restaurants with friends until everyone likes the
        same place.
      </Text>
      <Link href="/room/create" style={styles.button}>
        Create a room
      </Link>
      <Link href="/room/join" style={[styles.button, styles.buttonSecondary]}>
        Join a room
      </Link>
      {/* History gates on sign-in itself (guests see "sign in to save"), so the link is
          always shown rather than splitting the home screen into a client auth check. */}
      <Link href="/history" style={[styles.button, styles.buttonSecondary]}>
        Your matches
      </Link>
      {/* Signing in here creates a fresh account; guests upgrade in the lobby instead. */}
      <AuthPanel mode="signin" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 32, fontWeight: "700" },
  subtitle: {
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.accent,
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    textAlign: "center",
    overflow: "hidden",
    minWidth: 200,
  },
  buttonSecondary: { backgroundColor: colors.surface, color: colors.text },
});
