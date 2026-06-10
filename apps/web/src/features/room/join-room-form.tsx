"use client";

import { joinRoomRequestSchema } from "@munch/core";
import { type FormEvent, useState } from "react";

import { Button, Field, Input } from "@/components/ui";

import { useJoinRoom } from "./use-join-room";

/**
 * Join-room form. `initialCode` pre-fills the field from the /room/join/{code}
 * link/QR target; a bare /room/join renders the same form with a blank code for
 * manual entry. Input is validated client-side against the @munch/core schema
 * (docs/06 §3); the server re-validates authoritatively. join_room failures surface the
 * api-client's friendly, code-mapped message (ROOM_NOT_FOUND / ROOM_CLOSED / ALREADY_JOINED /
 * RATE_LIMITED, and ROOM_IN_SESSION → "This room's session has already started." once a session
 * has started — joining is lobby-only, Phase 4.7 — docs/04 §3.2), never raw provider/DB text and
 * with no auto-retry.
 */
export function JoinRoomForm({ initialCode = "" }: { initialCode?: string }) {
  const joinRoom = useJoinRoom();

  const [code, setCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = joinRoomRequestSchema.safeParse({
      code: code.trim(),
      display_name: displayName,
    });
    if (!parsed.success) {
      setValidationError("Enter the 6-digit code and your name.");
      return;
    }
    setValidationError(null);
    joinRoom.mutate(parsed.data);
  }

  const errorMessage =
    validationError ?? (joinRoom.isError ? joinRoom.error.message : null);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      <Field label="Your name" htmlFor="join-name">
        <Input
          id="join-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={50}
          placeholder="e.g. Alex"
          autoComplete="name"
        />
      </Field>
      <Field label="Room code" htmlFor="join-code">
        <Input
          id="join-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          inputMode="numeric"
          maxLength={6}
          placeholder="e.g. 582901"
        />
      </Field>
      {errorMessage ? (
        <p role="alert" className="text-body-md text-error">
          {errorMessage}
        </p>
      ) : null}
      <Button
        type="submit"
        label={joinRoom.isPending ? "Joining…" : "Join room"}
        loading={joinRoom.isPending}
      />
    </form>
  );
}
