"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useStartSession } from "@/features/session/use-start-session";

import { AuthPanel } from "../auth/auth-panel";
import { InvitePanel } from "./invite-panel";
import { MemberList } from "./member-list";
import { useRoomLobby } from "./use-room-lobby";

/**
 * Room lobby: an initial getRoom + getRoomMembers read kept live by subscribeRoom,
 * an invite affordance, and the host-only "Start session" control. Once any member
 * sees an active session for the room (via the lobby's session subscription), they
 * auto-route to the swipe screen. Screens stay thin — all data access is in
 * @munch/api-client (CLAUDE.md §4).
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
      router.replace(`/room/${roomId}/session?sessionId=${activeSession.id}`);
    }
  }, [activeSession, roomId, router]);

  if (roomQuery.isPending || membersQuery.isPending) {
    return <p>Loading lobby…</p>;
  }
  if (roomQuery.isError) {
    return <p role="alert">{roomQuery.error.message}</p>;
  }
  if (membersQuery.isError) {
    return <p role="alert">{membersQuery.error.message}</p>;
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

  return (
    <section>
      <InvitePanel code={room.code} />
      <h2>Members</h2>
      <MemberList members={members} />
      {isHost ? (
        <>
          <button
            type="button"
            onClick={handleStart}
            disabled={startSession.isPending || activeSession !== null}
          >
            {startSession.isPending ? "Starting…" : "Start session"}
          </button>
          {startError ? <p role="alert">{startError}</p> : null}
        </>
      ) : (
        <p>Waiting for the host to start the session…</p>
      )}
      {/* Optional upgrade for guests — keeps their room membership (same user_id) and
          unlocks saved matches (CLAUDE.md §3). Never blocks the guest flow. */}
      {isGuest ? <AuthPanel mode="upgrade" /> : null}
    </section>
  );
}
