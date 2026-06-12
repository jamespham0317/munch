"use client";

import { joinRoomRequestSchema } from "@munch/core";
import { Lightbulb, Lock, User, Users, Utensils, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button, Card, Field, IconBadge, Input } from "@/components/ui";
import { useCurrentUser } from "@/features/auth/use-current-user";
import { useOwnProfile } from "@/features/auth/use-own-profile";

import { useJoinRoom } from "./use-join-room";

/** Display a raw 6-digit join code grouped as `582-901` (presentation only — the value
 *  submitted to join_room stays the raw digits, so validation is unchanged). */
function formatCode(raw: string): string {
  return raw.length === 6 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
}

/**
 * Join-room form, the INVITE-LINK target (/room/join/{code}). Manual code entry now lives on
 * the Match home (docs/10 §3.1) — only an invite link reaches this screen, so `initialCode` is
 * supplied and `lockCode` renders the code read-only: a host shared this exact code, so the
 * invitee may not edit it (docs/10 §3.4). Input is validated client-side against the @munch/core
 * schema (docs/06 §3); the server re-validates authoritatively. join_room failures surface the
 * api-client's friendly, code-mapped message (ROOM_NOT_FOUND / ROOM_CLOSED / ALREADY_JOINED /
 * RATE_LIMITED, and ROOM_IN_SESSION → "This room's session has already started." once a session
 * has started — joining is lobby-only, Phase 4.7 — docs/04 §3.2), never raw provider/DB text and
 * with no auto-retry. When `lockCode` and the join fails, the code is a dead end (it can't be
 * edited), so the action becomes a Cancel back to Match rather than a retry.
 *
 * A SIGNED-IN user (resolved `profiles` display name) skips the name field — they join by code
 * with their profile name (docs/10 §3.4). The gate is the resolved NAME, so a guest, and the
 * rare signed-in-but-no-profile state, both fall back to name entry and are never stuck. This
 * only chooses how the name is supplied; there is no mid-room sign-in here (docs/04 §2).
 */
export function JoinRoomForm({
  initialCode = "",
  lockCode = false,
}: {
  initialCode?: string;
  lockCode?: boolean;
}) {
  const router = useRouter();
  const joinRoom = useJoinRoom();
  const userQuery = useCurrentUser();
  const profileQuery = useOwnProfile();

  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  const resolvingName = isSignedIn && profileQuery.isLoading;
  const signedInName = isSignedIn ? (profileQuery.data ?? null) : null;

  const [code, setCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = joinRoomRequestSchema.safeParse({
      code: code.trim(),
      display_name: signedInName ?? displayName,
    });
    if (!parsed.success) {
      setValidationError(
        signedInName
          ? "Enter the 6-digit code."
          : "Enter the 6-digit code and your name.",
      );
      return;
    }
    setValidationError(null);
    joinRoom.mutate(parsed.data);
  }

  const errorMessage =
    validationError ?? (joinRoom.isError ? joinRoom.error.message : null);

  return (
    <div className="flex flex-col items-center gap-md">
      <Card className="w-full">
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          <div className="flex justify-center">
            <IconBadge icon={<Utensils size={32} aria-hidden />} />
          </div>
          {signedInName ? (
            <p className="text-body-md text-text-muted">
              Joining as <span className="text-text">{signedInName}</span>
            </p>
          ) : resolvingName ? (
            <p className="text-body-md text-text-muted">
              Loading your profile…
            </p>
          ) : (
            <Field label="Enter your name" htmlFor="join-name">
              <Input
                id="join-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={50}
                placeholder="Hungry Human"
                autoComplete="name"
                leadingIcon={<User size={20} aria-hidden />}
                className="rounded-full"
              />
            </Field>
          )}
          <Field label="Room code" htmlFor="join-code">
            <Input
              id="join-code"
              value={lockCode ? formatCode(code) : code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              maxLength={lockCode ? 7 : 6}
              placeholder="e.g. 582901"
              readOnly={lockCode}
              aria-readonly={lockCode || undefined}
              leadingIcon={<Lock size={20} aria-hidden />}
              className={
                lockCode
                  ? "cursor-not-allowed rounded-full bg-surface-highest text-headline-md text-text-muted"
                  : "rounded-full"
              }
            />
          </Field>
          {errorMessage ? (
            <p role="alert" className="text-body-md text-error">
              {errorMessage}
            </p>
          ) : null}
          {/* A locked (invite-link) code that the server rejects is a dead end — it can't
              be edited — so the action is a Cancel back to Match, not a retry (docs/10 §3.4). */}
          {lockCode && joinRoom.isError ? (
            <Button
              variant="text"
              label="Cancel"
              leadingIcon={<X size={20} aria-hidden />}
              onClick={() => router.replace("/")}
            />
          ) : (
            <Button
              type="submit"
              label={joinRoom.isPending ? "Joining…" : "Join the Squad"}
              loading={joinRoom.isPending}
              disabled={resolvingName}
              elevated
              trailingIcon={<Users size={20} aria-hidden />}
            />
          )}
        </form>
      </Card>
      <p className="flex items-center gap-xs text-caption text-text-faint">
        <Lightbulb size={16} aria-hidden />
        Joining a squad lets everyone vote on nearby restaurants.
      </p>
    </div>
  );
}
