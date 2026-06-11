"use client";

import {
  type CuisineId,
  CUISINES,
  type DeckRestaurant,
  isNonNarrowingWiden,
  PRICE_LEVELS,
  type PriceLevel,
  RADIUS_MAX_M,
} from "@munch/core";
import { Check, MapPin, PlusCircle, RefreshCw, Star } from "lucide-react";
import { useState } from "react";

import { RadiusSlider } from "@/components/radius-slider";
import {
  Button,
  Card,
  FoodChip,
  PriceTile,
  ProgressPill,
} from "@/components/ui";

import { useResolutionRanking } from "./use-resolution-ranking";
import { useResolveSession } from "./use-resolve-session";

/** The session's snapshotted filters — the widen-only baseline (feature spec §5). */
export interface SessionFilters {
  openNow: boolean;
  cuisines: string[];
  priceLevels: PriceLevel[];
}

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
 * per-member identity (CLAUDE.md §3). The widen controls are HOST-CONTROLLED room filters
 * (CLAUDE.md §2.2) and may only BROADEN the pool, never narrow it (feature spec §5): radius
 * only increases, cuisines/prices can only be added or cleared to "any", open-now is locked.
 * Web twin of the Phase B mobile ResolutionView.
 */
export function ResolutionView({
  roomId,
  sessionId,
  isHost,
  sessionRadiusM,
  sessionFilters,
  deck,
}: {
  roomId: string;
  sessionId: string;
  isHost: boolean;
  sessionRadiusM: number;
  sessionFilters: SessionFilters;
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
      sessionFilters={sessionFilters}
      deck={deck}
    />
  );
}

function HostResolution({
  roomId,
  sessionId,
  sessionRadiusM,
  sessionFilters,
  deck,
}: {
  roomId: string;
  sessionId: string;
  sessionRadiusM: number;
  sessionFilters: SessionFilters;
  deck: DeckRestaurant[];
}) {
  const rankingQuery = useResolutionRanking(sessionId, true);
  const resolve = useResolveSession(roomId, sessionId);

  // Widen criteria are WIDEN-ONLY (feature spec §5): the deck can only grow.
  //   * radius — slider floored at the session radius, so it can only increase;
  //   * cuisine/price — the session's current selections are locked-on; the host may ADD more
  //     or clear the restriction to "any" ([]), but never drop a locked value. An empty session
  //     filter is already "all" (the widest), so that control is shown but disabled.
  const cuisineRestricted = sessionFilters.cuisines.length > 0;
  const priceRestricted = sessionFilters.priceLevels.length > 0;

  const [widenRadiusM, setWidenRadiusM] = useState<number>(sessionRadiusM);
  const [anyCuisine, setAnyCuisine] = useState<boolean>(!cuisineRestricted);
  const [addedCuisines, setAddedCuisines] = useState<CuisineId[]>([]);
  const [anyPrice, setAnyPrice] = useState<boolean>(!priceRestricted);
  const [addedPrices, setAddedPrices] = useState<PriceLevel[]>([]);

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

  // Effective filters the widen will request. "Any" → [] (broadest); otherwise the locked
  // session set plus the host's additions (deduped).
  const effectiveCuisines: string[] = anyCuisine
    ? []
    : Array.from(
        new Set<string>([...sessionFilters.cuisines, ...addedCuisines]),
      );
  const effectivePriceLevels: PriceLevel[] = anyPrice
    ? []
    : Array.from(
        new Set<PriceLevel>([...sessionFilters.priceLevels, ...addedPrices]),
      );

  // Defensive guard mirroring the server (feature spec §5): the controls already construct a
  // non-narrowing request, so this should always hold — it just blocks a malformed submit.
  const canWiden = isNonNarrowingWiden(
    {
      radiusM: sessionRadiusM,
      openNow: sessionFilters.openNow,
      cuisines: sessionFilters.cuisines,
      priceLevels: sessionFilters.priceLevels,
    },
    {
      radiusM: widenRadiusM,
      openNow: sessionFilters.openNow,
      cuisines: effectiveCuisines,
      priceLevels: effectivePriceLevels,
    },
  );

  function toggleAddedCuisine(id: CuisineId) {
    setAddedCuisines((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function toggleAddedPrice(level: PriceLevel) {
    setAddedPrices((current) =>
      current.includes(level)
        ? current.filter((value) => value !== level)
        : [...current, level],
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
    if (busy || !canWiden) return;
    resolve.mutate({
      action: "widen",
      session_id: sessionId,
      radius_m: widenRadiusM,
      // open_now is omitted on purpose (locked — the server keeps the session value).
      filters: {
        cuisines: effectiveCuisines,
        price_levels: effectivePriceLevels,
      },
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
          Broaden your search to pull in more restaurants and keep the swiping
          going — you can reach farther, add cuisines, or add price ranges.
        </p>

        <RadiusSlider
          valueM={widenRadiusM}
          minM={sessionRadiusM}
          maxM={RADIUS_MAX_M}
          onChange={setWidenRadiusM}
        />

        <span className="text-label-md uppercase text-text-muted">Cuisine</span>
        {cuisineRestricted ? (
          <div className="flex flex-wrap gap-base">
            <FoodChip
              label="Any cuisine"
              selected={anyCuisine}
              onClick={() => setAnyCuisine((value) => !value)}
              disabled={busy}
            />
            {CUISINES.map(({ id, label }) => {
              const locked = sessionFilters.cuisines.includes(id);
              return (
                <FoodChip
                  key={id}
                  label={label}
                  selected={
                    !anyCuisine && (locked || addedCuisines.includes(id))
                  }
                  onClick={() => toggleAddedCuisine(id)}
                  disabled={busy || anyCuisine || locked}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-body-md text-text-muted">
            All cuisines already included.
          </p>
        )}

        <span className="text-label-md uppercase text-text-muted">
          Price range
        </span>
        {priceRestricted ? (
          <div className="flex flex-col gap-base">
            <div className="flex flex-wrap gap-base">
              <FoodChip
                label="Any price"
                selected={anyPrice}
                onClick={() => setAnyPrice((value) => !value)}
                disabled={busy}
              />
            </div>
            <div className="flex gap-base">
              {PRICE_LEVELS.map(({ level, caption }) => {
                const locked = sessionFilters.priceLevels.includes(level);
                return (
                  <PriceTile
                    key={level}
                    label={"$".repeat(Number(level))}
                    caption={caption}
                    selected={
                      !anyPrice && (locked || addedPrices.includes(level))
                    }
                    onClick={() => toggleAddedPrice(level)}
                    disabled={busy || anyPrice || locked}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-body-md text-text-muted">
            All price ranges already included.
          </p>
        )}

        <Button
          label={busy ? "Working…" : "Fetch New Deck"}
          variant="secondary"
          onClick={handleWiden}
          disabled={busy || !canWiden}
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
