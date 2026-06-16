import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { MatchHistoryView } from "@/features/history/match-history-view";

/**
 * Match-history route (10-pages.md §3.2) — reached from the profile hub's "View Match History"
 * (ProfileView, at /history). Nested under /history so the (tabs) nav keeps the Profile tab
 * active (tabs-nav matches `startsWith("/history")`). A back link returns to the profile hub.
 * Thin pass-through; MatchHistoryView owns the signed-in gate + data (CLAUDE.md §3, §4).
 */
export default function MatchHistoryPage() {
  return (
    <div className="flex flex-col gap-md">
      <Link
        href="/history"
        aria-label="Back to profile"
        className="inline-flex items-center gap-base self-start text-title-lg text-text focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40 rounded-full"
      >
        <ChevronLeft size={24} aria-hidden />
        Profile
      </Link>
      <MatchHistoryView />
    </div>
  );
}
