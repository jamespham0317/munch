import { HistoryView } from "@/features/history/history-view";

/**
 * Saved-matches route (docs/05 §4). Thin pass-through; HistoryView gates on the signed-in vs.
 * guest state (CLAUDE.md §3).
 */
export default function HistoryPage() {
  return (
    <main>
      <h1>Your matches</h1>
      <HistoryView />
    </main>
  );
}
