"use client";

import { Button } from "@/components/ui";

import { useRoomExit } from "./use-room-exit";

/**
 * The caller's own "Leave room" / "End room" control (Phase 4.7), rendered on both the lobby and
 * the swipe screen. A non-host leaves (server removes them + re-checks for an immediate match); the
 * host ends the room (soft-close + cancel, no transfer — CLAUDE.md invariant 3). Departure is
 * irreversible, so a native confirm gates the action before the mutation fires. Thin by design —
 * all the server logic and routing live in useRoomExit (CLAUDE.md §4).
 */
export function LeaveRoomControl({
  isHost,
  exit,
}: {
  isHost: boolean;
  exit: ReturnType<typeof useRoomExit>;
}) {
  const mutation = isHost ? exit.end : exit.leave;
  const label = isHost ? "End room" : "Leave room";
  const confirmMessage = isHost
    ? "End the room for everyone? This closes the session and can't be undone."
    : "Leave this room? You'll stop counting toward a match.";

  function handleClick() {
    if (typeof window !== "undefined" && !window.confirm(confirmMessage))
      return;
    mutation.mutate();
  }

  return (
    <div className="flex flex-col gap-xs">
      <Button
        label={mutation.isPending ? "Leaving…" : label}
        variant="ghost"
        onClick={handleClick}
        disabled={mutation.isPending}
        loading={mutation.isPending}
      />
      {mutation.isError ? (
        <p role="alert" className="text-body-md text-error">
          {mutation.error.message}
        </p>
      ) : null}
    </div>
  );
}
