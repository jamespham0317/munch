import type { MatchHistory } from "@munch/core";
import { Link } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../theme";
import { AuthPanel } from "../auth/auth-panel";
import { useCurrentUser } from "../auth/use-current-user";
import { useMatchHistory } from "./use-match-history";

/**
 * Match-history screen (docs/01 §10, docs/05 §3), RN parity with apps/web's HistoryView.
 * Signed-in users see their saved matches; guests (anonymous, no profile — CLAUDE.md §3) get a
 * "sign in to save your matches" state and never fetch history. The signed-in test is the auth
 * identity's anonymity flag, not the presence of a user_id (guests have one too). Screens stay
 * thin — data access is in the hook / @munch/api-client (CLAUDE.md §4).
 */
export function HistoryView() {
  const userQuery = useCurrentUser();
  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  const historyQuery = useMatchHistory(isSignedIn);

  if (userQuery.isPending) {
    return <Text style={styles.muted}>Loading…</Text>;
  }

  // Guest or not signed in: invite them to sign in; do NOT read history (they have no rows).
  if (!isSignedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Sign in to save your matches</Text>
        <Text style={styles.muted}>
          Create an account and your matches will show up here.
        </Text>
        <AuthPanel mode="signin" />
        <Link href="/" style={styles.link}>
          Back home
        </Link>
      </View>
    );
  }

  if (historyQuery.isPending) {
    return <Text style={styles.muted}>Loading your matches…</Text>;
  }
  if (historyQuery.isError) {
    return (
      <Text style={styles.error} accessibilityRole="alert">
        {historyQuery.error.message}
      </Text>
    );
  }

  const history = historyQuery.data;
  if (history.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>
          No matches yet — start a room and find a place together.
        </Text>
        <Link href="/" style={styles.link}>
          Back home
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {history.map((entry) => (
          <HistoryRow key={entry.id} entry={entry} />
        ))}
      </View>
      <Link href="/" style={styles.link}>
        Back home
      </Link>
    </View>
  );
}

function HistoryRow({ entry }: { entry: MatchHistory }) {
  return (
    <View style={styles.row}>
      {entry.restaurantPhotoUrl ? (
        <Image
          source={{ uri: entry.restaurantPhotoUrl }}
          style={styles.photo}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <Text style={styles.name}>{entry.restaurantName}</Text>
      <Text style={styles.meta}>With {entry.participantNames.join(", ")}</Text>
      <Text style={styles.meta}>{formatDate(entry.decidedAt)}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  heading: { color: colors.text, fontSize: 22, fontWeight: "700" },
  list: { gap: spacing.md },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm / 2,
  },
  photo: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 12,
    backgroundColor: "#1f2937",
  },
  name: { color: colors.text, fontSize: 18, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 14 },
  muted: { color: colors.textMuted },
  error: { color: colors.danger },
  link: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600",
    paddingTop: spacing.sm,
  },
});
