import { HistoryView } from "@/features/history/history-view";

/**
 * Profile destination route (10-pages.md §2/§3.2). Thin pass-through; HistoryView gates on the
 * signed-in vs. guest state and owns its per-state header (CLAUDE.md §3, §4). The (tabs)
 * layout supplies the <main> + centered container.
 */
export default function HistoryPage() {
  return <HistoryView />;
}
