import { Feather } from "@expo/vector-icons";
import {
  type CuisineId,
  CUISINES,
  type DeckRestaurant,
  RADIUS_MAX_M,
} from "@munch/core";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { FoodChip } from "../../components/ui/chip";
import { ProgressPill } from "../../components/ui/progress-pill";
import { RadiusSlider } from "../../components/ui/radius-slider";
import { colors, spacing, typography } from "../../theme";
import { useResolutionRanking } from "./use-resolution-ranking";
import { useResolveSession } from "./use-resolve-session";

/**
 * Host-resolution screen (RN parity with apps/web's ResolutionView; pages.md §3.8), shown
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
 * per-member identity (CLAUDE.md §3). The widen block's radius + cuisine criteria are
 * HOST-CONTROLLED room filters (CLAUDE.md §2.2), not a per-member narrow.
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
          Adjust your search to pull in more restaurants and keep the swiping
          going.
        </Text>
        <RadiusSlider
          valueM={widenRadiusM}
          maxM={RADIUS_MAX_M}
          onChange={setWidenRadiusM}
        />
        <Text style={styles.label}>Cuisine</Text>
        <View style={styles.chipWrap}>
          {CUISINES.map(({ id, label }) => (
            <FoodChip
              key={id}
              label={label}
              selected={widenCuisines.includes(id)}
              onPress={() => toggleCuisine(id)}
              disabled={busy}
            />
          ))}
        </View>
        <Button
          label={busy ? "Working…" : "Fetch New Deck"}
          variant="secondary"
          onPress={handleWiden}
          disabled={busy}
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
});
