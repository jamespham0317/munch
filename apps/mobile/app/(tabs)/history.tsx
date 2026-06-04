import { ScrollView, StyleSheet } from "react-native";

import { HistoryView } from "../../src/features/history/history-view";
import { colors, spacing } from "../../src/theme";

/**
 * Profile tab root (10-pages.md §2/§3.2). Thin wrapper around HistoryView, which gates on the
 * signed-in vs. guest state and owns its per-state header (CLAUDE.md §3, §4).
 */
export default function HistoryScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <HistoryView />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.screenMarginMobile, gap: spacing.md },
});
