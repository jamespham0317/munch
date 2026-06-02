import { Link, useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { InvitePanel } from "../../components/invite-panel";
import { MemberList } from "../../components/member-list";
import { colors, spacing } from "../../theme";
import { useStartSession } from "../session/use-start-session";
import { LobbyFiltersPanel } from "./lobby-filters-panel";
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
  const { roomQuery, membersQuery, activeSession, currentUserId } =
    useRoomLobby(roomId);
  const startSession = useStartSession(roomId);

  // Any member: route to the session screen the moment a non-terminal session exists. We
  // route on BOTH `active` (the normal start) and `awaiting_host_resolution` — the latter is
  // the empty-initial-deck edge (start_session found zero spots and sent the host straight to
  // the widen control, Phase 4 decision); without it non-hosts would stay stuck in the lobby.
  // The host also navigates via the start-session mutation's onSuccess, so this effect is a
  // no-op for them in the common path (router.replace is idempotent) and the safety net for
  // non-host members.
  useEffect(() => {
    if (
      activeSession &&
      (activeSession.status === "active" ||
        activeSession.status === "awaiting_host_resolution")
    ) {
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

  // Host-left ended state (CLAUDE.md §2.3 exception): when the host leaves mid-session the
  // session is cancelled AND the room is soft-closed (isActive=false). Members are routed here
  // from the swipe screen; show a defined ended screen with a way home rather than the normal
  // "waiting for the host" lobby, which would never resolve. The backend is unchanged.
  if (!room.isActive) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>The host ended the session</Text>
        <Text style={styles.muted}>This room is closed.</Text>
        <Link href="/" style={styles.link}>
          Back home
        </Link>
      </View>
    );
  }

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
      <LobbyFiltersPanel room={room} isHost={isHost} />
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
      {/* No auth surface in a room (CLAUDE.md §3, Phase 4.5): a guest who joined a room stays a
          guest for that room. Sign-in/registration lives only on home and /history. */}
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
  link: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600",
    paddingTop: spacing.sm,
  },
});
