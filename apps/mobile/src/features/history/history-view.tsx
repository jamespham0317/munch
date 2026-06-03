import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { MatchHistory } from "@munch/core";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Badge, Button, Card } from "../../components/ui";
import { colors, radii, spacing, typography } from "../../theme";
import { AuthPanel } from "../auth/auth-panel";
import { useCurrentUser } from "../auth/use-current-user";
import { useMatchHistory } from "./use-match-history";

/**
 * Profile tab (pages.md §3.2, "Profile & Sign In Updated"), RN parity with apps/web's
 * HistoryView. Signed-in users see their saved matches; guests (anonymous, no profile —
 * CLAUDE.md §3) get the "sign in to save" state with the account panel and never fetch
 * history. The signed-in test is the auth identity's anonymity flag, not the presence of a
 * user_id (guests have one too). Screens stay thin — data access is in the hook /
 * @munch/api-client (CLAUDE.md §4).
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
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={32}
              color={colors.onBrand}
            />
          </View>
          <Text style={styles.heading} accessibilityRole="header">
            Sign in to save your history
          </Text>
          <Text style={styles.subtitle}>
            Don&apos;t lose your favorite matches and group picks!
          </Text>
        </View>
        <AuthPanel mode="signin" />
      </View>
    );
  }

  if (historyQuery.isPending) {
    return <HistorySkeleton />;
  }
  if (historyQuery.isError) {
    return (
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Your matches
        </Text>
        <Text style={styles.error} accessibilityRole="alert">
          {historyQuery.error.message}
        </Text>
      </View>
    );
  }

  const history = historyQuery.data;
  if (history.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Your matches
        </Text>
        <Text style={styles.subtitle}>
          No matches yet — start a room and find a place together.
        </Text>
        <CreateRoomButton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Your matches
      </Text>
      <View style={styles.list}>
        {history.map((entry) => (
          <HistoryRow key={entry.id} entry={entry} />
        ))}
      </View>
    </View>
  );
}

function CreateRoomButton() {
  const router = useRouter();
  return (
    <Button label="Create a room" onPress={() => router.push("/room/create")} />
  );
}

function HistoryRow({ entry }: { entry: MatchHistory }) {
  // Spread the image prop only when a photo exists: exactOptionalPropertyTypes forbids
  // passing `image={undefined}` against the optional `image?` prop.
  const imageProp = entry.restaurantPhotoUrl
    ? { image: { uri: entry.restaurantPhotoUrl }, imageHeight: 160 }
    : {};
  return (
    <Card {...imageProp}>
      <View style={styles.rowBody}>
        <Text style={styles.name}>{entry.restaurantName}</Text>
        <Text style={styles.meta}>
          With {entry.participantNames.join(", ")}
        </Text>
        <Badge
          label={formatDate(entry.decidedAt)}
          leadingIcon={
            <Feather name="calendar" size={12} color={colors.textMuted} />
          }
        />
      </View>
    </Card>
  );
}

/** Card-shaped placeholders so loading never shifts layout (pages.md §4). */
function HistorySkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.skeletonTitle} />
      <View style={styles.list}>
        {[0, 1].map((key) => (
          <Card key={key} padding="none">
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonText}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
            </View>
          </Card>
        ))}
      </View>
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
  hero: { alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.displayLgMobile, color: colors.text },
  heading: {
    ...typography.headlineMd,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
  },
  list: { gap: spacing.gutter },
  rowBody: { gap: spacing.base },
  name: { ...typography.titleLg, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.bodyMd, color: colors.error },

  skeletonTitle: {
    width: 180,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
  },
  skeletonImage: { height: 160, backgroundColor: colors.surfaceRaised },
  skeletonText: { padding: spacing.md, gap: spacing.sm },
  skeletonLine: {
    height: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
  },
  skeletonLineShort: { width: "60%" },
});
