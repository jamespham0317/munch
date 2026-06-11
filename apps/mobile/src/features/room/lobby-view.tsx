import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Share, StyleSheet, Text, View } from "react-native";

import { buildJoinUrl, InvitePanel } from "../../components/invite-panel";
import { MemberList } from "../../components/member-list";
import { Button } from "../../components/ui/button";
import { ProgressPill } from "../../components/ui/progress-pill";
import { colors, spacing, typography } from "../../theme";
import { useStartSession } from "../session/use-start-session";
import { LeaveRoomControl } from "./leave-room-control";
import { LobbyFiltersButton, LobbyFiltersSummary } from "./lobby-filters-panel";
import { useRemovedRedirect } from "./use-removed-redirect";
import { useRoomExit } from "./use-room-exit";
import { useRoomLobby } from "./use-room-lobby";

/**
 * Room lobby (RN parity with apps/web's LobbyView, 10-pages.md §3.5): an initial getRoom +
 * getRoomMembers read kept live by subscribeRoom, the amber invite card + the "Squad" grid,
 * and the host-only "Start Session" control. Once any member sees an active session for the
 * room (via the lobby's session subscription), they auto-route to the swipe screen. Screens
 * stay thin — all data access is in @munch/api-client (CLAUDE.md §4); only aggregate presence
 * is shown, never per-member swipes (CLAUDE.md §3).
 */
export function LobbyView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const {
    roomQuery,
    membersQuery,
    activeSession,
    memberId,
    isHost,
    membersSettled,
    presence,
  } = useRoomLobby(roomId);
  const startSession = useStartSession(roomId);
  const exit = useRoomExit(roomId);

  // Route home if the caller is removed by something other than their own action — an auto-removal
  // after a dropped connection past the grace window (Phase 4.7). A self-initiated leave/end is
  // suppressed (it routes itself with "You left the room").
  useRemovedRedirect({
    memberId,
    settled: membersSettled,
    suppressedRef: exit.exitingRef,
  });

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

  // Host-left ended state (CLAUDE.md §2.3 exception): when the host leaves mid-session the
  // session is cancelled AND the room is soft-closed (isActive=false). Members are routed here
  // from the swipe screen; show a defined ended screen with a way home rather than the normal
  // "waiting for the host" lobby, which would never resolve. The backend is unchanged.
  if (!room.isActive) {
    return (
      <View style={styles.endedContainer}>
        <MaterialCommunityIcons
          name="silverware-clean"
          size={48}
          color={colors.textFaint}
        />
        <Text style={styles.title}>The host ended the session</Text>
        <Text style={styles.muted}>This room is closed.</Text>
        <Button
          label="Back home"
          variant="ghost"
          onPress={() => router.replace("/")}
        />
      </View>
    );
  }

  function handleStart() {
    startSession.mutate({ radius_m: room.defaultRadiusM });
  }

  async function handleInvite() {
    try {
      await Share.share({ message: buildJoinUrl(room.code) });
    } catch {
      // Sharing is best-effort; a dismissed or failed share is not surfaced.
    }
  }

  const startError = startSession.isError ? startSession.error.message : null;
  const startDisabled = startSession.isPending || activeSession !== null;

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <MaterialCommunityIcons
          name="silverware-fork-knife"
          size={24}
          color={colors.heat}
        />
        <Text style={styles.brand}>Munch</Text>
      </View>

      <Text style={styles.title} accessibilityRole="header">
        Waiting for the crew…
      </Text>
      <Text style={styles.subtitle}>Share this code or tap to copy link.</Text>

      <InvitePanel code={room.code} />

      <View style={styles.squadHeader}>
        <Text style={styles.squadTitle}>The Squad ({members.length})</Text>
        <View style={styles.squadHeaderRight}>
          {isHost ? <LobbyFiltersButton room={room} /> : null}
          <ProgressPill
            label="Waiting…"
            leadingIcon={
              <Feather name="clock" size={12} color={colors.textMuted} />
            }
          />
        </View>
      </View>
      <MemberList
        members={members}
        presence={presence}
        onInvite={() => void handleInvite()}
      />

      {!isHost ? <LobbyFiltersSummary room={room} /> : null}

      {isHost ? (
        <>
          <Button
            label={startSession.isPending ? "Starting…" : "Start Session"}
            onPress={handleStart}
            disabled={startDisabled}
            loading={startSession.isPending}
          />
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

      <LeaveRoomControl isHost={isHost} exit={exit} context="lobby" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  brand: { ...typography.titleLg, color: colors.text },
  title: { ...typography.displayLgMobile, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
  squadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  squadHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
  },
  squadTitle: { ...typography.headlineMd, color: colors.text },
  endedContainer: {
    gap: spacing.gutter,
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  muted: { ...typography.bodyMd, color: colors.textMuted },
  error: { ...typography.bodyMd, color: colors.error },
});
