"use client";

import type { MatchHistory } from "@munch/core";
import { Calendar, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card } from "@/components/ui";
import { AuthPanel } from "@/features/auth/auth-panel";
import { useCurrentUser } from "@/features/auth/use-current-user";

import { useMatchHistory } from "./use-match-history";

/**
 * Profile destination (pages.md §3.2, "Profile & Sign In Updated"). Signed-in users see their
 * saved matches; guests (anonymous, no profile — CLAUDE.md §3) get the "sign in to save" state
 * with the account panel and never fetch history. The signed-in test is the auth identity's
 * anonymity flag, not the presence of a user_id (guests have one too). Screens stay thin —
 * data access is in the hook / @munch/api-client (CLAUDE.md §4).
 */
export function HistoryView() {
  const userQuery = useCurrentUser();
  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  const historyQuery = useMatchHistory(isSignedIn);

  if (userQuery.isPending) {
    return <HistorySkeleton />;
  }

  // Guest or not signed in: invite them to sign in; do NOT read history (they have no rows).
  if (!isSignedIn) {
    return (
      <section className="flex flex-col gap-md">
        <div className="flex flex-col items-center gap-sm text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand">
            <UtensilsCrossed size={32} className="text-on-brand" aria-hidden />
          </span>
          <h1 className="text-headline-md text-text">
            Sign in to save your history
          </h1>
          <p className="text-body-md text-text-muted">
            Don&apos;t lose your favorite matches and group picks!
          </p>
        </div>
        <AuthPanel mode="signin" />
      </section>
    );
  }

  if (historyQuery.isPending) {
    return <HistorySkeleton />;
  }
  if (historyQuery.isError) {
    return (
      <section className="flex flex-col gap-md">
        <h1 className="text-display-lg-mobile text-text md:text-display-lg">
          Your matches
        </h1>
        <p role="alert" className="text-body-md text-error">
          {historyQuery.error.message}
        </p>
      </section>
    );
  }

  const history = historyQuery.data;
  if (history.length === 0) {
    return (
      <section className="flex flex-col gap-md">
        <h1 className="text-display-lg-mobile text-text md:text-display-lg">
          Your matches
        </h1>
        <p className="text-body-md text-text-muted">
          No matches yet — start a room and find a place together.
        </p>
        <CreateRoomButton />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-md">
      <h1 className="text-display-lg-mobile text-text md:text-display-lg">
        Your matches
      </h1>
      <ul className="flex flex-col gap-gutter">
        {history.map((entry) => (
          <li key={entry.id}>
            <HistoryRow entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CreateRoomButton() {
  const router = useRouter();
  return (
    <Button label="Create a room" onClick={() => router.push("/room/create")} />
  );
}

function HistoryRow({ entry }: { entry: MatchHistory }) {
  // Spread the image prop only when a photo exists, so the Card renders without a header
  // when there is none (rather than an empty grey band).
  const imageProps = entry.restaurantPhotoUrl
    ? { image: entry.restaurantPhotoUrl, imageHeight: 160 }
    : {};
  return (
    <Card {...imageProps}>
      <div className="flex flex-col gap-base">
        <span className="text-title-lg text-text">{entry.restaurantName}</span>
        <span className="text-caption text-text-muted">
          With {entry.participantNames.join(", ")}
        </span>
        <Badge
          label={formatDate(entry.decidedAt)}
          leadingIcon={<Calendar size={12} aria-hidden />}
        />
      </div>
    </Card>
  );
}

/** Card-shaped placeholders so loading never shifts layout (pages.md §4). */
function HistorySkeleton() {
  return (
    <section className="flex flex-col gap-md">
      <div className="h-8 w-44 rounded-sm bg-surface-raised" />
      <div className="flex flex-col gap-gutter">
        {[0, 1].map((key) => (
          <Card key={key} padding="none">
            <div className="h-40 animate-pulse bg-surface-raised motion-reduce:animate-none" />
            <div className="flex flex-col gap-sm p-md">
              <div className="h-4 w-3/4 rounded-sm bg-surface-raised" />
              <div className="h-4 w-3/5 rounded-sm bg-surface-raised" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
