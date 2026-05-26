import { StyleSheet, Text, View } from "react-native";

import { SmokeRestaurantCard } from "../src/components/smoke-restaurant-card";
import { useSmokeRead } from "../src/features/auth/use-smoke-read";
import { colors, spacing } from "../src/theme";

/**
 * Phase 0 entry screen. Thin by design (CLAUDE.md §4): it owns no domain logic and
 * just renders the state of the smoke read (anonymous session + seeded row under
 * RLS), which runs entirely through @munch/api-client.
 */
export default function HomeScreen() {
  const query = useSmokeRead();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Munch</Text>
      <Text style={styles.subtitle}>Phase 0 connectivity check</Text>
      {query.status === "pending" ? (
        <Text style={styles.muted}>Connecting…</Text>
      ) : query.status === "error" ? (
        <Text style={styles.error}>{query.error.message}</Text>
      ) : (
        <SmokeRestaurantCard restaurant={query.data} />
      )}
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
    gap: spacing.sm,
  },
  title: { color: colors.text, fontSize: 32, fontWeight: "700" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.md },
  muted: { color: colors.textMuted },
  error: { color: colors.danger, textAlign: "center" },
});
