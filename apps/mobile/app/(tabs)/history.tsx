import { Screen } from "../../src/components/ui";
import { HistoryView } from "../../src/features/history/history-view";

/**
 * Profile tab root (10-pages.md §2/§3.2). Thin wrapper around HistoryView, which gates on the
 * signed-in vs. guest state and owns its per-state header (CLAUDE.md §3, §4).
 */
export default function HistoryScreen() {
  return (
    <Screen>
      <HistoryView />
    </Screen>
  );
}
