import { Feather } from "@expo/vector-icons";
import {
  type CuisineId,
  CUISINES,
  type DeckRestaurant,
  isNonNarrowingWiden,
  PRICE_LEVELS,
  type PriceLevel,
  RADIUS_MAX_M,
} from "@munch/core";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { FoodChip } from "../../components/ui/chip";
import { PriceTile } from "../../components/ui/price-tile";
import { ProgressPill } from "../../components/ui/progress-pill";
import { RadiusSlider } from "../../components/ui/radius-slider";
import { colors, spacing, typography } from "../../theme";
import { useResolutionRanking } from "./use-resolution-ranking";
import { useResolveSession } from "./use-resolve-session";

/** The session's snapshotted filters — the widen-only baseline (feature spec §5). */
export interface SessionFilters {
  openNow: boolean;
  cuisines: string[];
  priceLevels: PriceLevel[];
}

/**
 * Host-resolution screen (RN parity with apps/web's ResolutionView; 10-pages.md §3.8), shown
 * while the session status is `awaiting_host_resolution` (deck exhausted with no unanimous
 * match — CLAUDE.md §2.3). Non-host members see a passive "waiting on host" state and are
 * routed onward by the next status event; the host sees the closest-to-unanimous ranking
 * (CLAUDE.md §2.4 — displayed as-is, never re-sorted) with two controls:
 *   * Settle for this → resolve_session accept_top → result screen (host_accepted_top);
 *   * Widen → resolve_session widen (the only extra provider call, server-side) → the session
 *     returns to `active` and useSwipeSession resumes swiping with the appended cards. We don't
 *     navigate on widen; the status channel drives the resume.
 *
 * The "N/M friends liked this" pill is an AGGREGATE count (like_count of member_count), never
 * per-member identity (CLAUDE.md §3). The widen controls are HOST-CONTROLLED room filters
 * (CLAUDE.md §2.2) and may only BROADEN the pool, never narrow it (feature spec §5): radius
 * only increases, cuisines/prices can only be added or cleared to "any", open-now is locked.
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
    // until the host accepts (→ result via the match event) or widens (→ resume swiping).
    return (
      <View style={styles.container}>
        <Text style={styles.headline}>Deck's done!</Text>
        <Text style={styles.muted}>Waiting on the host to decide…</Text>
      </View>
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
    return <Text style={styles.muted}>Loading ranking…</Text>;
  }
  if (rankingQuery.isError) {
    return (
      <Text style={styles.error} accessibilityRole="alert">
        {rankingQuery.error.message}
      </Text>
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
    <View style={styles.container}>
      <Text style={styles.headline} accessibilityRole="header">
        {heading}
      </Text>
      <Text style={styles.muted}>{subcopy}</Text>

      {topPick ? (
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Feather name="star" size={14} color={colors.brand} />
            <Text style={styles.label}>Group's Top Pick</Text>
          </View>
          <Card
            padding="decision"
            image={topPhotoUrl ? { uri: topPhotoUrl } : undefined}
            imageHeight={180}
          >
            <Text style={styles.pickName}>{topPick.name}</Text>
            <View style={styles.metaRow}>
              {topPick.rating !== null ? (
                <ProgressPill
                  label={topPick.rating.toFixed(1)}
                  leadingIcon={
                    <Feather name="star" size={12} color={colors.brand} />
                  }
                />
              ) : null}
              <ProgressPill
                label={formatDistance(topPick.distance_m)}
                leadingIcon={
                  <Feather name="map-pin" size={12} color={colors.heat} />
                }
              />
            </View>
            <Text style={styles.liked}>
              {topPick.like_count}/{topPick.member_count} friends liked this
            </Text>
          </Card>
        </View>
      ) : null}

      {resolve.isError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {resolve.error.message}
        </Text>
      ) : null}

      {topPick ? (
        <Button
          label={busy ? "Working…" : "Settle for this"}
          onPress={handleAccept}
          disabled={busy}
          loading={busy}
          leadingIcon={
            <Feather name="check" size={18} color={colors.onBrand} />
          }
        />
      ) : null}

      <View style={styles.widen}>
        <View style={styles.labelRow}>
          <Feather name="plus-circle" size={16} color={colors.text} />
          <Text style={styles.widenTitle}>Widen the Search</Text>
        </View>
        <Text style={styles.muted}>
          Broaden your search to pull in more restaurants and keep the swiping
          going — you can reach farther, add cuisines, or add price ranges.
        </Text>

        <RadiusSlider
          valueM={widenRadiusM}
          minM={sessionRadiusM}
          maxM={RADIUS_MAX_M}
          onChange={setWidenRadiusM}
        />

        <Text style={styles.label}>Cuisine</Text>
        {cuisineRestricted ? (
          <View style={styles.chipWrap}>
            <FoodChip
              label="Any cuisine"
              selected={anyCuisine}
              onPress={() => setAnyCuisine((value) => !value)}
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
                  onPress={() => toggleAddedCuisine(id)}
                  disabled={busy || anyCuisine || locked}
                />
              );
            })}
          </View>
        ) : (
          <Text style={styles.muted}>All cuisines already included.</Text>
        )}

        <Text style={styles.label}>Price range</Text>
        {priceRestricted ? (
          <View style={styles.priceGroup}>
            <View style={styles.chipWrap}>
              <FoodChip
                label="Any price"
                selected={anyPrice}
                onPress={() => setAnyPrice((value) => !value)}
                disabled={busy}
              />
            </View>
            <View style={styles.tileRow}>
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
                    onPress={() => toggleAddedPrice(level)}
                    disabled={busy || anyPrice || locked}
                  />
                );
              })}
            </View>
          </View>
        ) : (
          <Text style={styles.muted}>All price ranges already included.</Text>
        )}

        <Button
          label={busy ? "Working…" : "Fetch New Deck"}
          variant="secondary"
          onPress={handleWiden}
          disabled={busy || !canWiden}
          loading={busy}
          leadingIcon={
            <Feather name="refresh-cw" size={18} color={colors.onHeat} />
          }
        />
      </View>
    </View>
  );
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  section: { gap: spacing.sm },
  headline: { ...typography.displayLgMobile, color: colors.text },
  muted: { ...typography.bodyMd, color: colors.textMuted },
  error: { ...typography.bodyMd, color: colors.error },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  label: { ...typography.labelMd, color: colors.textMuted },
  pickName: { ...typography.headlineMd, color: colors.text },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
    marginTop: spacing.xs,
  },
  liked: {
    ...typography.bodyMd,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  widen: { gap: spacing.sm },
  widenTitle: { ...typography.titleLg, color: colors.text },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.base },
  priceGroup: { gap: spacing.base },
  tileRow: { flexDirection: "row", gap: spacing.base },
});
