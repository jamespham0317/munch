import { ScrollView, StyleSheet, Text } from "react-native";

import { HistoryView } from "../src/features/history/history-view";
import { colors, spacing } from "../src/theme";

/**
 * Saved-matches screen (docs/05 §3). Thin wrapper around the HistoryView feature, which gates
 * on the signed-in vs. guest state (CLAUDE.md §3, §4).
 */
export default function HistoryScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Your matches</Text>
      <HistoryView />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
});
