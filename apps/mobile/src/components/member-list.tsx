import type { RoomMember } from "@munch/core";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme";

/**
 * Presence-aware member list. Presentational only — receives the already-mapped
 * RoomMember[] and renders it; no data access or domain logic (CLAUDE.md §4). The
 * list is small (room members), so a plain map is preferred over a FlatList, which
 * must not nest inside the lobby's ScrollView.
 */
export function MemberList({ members }: { members: RoomMember[] }) {
  if (members.length === 0) {
    return <Text style={styles.muted}>No one here yet.</Text>;
  }
  return (
    <View style={styles.list}>
      {members.map((member) => (
        <View key={member.id} style={styles.row}>
          <Text style={styles.dot} accessibilityElementsHidden>
            {member.isPresent ? "🟢" : "⚪️"}
          </Text>
          <Text style={styles.name}>
            {member.displayName}
            {member.role === "host" ? " · host" : ""}
            {member.isPresent ? "" : " · away"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { fontSize: 12 },
  name: { color: colors.text, fontSize: 16 },
  muted: { color: colors.textMuted },
});
