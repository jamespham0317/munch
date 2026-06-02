"use client";

import { RADIUS_MAX_M, type RankingEntry } from "@munch/core";
import { useState } from "react";

import { RadiusSlider } from "@/components/radius-slider";

import { useResolutionRanking } from "./use-resolution-ranking";
import { useResolveSession } from "./use-resolve-session";

/**
 * Host-resolution screen, shown while the session status is `awaiting_host_resolution`
 * (deck exhausted with no unanimous match — CLAUDE.md §2.3). Non-host members see a passive
 * "waiting on host" state and are routed onward by the next status event; the host sees the
 * closest-to-unanimous ranking (CLAUDE.md §2.4) with two controls:
 *   * Accept top pick → resolve_session accept_top → /result (host_accepted_top);
 *   * Widen → resolve_session widen (the only extra provider call, server-side) → the
 *     session returns to `active` and useSwipeSession resumes swiping with the appended
 *     cards. We don't navigate on widen; the status channel drives the resume.
 */
export function ResolutionView({
  roomId,
  sessionId,
  isHost,
  sessionRadiusM,
}: {
  roomId: string;
  sessionId: string;
  isHost: boolean;
  sessionRadiusM: number;
}) {
  if (!isHost) {
    // Non-hosts never call get_resolution_ranking (it raises NOT_HOST); they wait here
    // until the host accepts (→ /result via the match event) or widens (→ resume swiping).
    return (
      <section>
        <h2>Deck&rsquo;s done!</h2>
        <p>Waiting on the host to decide…</p>
      </section>
    );
  }
  return (
    <HostResolution
      roomId={roomId}
      sessionId={sessionId}
      sessionRadiusM={sessionRadiusM}
    />
  );
}

function HostResolution({
  roomId,
  sessionId,
  sessionRadiusM,
}: {
  roomId: string;
  sessionId: string;
  sessionRadiusM: number;
}) {
  const rankingQuery = useResolutionRanking(sessionId, true);
  const resolve = useResolveSession(roomId, sessionId);

  // Widen radius: start at the session's current radius and let the host raise it up to the
  // global cap. Radius-only for v1 — per-member price/cuisine narrowing is deferred (preamble
  // / CLAUDE.md §8); the widen request's `filters` field stays unset.
  const [widenRadiusM, setWidenRadiusM] = useState<number>(sessionRadiusM);

  if (rankingQuery.isPending) {
    return <p>Loading ranking…</p>;
  }
  if (rankingQuery.isError) {
    return <p role="alert">{rankingQuery.error.message}</p>;
  }

  const ranking = rankingQuery.data;
  const topPick = ranking[0] ?? null;
  const busy = resolve.isPending;

  // Three honest framings of the resolution state (Phase 4 edge cases):
  //   * empty deck — start_session/widen found zero spots: offer widen, nothing to accept;
  //   * everyone-passed — every card was passed by everyone (top pick's pass_count equals the
  //     member_count): present it as the host's best-available pick, NOT a near-match;
  //   * otherwise — the normal closest-to-unanimous ranking (fewest passes first).
  const isEmpty = topPick === null;
  const everyonePassed =
    topPick !== null && topPick.pass_count === topPick.member_count;
  const heading = isEmpty
    ? "No spots found"
    : everyonePassed
      ? "Nobody’s first choice"
      : "No unanimous match";
  const subcopy = isEmpty
    ? "Widen your search to pull in more places."
    : everyonePassed
      ? "Everyone passed on these — here’s the best available pick. Accept it or widen the search."
      : "Closest to unanimous — fewest passes first.";

  function handleAccept() {
    if (!topPick || busy) return;
    resolve.mutate({
      action: "accept_top",
      session_id: sessionId,
      restaurant_id: topPick.restaurant_id,
    });
  }

  function handleWiden() {
    if (busy) return;
    resolve.mutate({
      action: "widen",
      session_id: sessionId,
      radius_m: widenRadiusM,
    });
  }

  return (
    <section>
      <h2>{heading}</h2>
      <p>{subcopy}</p>
      {isEmpty ? null : (
        <ol>
          {ranking.map((entry, index) => (
            <RankingRow
              key={entry.restaurant_id}
              entry={entry}
              isTopPick={index === 0}
            />
          ))}
        </ol>
      )}

      {resolve.isError ? <p role="alert">{resolve.error.message}</p> : null}

      <div>
        <button
          type="button"
          onClick={handleAccept}
          disabled={busy || topPick === null}
        >
          {busy ? "Working…" : "Accept top pick"}
        </button>
      </div>

      <div>
        <RadiusSlider
          valueM={widenRadiusM}
          maxM={RADIUS_MAX_M}
          onChange={setWidenRadiusM}
        />
        <button type="button" onClick={handleWiden} disabled={busy}>
          {busy ? "Working…" : "Widen the search"}
        </button>
      </div>
    </section>
  );
}

function RankingRow({
  entry,
  isTopPick,
}: {
  entry: RankingEntry;
  isTopPick: boolean;
}) {
  return (
    <li>
      <strong>{entry.name}</strong>
      {isTopPick ? " — suggested pick" : null}
      <div>
        {entry.pass_count} of {entry.member_count} passed
        {entry.rating !== null ? ` · ⭐ ${entry.rating.toFixed(1)}` : null}
        {` · ${formatDistance(entry.distance_m)}`}
      </div>
    </li>
  );
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
