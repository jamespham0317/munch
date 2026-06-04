"use client";

import {
  type CuisineId,
  CUISINES,
  type DeckRestaurant,
  RADIUS_MAX_M,
} from "@munch/core";
import { Check, MapPin, PlusCircle, RefreshCw, Star } from "lucide-react";
import { useState } from "react";

import { RadiusSlider } from "@/components/radius-slider";
import { Button, Card, FoodChip, ProgressPill } from "@/components/ui";

import { useResolutionRanking } from "./use-resolution-ranking";
import { useResolveSession } from "./use-resolve-session";

/**
 * Host-resolution screen (10-pages.md §3.8), shown while the session status is
 * `awaiting_host_resolution` (deck exhausted with no unanimous match — CLAUDE.md §2.3).
 * Non-host members see a passive "waiting on host" state and are routed onward by the next
 * status event; the host sees the closest-to-unanimous ranking (CLAUDE.md §2.4 — displayed
 * as-is, never re-sorted) with two controls:
 *   * Settle for this → resolve_session accept_top → /result (host_accepted_top);
 *   * Widen → resolve_session widen (the only extra provider call, server-side) → the
 *     session returns to `active` and useSwipeSession resumes swiping with the appended
 *     cards. We don't navigate on widen; the status channel drives the resume.
 *
 * The "N/M friends liked this" pill is an AGGREGATE count (like_count of member_count), never
 * per-member identity (CLAUDE.md §3). The widen block's radius + cuisine criteria are
 * HOST-CONTROLLED room filters (CLAUDE.md §2.2), not a per-member narrow. Web twin of the
 * Phase B mobile ResolutionView.
 */
export function ResolutionView({
  roomId,
  sessionId,
  isHost,
  sessionRadiusM,
  deck,
}: {
  roomId: string;
  sessionId: string;
  isHost: boolean;
  sessionRadiusM: number;
  deck: DeckRestaurant[];
}) {
  if (!isHost) {
    // Non-hosts never call get_resolution_ranking (it raises NOT_HOST); they wait here
    // until the host accepts (→ /result via the match event) or widens (→ resume swiping).
    return (
      <section className="flex flex-col gap-md">
        <h2 className="text-display-lg-mobile text-text">Deck&rsquo;s done!</h2>
        <p className="text-body-md text-text-muted">
          Waiting on the host to decide…
        </p>
      </section>
    );
  }
  return (
    <HostResolution
      roomId={roomId}
      sessionId={sessionId}
      sessionRadiusM={sessionRadiusM}
      deck={deck}
    />
  );
}

function HostResolution({
  roomId,
  sessionId,
  sessionRadiusM,
  deck,
}: {
  roomId: string;
  sessionId: string;
  sessionRadiusM: number;
  deck: DeckRestaurant[];
}) {
  const rankingQuery = useResolutionRanking(sessionId, true);
  const resolve = useResolveSession(roomId, sessionId);

  // Widen criteria: start at the session's current radius and let the host raise it up to the
  // global cap, plus optional host-controlled cuisine narrowing for the next fetch (the widen
  // request accepts a partial filters set — CLAUDE.md §2.2). Empty cuisines = radius-only.
  const [widenRadiusM, setWidenRadiusM] = useState<number>(sessionRadiusM);
  const [widenCuisines, setWidenCuisines] = useState<CuisineId[]>([]);

  if (rankingQuery.isPending) {
    return <p className="text-body-md text-text-muted">Loading ranking…</p>;
  }
  if (rankingQuery.isError) {
    return (
      <p role="alert" className="text-body-md text-error">
        {rankingQuery.error.message}
      </p>
    );
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
      ? "Nobody's first choice"
      : "No Unanimous Match Yet";
  const subcopy = isEmpty
    ? "The deck is empty. Widen your search to pull in more places."
    : everyonePassed
      ? "Everyone passed on these — here's the best available pick. Settle for it or widen the search."
      : "You can settle for the group's favorite or widen your search.";

  // The ranking payload carries no photo; pull it from the already-cached deck by id (no
  // provider call — the deck is the session's one-time fetch, CLAUDE.md §2.1).
  const topPhotoUrl = topPick
    ? (deck.find((card) => card.id === topPick.restaurant_id)?.photo_url ??
      null)
    : null;

  function toggleCuisine(id: CuisineId) {
    setWidenCuisines((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

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
      // Only send filters when the host narrows by cuisine; otherwise widen stays radius-only.
      ...(widenCuisines.length > 0
        ? { filters: { cuisines: widenCuisines } }
        : {}),
    });
  }

  return (
    <section className="flex flex-col gap-md">
      <h2 className="text-display-lg-mobile text-text">{heading}</h2>
      <p className="text-body-md text-text-muted">{subcopy}</p>

      {topPick ? (
        <div className="flex flex-col gap-sm">
          <div className="flex items-center gap-xs">
            <Star size={14} className="text-brand" aria-hidden />
            <span className="text-label-md uppercase text-text-muted">
              Group&rsquo;s Top Pick
            </span>
          </div>
          <Card
            padding="decision"
            image={topPhotoUrl ?? undefined}
            imageAlt=""
            imageHeight={180}
          >
            <h3 className="text-headline-md text-text">{topPick.name}</h3>
            <div className="mt-xs flex items-center gap-base">
              {topPick.rating !== null ? (
                <ProgressPill
                  label={topPick.rating.toFixed(1)}
                  leadingIcon={
                    <Star size={12} className="text-brand" aria-hidden />
                  }
                />
              ) : null}
              <ProgressPill
                label={formatDistance(topPick.distance_m)}
                leadingIcon={
                  <MapPin size={12} className="text-heat" aria-hidden />
                }
              />
            </div>
            <p className="mt-sm text-body-md text-text-muted">
              {topPick.like_count}/{topPick.member_count} friends liked this
            </p>
          </Card>
        </div>
      ) : null}

      {resolve.isError ? (
        <p role="alert" className="text-body-md text-error">
          {resolve.error.message}
        </p>
      ) : null}

      {topPick ? (
        <Button
          label={busy ? "Working…" : "Settle for this"}
          onClick={handleAccept}
          disabled={busy}
          loading={busy}
          leadingIcon={<Check size={18} aria-hidden />}
        />
      ) : null}

      <div className="flex flex-col gap-sm">
        <div className="flex items-center gap-xs">
          <PlusCircle size={16} className="text-text" aria-hidden />
          <span className="text-title-lg text-text">Widen the Search</span>
        </div>
        <p className="text-body-md text-text-muted">
          Adjust your search to pull in more restaurants and keep the swiping
          going.
        </p>
        <RadiusSlider
          valueM={widenRadiusM}
          maxM={RADIUS_MAX_M}
          onChange={setWidenRadiusM}
        />
        <span className="text-label-md uppercase text-text-muted">Cuisine</span>
        <div className="flex flex-wrap gap-base">
          {CUISINES.map(({ id, label }) => (
            <FoodChip
              key={id}
              label={label}
              selected={widenCuisines.includes(id)}
              onClick={() => toggleCuisine(id)}
              disabled={busy}
            />
          ))}
        </div>
        <Button
          label={busy ? "Working…" : "Fetch New Deck"}
          variant="secondary"
          onClick={handleWiden}
          disabled={busy}
          loading={busy}
          leadingIcon={<RefreshCw size={18} aria-hidden />}
        />
      </div>
    </section>
  );
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
