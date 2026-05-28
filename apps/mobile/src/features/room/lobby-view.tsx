import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { InvitePanel } from "../../components/invite-panel";
import { MemberList } from "../../components/member-list";
import { colors, spacing } from "../../theme";
import { AuthPanel } from "../auth/auth-panel";
import { useStartSession } from "../session/use-start-session";
import { useRoomLobby } from "./use-room-lobby";

/**
 * Room lobby (RN parity with apps/web's LobbyView): an initial getRoom + getRoomMembers
 * read kept live by subscribeRoom, an invite affordance, and the host-only "Start
 * session" control. Once any member sees an active session for the room (via the
 * lobby's session subscription), they auto-route to the swipe screen. Screens stay
 * thin — all data access is in @munch/api-client (CLAUDE.md §4).
 */
export function LobbyView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { roomQuery, membersQuery, activeSession, currentUserId, isGuest } =
    useRoomLobby(roomId);
  const startSession = useStartSession(roomId);

  // Any member: route to the swipe screen the moment an active session exists. The
  // host also navigates via the start-session mutation's onSuccess, so this effect is
  // a no-op for them in the common path (router.replace is idempotent on the same URL)
  // and the safety net for non-host members.
  useEffect(() => {
    if (activeSession && activeSession.status === "active") {
      router.replace({
        pathname: "/room/[roomId]/session",
        params: { roomId, sessionId: activeSession.id },
      });
    }
  }, [activeSession, roomId, router]);

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

  function handleStart() {
    startSession.mutate({ radius_m: room.defaultRadiusM });
  }

  const startError = startSession.isError ? startSession.error.message : null;
  const startDisabled = startSession.isPending || activeSession !== null;

  return (
    <View style={styles.container}>
      <InvitePanel code={room.code} />
      <Text style={styles.heading}>Members</Text>
      <MemberList members={members} />
      {isHost ? (
        <>
          <Pressable
            style={[styles.button, startDisabled && styles.buttonDisabled]}
            onPress={handleStart}
            disabled={startDisabled}
          >
            <Text style={styles.buttonText}>
              {startSession.isPending ? "Starting…" : "Start session"}
            </Text>
          </Pressable>
          {startError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {startError}
            </Text>
          ) : null}
        </>
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
