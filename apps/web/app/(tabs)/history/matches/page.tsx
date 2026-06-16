import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

import { MatchHistoryView } from "@/features/history/match-history-view";

/**
 * Match-history route (10-pages.md §3.2) — reached from the profile hub's "View Match History"
 * (ProfileView, at /history). Nested under /history so the (tabs) nav keeps the Profile tab
 * active (tabs-nav matches `startsWith("/history")`). The top bar mirrors the Stitch "Match
 * History" mockup: a back arrow (returns to the profile hub) beside the Munch brand row. Thin
 * pass-through; MatchHistoryView owns the signed-in gate + data (CLAUDE.md §3, §4).
 */
export default function MatchHistoryPage() {
  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-gutter">
        <Link
          href="/history"
          aria-label="Back to profile"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-text focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
        >
          <ArrowLeft size={24} aria-hidden />
        </Link>
        <div className="flex items-center gap-base">
          <UtensilsCrossed size={24} className="text-heat" aria-hidden />
          <span className="text-title-lg text-text">Munch</span>
        </div>
      </div>
      <MatchHistoryView />
    </div>
  );
}
