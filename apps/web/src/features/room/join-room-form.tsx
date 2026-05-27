"use client";

import { joinRoomRequestSchema } from "@munch/core";
import { type FormEvent, useState } from "react";

import { useJoinRoom } from "./use-join-room";

/**
 * Join-room form. `initialCode` pre-fills the field from the /room/join/{code}
 * link/QR target; a bare /room/join renders the same form with a blank code for
 * manual entry. Input is validated client-side against the @munch/core schema
 * (docs/06 §3); the server re-validates authoritatively.
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
    <form onSubmit={handleSubmit}>
      <label>
        Room code
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
        />
      </label>
      <label>
        Your name
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={50}
        />
      </label>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <button type="submit" disabled={joinRoom.isPending}>
        {joinRoom.isPending ? "Joining…" : "Join room"}
      </button>
    </form>
  );
}
