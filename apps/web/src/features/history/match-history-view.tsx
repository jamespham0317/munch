"use client";

import type { MatchHistory } from "@munch/core";
import { User, Users, UsersRound, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge, Button, IconBadge } from "@/components/ui";
import { useCurrentUser } from "@/features/auth/use-current-user";

import { useMatchHistory } from "./use-match-history";

/**
 * Match-history list (10-pages.md §3.2), reached from the profile hub's "View Match History"
 * (ProfileView). Signed-in users see their saved matches; the read is gated on the signed-in
 * identity (guests have no rows — CLAUDE.md §3). A guest who deep-links here is bounced back to
 * the profile tab, where the sign-in gate lives. Screens stay thin — data access is in the hook
 * / @munch/api-client (CLAUDE.md §4).
 *
 * Reskinned to the Stitch "Match History" mockup: compact rows (colored left accent, 80×80
 * thumbnail, name + date pill, "Matched with …") under a deep-amber title, with a persistent
 * "Craving more?" footer hint that also serves as the empty state. Presentation only — no
 * change to the read, the gate, or any invariant.
 */
export function MatchHistoryView() {
  const userQuery = useCurrentUser();
  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  const historyQuery = useMatchHistory(isSignedIn);
  const router = useRouter();

  if (userQuery.isPending) {
    return <HistorySkeleton />;
  }

  // Defensive: the hub only links here when signed-in, so a guest reaching this route is sent
  // back to the profile tab (where the sign-in gate lives) rather than shown an empty list.
  if (!isSignedIn) {
    return (
      <section className="flex flex-col gap-md">
        <Header />
        <p className="text-body-md text-text-muted">
          Sign in to see the places your group has matched on.
        </p>
        <Button
          label="Go to Profile"
          variant="ghost"
          onClick={() => router.replace("/history")}
        />
      </section>
    );
  }

  if (historyQuery.isPending) {
    return <HistorySkeleton />;
  }
  if (historyQuery.isError) {
    return (
      <section className="flex flex-col gap-md">
        <Header />
        <p role="alert" className="text-body-md text-error">
          {historyQuery.error.message}
        </p>
      </section>
    );
  }

  const history = historyQuery.data;
  return (
    <section className="flex flex-col gap-md">
      <Header />
      {history.length > 0 && (
        <ul className="flex flex-col gap-gutter">
          {history.map((entry, index) => (
            <li key={entry.id}>
              <HistoryRow entry={entry} index={index} />
            </li>
          ))}
        </ul>
      )}
      <CravingMore />
    </section>
  );
}

/** Deep-amber title + subtitle, matching the Stitch header. */
function Header() {
  return (
    <header className="flex flex-col gap-xs">
      <h1 className="text-display-lg-mobile text-brand-deep md:text-display-lg">
        Match History
      </h1>
      <p className="text-body-md text-text-muted">
        Revisit the spots where the magic happened.
      </p>
    </header>
  );
}

/** Left-accent colors cycle amber → burnt-orange → deep-amber, like the mockup's three rows. */
const ACCENTS = ["bg-brand", "bg-heat", "bg-brand-deep"] as const;

function HistoryRow({ entry, index }: { entry: MatchHistory; index: number }) {
  const accent = ACCENTS[index % ACCENTS.length];
  return (
    <div className="relative flex items-center gap-gutter overflow-hidden rounded-lg bg-surface-sunken py-gutter pl-[22px] pr-gutter shadow-low">
      <span
        aria-hidden
        className={`absolute left-0 top-0 h-full w-1.5 ${accent}`}
      />
      {entry.restaurantPhotoUrl ? (
        // Remote, dynamically sized restaurant photos; next/image config is out of scope
        // for this reskin (the root ESLint config has no next plugin) — same as Card.
        <img
          src={entry.restaurantPhotoUrl}
          alt=""
          className="h-20 w-20 flex-shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-md bg-brand/20 text-brand-deep">
          <UtensilsCrossed size={32} aria-hidden />
        </div>
      )}
      <div className="flex min-w-0 flex-grow flex-col gap-xs">
        <div className="flex items-start justify-between gap-base">
          <span className="truncate text-title-lg text-text">
            {entry.restaurantName}
          </span>
          <Badge label={formatDate(entry.decidedAt)} tone="match" />
        </div>
        <span className="flex min-w-0 items-center gap-xs text-body-md text-text-muted">
          <ParticipantIcon count={entry.participantNames.length} />
          <span className="truncate">
            Matched with {formatParticipants(entry.participantNames)}
          </span>
        </span>
      </div>
    </div>
  );
}

/** Persistent "Craving more?" hint (also the empty state). Text only — the Match tab starts a session. */
function CravingMore() {
  return (
    <div className="mt-lg flex flex-col items-center gap-sm text-center">
      <IconBadge
        variant="tonalCircle"
        icon={<UtensilsCrossed size={32} aria-hidden />}
      />
      <h2 className="text-title-lg text-text">Craving more?</h2>
      <p className="max-w-[280px] text-body-md text-text-muted">
        Start a new session and find your next favorite meal with friends.
      </p>
    </div>
  );
}

/** One / pair / group glyph, derived from the participant count (no data change). */
function ParticipantIcon({ count }: { count: number }) {
  const Icon = count <= 1 ? User : count === 2 ? Users : UsersRound;
  return <Icon size={18} aria-hidden className="flex-shrink-0" />;
}

/** Card-shaped placeholders so loading never shifts layout (10-pages.md §4). */
function HistorySkeleton() {
  return (
    <section className="flex flex-col gap-md">
      <div className="h-8 w-56 rounded-sm bg-surface-raised" />
      <div className="flex flex-col gap-gutter">
        {[0, 1].map((key) => (
          <div
            key={key}
            className="flex items-center gap-gutter rounded-lg bg-surface-sunken p-gutter shadow-low"
          >
            <div className="h-20 w-20 flex-shrink-0 animate-pulse rounded-md bg-surface-raised motion-reduce:animate-none" />
            <div className="flex flex-grow flex-col gap-xs">
              <div className="h-4 w-3/4 rounded-sm bg-surface-raised" />
              <div className="h-4 w-3/5 rounded-sm bg-surface-raised" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

/** "A" · "A and B" · "A, B and C" — matches the mockup's oxford-style joining. */
function formatParticipants(names: string[]): string {
  if (names.length === 0) return "your group";
  if (names.length === 1) return names[0] ?? "your group";
  const last = names[names.length - 1] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${last}`;
}
