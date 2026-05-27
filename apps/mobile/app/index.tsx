import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../src/theme";

/**
 * Home screen. Thin by design (CLAUDE.md §4): it offers the two guest-by-default entry
 * points — create a room or join one — and routes into those flows, which own all data
 * access via @munch/api-client. Anonymous sign-in happens inside the create/join flows.
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
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
