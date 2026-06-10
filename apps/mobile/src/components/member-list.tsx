import type { RoomMember } from "@munch/core";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, typography } from "../theme";
import { Avatar } from "./ui/avatar";

/**
 * "The Squad" grid (10-pages.md §3.5): the ACTIVE roster in a 2-column layout, each an Avatar
 * (initials + green dot) plus the display name and a Here/Away label. Presence is COSMETIC
 * (Phase 4.7): the dot/label come from the Realtime Presence map (`focused`), never from a DB
 * field and never read by matchmaking (CLAUDE.md §2.3/§3). A focused member shows the green dot +
 * "Here"; a connected-but-unfocused or briefly-absent member shows no dot + "Away" but stays
 * listed as long as they're an active member (a member who left is excluded upstream by
 * getRoomMembers). The trailing "Invite more" tile fires the caller's share handler.
 * Presentational only — no data access or domain logic (CLAUDE.md §4). The list is small (room
 * members), so a plain map is preferred over a FlatList, which must not nest inside the lobby's
 * ScrollView.
 */
export function MemberList({
  members,
  presence,
  onInvite,
}: {
  members: RoomMember[];
  /** Cosmetic Realtime Presence, keyed by member id; absence ⇒ no dot, "Away". */
  presence: Map<string, { focused: boolean }>;
  onInvite?: () => void;
}) {
  return (
    <View style={styles.grid}>
      {members.map((member) => {
        const focused = presence.get(member.id)?.focused ?? false;
        return (
          <View key={member.id} style={styles.tile}>
            <Avatar label={initials(member.displayName)} online={focused} />
            <Text style={styles.name} numberOfLines={1}>
              {member.displayName}
              {member.role === "host" ? " · host" : ""}
            </Text>
            <Text style={styles.status}>{focused ? "Here" : "Away"}</Text>
          </View>
        );
      })}
      {onInvite ? (
        <Pressable
          onPress={onInvite}
          accessibilityRole="button"
          accessibilityLabel="Invite more"
          style={({ pressed }) => [
            styles.tile,
            styles.inviteTile,
            pressed && styles.pressed,
          ]}
        >
          <Avatar variant="add" />
          <Text style={styles.status}>Invite more</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Up to two initials from a display name; falls back to "?" for an empty name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const last = parts[parts.length - 1];
  if (parts.length === 1 || !last) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.gutter },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    ...shadow("shadowLow"),
  },
  inviteTile: { justifyContent: "center" },
  pressed: { transform: [{ translateY: 2 }] },
  name: { ...typography.bodyMd, color: colors.text },
  status: { ...typography.caption, color: colors.textMuted },
});
