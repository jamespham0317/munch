import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { MatchHistory } from "@munch/core";
import { useRouter } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";

import { Badge, Button, IconBadge } from "../../components/ui";
import { colors, radii, shadow, spacing, typography } from "../../theme";
import { useCurrentUser } from "../auth/use-current-user";
import { useMatchHistory } from "./use-match-history";

/**
 * Match-history list (10-pages.md §3.2), reached from the profile hub's "View Match History"
 * (ProfileView). Signed-in users see their saved matches; the read is gated on the signed-in
 * identity (guests have no rows — CLAUDE.md §3). A guest who deep-links here is bounced back to
 * the profile tab — the auth gate lives there. Screens stay thin — data access is in the hook /
 * @munch/api-client (CLAUDE.md §4).
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
      <View style={styles.container}>
        <Header />
        <Text style={styles.subtitle}>
          Sign in to see the places your group has matched on.
        </Text>
        <Button
          label="Go to Profile"
          variant="ghost"
          onPress={() => router.replace("/history")}
        />
      </View>
    );
  }

  if (historyQuery.isPending) {
    return <HistorySkeleton />;
  }
  if (historyQuery.isError) {
    return (
      <View style={styles.container}>
        <Header />
        <Text style={styles.error} accessibilityRole="alert">
          {historyQuery.error.message}
        </Text>
      </View>
    );
  }

  const history = historyQuery.data;
  return (
    <View style={styles.container}>
      <Header />
      {history.length > 0 && (
        <View style={styles.list}>
          {history.map((entry, index) => (
            <HistoryRow key={entry.id} entry={entry} index={index} />
          ))}
        </View>
      )}
      <CravingMore />
    </View>
  );
}

/** Deep-amber title + subtitle, matching the Stitch header. */
function Header() {
  return (
    <View style={styles.headerBlock}>
      <Text style={styles.title} accessibilityRole="header">
        Match History
      </Text>
      <Text style={styles.subtitle}>
        Revisit the spots where the magic happened.
      </Text>
    </View>
  );
}

/** Left-accent colors cycle amber → burnt-orange → deep-amber, like the mockup's three rows. */
const ACCENTS = [colors.brand, colors.heat, colors.brandDeep] as const;

function HistoryRow({ entry, index }: { entry: MatchHistory; index: number }) {
  const accent = ACCENTS[index % ACCENTS.length];
  return (
    <View style={[styles.row, shadow("shadowLow")]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      {entry.restaurantPhotoUrl ? (
        <Image
          source={{ uri: entry.restaurantPhotoUrl }}
          style={styles.thumb}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <MaterialCommunityIcons
            name="silverware-fork-knife"
            size={32}
            color={colors.brandDeep}
          />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.bodyTop}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.restaurantName}
          </Text>
          <Badge label={formatDate(entry.decidedAt)} tone="match" />
        </View>
        <View style={styles.metaRow}>
          <MaterialCommunityIcons
            name={participantIcon(entry.participantNames.length)}
            size={18}
            color={colors.textMuted}
          />
          <Text style={styles.meta} numberOfLines={1}>
            Matched with {formatParticipants(entry.participantNames)}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Persistent "Craving more?" hint (also the empty state). Text only — the Match tab starts a session. */
function CravingMore() {
  return (
    <View style={styles.craving}>
      <IconBadge
        variant="tonalCircle"
        icon={
          <MaterialCommunityIcons
            name="silverware-variant"
            size={32}
            color={colors.brandDeep}
          />
        }
      />
      <Text style={styles.cravingTitle}>Craving more?</Text>
      <Text style={styles.cravingBody}>
        Start a new session and find your next favorite meal with friends.
      </Text>
    </View>
  );
}

/** Card-shaped placeholders so loading never shifts layout (10-pages.md §4). */
function HistorySkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.skeletonTitle} />
      <View style={styles.list}>
        {[0, 1].map((key) => (
          <View key={key} style={[styles.row, shadow("shadowLow")]}>
            <View style={[styles.thumb, styles.skeletonBlock]} />
            <View style={styles.body}>
              <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
              <View style={styles.skeletonLine} />
            </View>
          </View>
        ))}
      </View>
    </View>
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

/** One / pair / group glyph, derived from the participant count (no data change). */
function participantIcon(
  count: number,
): "account" | "account-multiple" | "account-group" {
  if (count <= 1) return "account";
  if (count === 2) return "account-multiple";
  return "account-group";
}

/** Faint brand-amber fill for the no-photo tile — `brand` (#ffbf00) at 20% (mirrors Badge `match`). */
const BRAND_FILL = "rgba(255, 191, 0, 0.2)";

const ACCENT_WIDTH = 6;
const THUMB_SIZE = 80;

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  headerBlock: { gap: spacing.xs },
  title: { ...typography.displayLgMobile, color: colors.brandDeep },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
  list: { gap: spacing.gutter },
  error: { ...typography.bodyMd, color: colors.error },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.gutter,
    padding: spacing.gutter,
    paddingLeft: spacing.gutter + ACCENT_WIDTH,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSunken,
    overflow: "hidden",
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: ACCENT_WIDTH,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHighest,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_FILL,
  },
  body: { flex: 1, gap: spacing.xs },
  bodyTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  name: { ...typography.titleLg, color: colors.text, flexShrink: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  meta: { ...typography.bodyMd, color: colors.textMuted, flexShrink: 1 },

  craving: { alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  cravingTitle: { ...typography.titleLg, color: colors.text },
  cravingBody: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },

  skeletonTitle: {
    width: 220,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
  },
  skeletonBlock: { backgroundColor: colors.surfaceRaised },
  skeletonLine: {
    height: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
  },
  skeletonLineWide: { width: "70%" },
});
