import { RADIUS_MAX_M, type RankingEntry } from "@munch/core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RadiusSlider } from "../../components/radius-slider";
import { colors, spacing } from "../../theme";
import { useResolutionRanking } from "./use-resolution-ranking";
import { useResolveSession } from "./use-resolve-session";

/**
 * Host-resolution screen (RN parity with apps/web's ResolutionView), shown while the session
 * status is `awaiting_host_resolution` (deck exhausted with no unanimous match — CLAUDE.md
 * §2.3). Non-host members see a passive "waiting on host" state and are routed onward by the
 * next status event; the host sees the closest-to-unanimous ranking (CLAUDE.md §2.4) with two
 * controls:
 *   * Accept top pick → resolve_session accept_top → result screen (host_accepted_top);
 *   * Widen → resolve_session widen (the only extra provider call, server-side) → the session
 *     returns to `active` and useSwipeSession resumes swiping with the appended cards. We don't
 *     navigate on widen; the status channel drives the resume.
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
    // until the host accepts (→ result via the match event) or widens (→ resume swiping).
    return (
      <View style={styles.container}>
        <Text style={styles.headline}>Deck’s done!</Text>
        <Text style={styles.muted}>Waiting on the host to decide…</Text>
      </View>
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
    <View style={styles.container}>
      <Text style={styles.headline}>No unanimous match</Text>
      <Text style={styles.muted}>
        Closest to unanimous — fewest passes first.
      </Text>
      {topPick === null ? (
        <Text style={styles.muted}>No restaurants to rank.</Text>
      ) : (
        <View style={styles.list}>
          {ranking.map((entry, index) => (
            <RankingRow
              key={entry.restaurant_id}
              entry={entry}
              isTopPick={index === 0}
            />
          ))}
        </View>
      )}

      {resolve.isError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {resolve.error.message}
        </Text>
      ) : null}

      <Pressable
        style={[
          styles.button,
          styles.accept,
          (busy || topPick === null) && styles.buttonDisabled,
        ]}
        onPress={handleAccept}
        disabled={busy || topPick === null}
      >
        <Text style={styles.buttonText}>
          {busy ? "Working…" : "Accept top pick"}
        </Text>
      </Pressable>

      <View style={styles.widen}>
        <RadiusSlider
          valueM={widenRadiusM}
          maxM={RADIUS_MAX_M}
          onChange={setWidenRadiusM}
        />
        <Pressable
          style={[
            styles.button,
            styles.widenButton,
            busy && styles.buttonDisabled,
          ]}
          onPress={handleWiden}
          disabled={busy}
        >
          <Text style={styles.buttonText}>
            {busy ? "Working…" : "Widen the search"}
          </Text>
        </Pressable>
      </View>
    </View>
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
    <View style={styles.row}>
      <Text style={styles.rowName}>
        {entry.name}
        {isTopPick ? " — suggested pick" : ""}
      </Text>
      <Text style={styles.rowMeta}>
        {entry.pass_count} of {entry.member_count} passed
        {entry.rating !== null ? ` · ⭐ ${entry.rating.toFixed(1)}` : ""}
        {` · ${formatDistance(entry.distance_m)}`}
      </Text>
    </View>
  );
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  headline: { color: colors.text, fontSize: 24, fontWeight: "700" },
  muted: { color: colors.textMuted },
  error: { color: colors.danger },
  list: { gap: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm / 2,
  },
  rowName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  rowMeta: { color: colors.textMuted, fontSize: 14 },
  button: {
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  accept: { backgroundColor: colors.accent },
  widen: { gap: spacing.sm },
  widenButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "600" },
});
