"use client";

import { Clock, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button, ProgressPill } from "@/components/ui";
import { useStartSession } from "@/features/session/use-start-session";

import { buildJoinUrl, InvitePanel } from "./invite-panel";
import { LeaveRoomControl } from "./leave-room-control";
import { LobbyFiltersPanel } from "./lobby-filters-panel";
import { MemberList } from "./member-list";
import { useRemovedRedirect } from "./use-removed-redirect";
import { useRoomExit } from "./use-room-exit";
import { useRoomLobby } from "./use-room-lobby";

/**
 * Room lobby (10-pages.md §3.5, "Lobby with QR Code"): an initial getRoom + getRoomMembers read
 * kept live by subscribeRoom, the amber invite card + the "Squad" grid, and the host-only
 * "Start Session" control. Once any member sees an active session for the room (via the
 * lobby's session subscription), they auto-route to the swipe screen. Screens stay thin — all
 * data access is in @munch/api-client (CLAUDE.md §4); only aggregate presence is shown, never
 * per-member swipes (CLAUDE.md §3). Web twin of the Phase B mobile LobbyView.
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
      router.replace(`/room/${roomId}/session?sessionId=${activeSession.id}`);
    }
  }, [activeSession, roomId, router]);

  if (roomQuery.isPending || membersQuery.isPending) {
    return <p className="text-body-md text-text-muted">Loading lobby…</p>;
  }
  if (roomQuery.isError) {
    return (
      <p role="alert" className="text-body-md text-error">
        {roomQuery.error.message}
      </p>
    );
  }
  if (membersQuery.isError) {
    return (
      <p role="alert" className="text-body-md text-error">
        {membersQuery.error.message}
      </p>
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
      <section className="flex flex-col items-center gap-gutter py-xl text-center">
        <UtensilsCrossed size={48} className="text-text-faint" aria-hidden />
        <h2 className="text-headline-md text-text">
          The host ended the session
        </h2>
        <p className="text-body-md text-text-muted">This room is closed.</p>
        <Button
          label="Back home"
          variant="ghost"
          onClick={() => router.replace("/")}
        />
      </section>
    );
  }

  function handleStart() {
    startSession.mutate({ radius_m: room.defaultRadiusM });
  }

  async function handleInvite() {
    const url = buildJoinUrl(room.code);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Sharing is best-effort; a dismissed or failed share/copy is not surfaced.
    }
  }

  const startError = startSession.isError ? startSession.error.message : null;
  const startDisabled = startSession.isPending || activeSession !== null;

  return (
    <section className="flex flex-col gap-md">
      <div className="flex items-center gap-base">
        <UtensilsCrossed size={24} className="text-heat" aria-hidden />
        <span className="text-title-lg text-text">Munch</span>
      </div>

      <header className="flex flex-col gap-base">
        <h1 className="text-display-lg-mobile text-text md:text-display-lg">
          Waiting for the crew…
        </h1>
        <p className="text-body-md text-text-muted">
          Share this code or tap to copy the link.
        </p>
      </header>

      <InvitePanel code={room.code} />

      <div className="flex items-center justify-between">
        <h2 className="text-headline-md text-text">
          The Squad ({members.length})
        </h2>
        <ProgressPill
          label="Waiting…"
          leadingIcon={
            <Clock size={12} className="text-text-muted" aria-hidden />
          }
        />
      </div>
      <MemberList
        members={members}
        presence={presence}
        onInvite={() => void handleInvite()}
      />

      <LobbyFiltersPanel room={room} isHost={isHost} />

      {isHost ? (
        <>
          <Button
            label={startSession.isPending ? "Starting…" : "Start Session"}
            onClick={handleStart}
            disabled={startDisabled}
            loading={startSession.isPending}
          />
          {startError ? (
            <p role="alert" className="text-body-md text-error">
              {startError}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-body-md text-text-muted">
          Waiting for the host to start the session…
        </p>
      )}
      {/* No mid-room sign-in (CLAUDE.md §3): a guest who joined this room stays a guest for it.
          Auth lives only outside a room (Profile tab + /history) — no auth control belongs here. */}

      <LeaveRoomControl isHost={isHost} exit={exit} />
    </section>
  );
}
