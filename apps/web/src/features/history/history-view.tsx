"use client";

import type { MatchHistory } from "@munch/core";
import Link from "next/link";

import { AuthPanel } from "@/features/auth/auth-panel";
import { useCurrentUser } from "@/features/auth/use-current-user";

import { useMatchHistory } from "./use-match-history";

/**
 * Match-history screen (docs/01 §10, docs/05 §4). Signed-in users see their saved matches;
 * guests (anonymous, no profile — CLAUDE.md §3) get a "sign in to save your matches" state
 * and never fetch history. The signed-in test is the auth identity's anonymity flag, not the
 * presence of a user_id (guests have one too). Screens stay thin — data access is in the hook
 * / @munch/api-client (CLAUDE.md §4).
 */
export function HistoryView() {
  const userQuery = useCurrentUser();
  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  const historyQuery = useMatchHistory(isSignedIn);

  if (userQuery.isPending) {
    return <p>Loading…</p>;
  }

  // Guest or not signed in: invite them to sign in; do NOT read history (they have no rows).
  if (!isSignedIn) {
    return (
      <section>
        <h2>Sign in to save your matches</h2>
        <p>Create an account and your matches will show up here.</p>
        <AuthPanel mode="signin" />
        <Link href="/">Back home</Link>
      </section>
    );
  }

  if (historyQuery.isPending) {
    return <p>Loading your matches…</p>;
  }
  if (historyQuery.isError) {
    return <p role="alert">{historyQuery.error.message}</p>;
  }

  const history = historyQuery.data;
  if (history.length === 0) {
    return (
      <section>
        <p>No matches yet — start a room and find a place together.</p>
        <Link href="/">Back home</Link>
      </section>
    );
  }

  return (
    <section>
      <ul>
        {history.map((entry) => (
          <HistoryRow key={entry.id} entry={entry} />
        ))}
      </ul>
      <Link href="/">Back home</Link>
    </section>
  );
}

function HistoryRow({ entry }: { entry: MatchHistory }) {
  return (
    <li>
      {entry.restaurantPhotoUrl ? (
        <img
          src={entry.restaurantPhotoUrl}
          alt=""
          width={120}
          height={80}
          style={{ objectFit: "cover" }}
        />
      ) : null}
      <strong>{entry.restaurantName}</strong>
      <div>With {entry.participantNames.join(", ")}</div>
      <div>{formatDate(entry.decidedAt)}</div>
    </li>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
