"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useStartSession } from "@/features/session/use-start-session";

import { InvitePanel } from "./invite-panel";
import { LobbyFiltersPanel } from "./lobby-filters-panel";
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

  // Host-left ended state (CLAUDE.md §2.3 exception): when the host leaves mid-session the
  // session is cancelled AND the room is soft-closed (isActive=false). Members are routed here
  // from the swipe screen; show a defined ended screen with a way home rather than the normal
  // "waiting for the host" lobby, which would never resolve. The backend is unchanged.
  if (!room.isActive) {
    return (
      <section>
        <h2>The host ended the session</h2>
        <p>This room is closed.</p>
        <Link href="/">Back home</Link>
      </section>
    );
  }

  function handleStart() {
    startSession.mutate({ radius_m: room.defaultRadiusM });
  }

  const startError = startSession.isError ? startSession.error.message : null;

  return (
    <section>
      <InvitePanel code={room.code} />
      <h2>Members</h2>
      <MemberList members={members} />
      <LobbyFiltersPanel room={room} isHost={isHost} />
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
      {/* No mid-room sign-in (CLAUDE.md §3): a guest who joined this room stays a guest for it.
          Auth lives only outside a room (home + /history) — no auth control belongs here. */}
    </section>
  );
}
