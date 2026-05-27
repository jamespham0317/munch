import { StyleSheet, Text, View } from "react-native";

import { InvitePanel } from "../../components/invite-panel";
import { MemberList } from "../../components/member-list";
import { colors, spacing } from "../../theme";
import { AuthPanel } from "../auth/auth-panel";
import { useRoomLobby } from "./use-room-lobby";

/**
 * Room lobby (RN parity with apps/web's LobbyView): an initial getRoom + getRoomMembers
 * read kept live by subscribeRoom, an invite affordance, and the host-only "Start
 * session" placeholder (Phase 2). Screens stay thin — all data access is in
 * @munch/api-client (CLAUDE.md §4).
 */
export function LobbyView({ roomId }: { roomId: string }) {
  const { roomQuery, membersQuery, currentUserId, isGuest } =
    useRoomLobby(roomId);

  if (roomQuery.isPending || membersQuery.isPending) {
    return <Text style={styles.muted}>Loading lobby…</Text>;
  }
  if (roomQuery.isError) {
    return (
      <Text style={styles.error} accessibilityRole="alert">
        {roomQuery.error.message}
      </Text>
    );
  }
  if (membersQuery.isError) {
    return (
      <Text style={styles.error} accessibilityRole="alert">
        {membersQuery.error.message}
      </Text>
    );
  }

  const room = roomQuery.data;
  const members = membersQuery.data;
  const me = currentUserId
    ? members.find((member) => member.userId === currentUserId)
    : undefined;
  const isHost = me?.role === "host";

  return (
    <View style={styles.container}>
      <InvitePanel code={room.code} />
      <Text style={styles.heading}>Members</Text>
      <MemberList members={members} />
      {isHost ? (
        // Disabled placeholder — sessions arrive in Phase 2 (shared preamble).
        <View style={[styles.button, styles.buttonDisabled]}>
          <Text style={styles.buttonText}>Start session (Phase 2)</Text>
        </View>
      ) : (
        <Text style={styles.muted}>
          Waiting for the host to start the session…
        </Text>
      )}
      {/* Optional upgrade for guests — keeps their room membership (same user_id) and
          unlocks saved matches (CLAUDE.md §3). Never blocks the guest flow. */}
      {isGuest ? <AuthPanel mode="upgrade" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  heading: { color: colors.text, fontSize: 18, fontWeight: "600" },
  muted: { color: colors.textMuted },
  error: { color: colors.danger },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: "600" },
});
