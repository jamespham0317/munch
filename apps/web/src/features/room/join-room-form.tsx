"use client";

import { joinRoomRequestSchema } from "@munch/core";
import {
  ArrowLeft,
  Lightbulb,
  Lock,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button, Card, Field, Input } from "@/components/ui";
import { useCurrentUser } from "@/features/auth/use-current-user";
import { useOwnProfile } from "@/features/auth/use-own-profile";

import { useJoinRoom } from "./use-join-room";

/**
 * Join-room form, the INVITE-LINK target (/room/join/{code}). Manual code entry now lives on
 * the Match home (docs/10 §3.1) — only an invite link reaches this screen, so `initialCode` is
 * supplied and `lockCode` renders the code read-only: a host shared this exact code, so the
 * invitee may not edit it (docs/10 §3.4). Input is validated client-side against the @munch/core
 * schema (docs/06 §3); the server re-validates authoritatively. join_room failures surface the
 * api-client's friendly, code-mapped message (ROOM_NOT_FOUND / ROOM_CLOSED / ALREADY_JOINED /
 * RATE_LIMITED, and ROOM_IN_SESSION → "This room's session has already started." once a session
 * has started — joining is lobby-only, Phase 4.7 — docs/04 §3.2), never raw provider/DB text and
 * with no auto-retry. A persistent `text` "Back" button (router.replace("/")) is the exit; when
 * `lockCode` and the join fails the code is a dead end (it can't be edited), so the primary Join
 * button is disabled and Back is the way out rather than a futile retry.
 *
 * A SIGNED-IN user (resolved `profiles` display name) skips the name field — they join by code
 * with their profile name (docs/10 §3.4). The gate is the resolved NAME, so a guest, and the
 * rare signed-in-but-no-profile state, both fall back to name entry and are never stuck. This
 * only chooses how the name is supplied; there is no mid-room sign-in here (docs/04 §2).
 *
 * Layout mirrors the Sign In page (`HistoryView` signed-out hero): a centered icon + `title` +
 * `subtitle` hero above a full-width Card. The route passes the per-entry copy via `title` /
 * `subtitle` (docs/10 §3.4).
 */
export function JoinRoomForm({
  title,
  subtitle,
  initialCode = "",
  lockCode = false,
}: {
  title: string;
  subtitle: string;
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
      <div className="flex flex-col items-center gap-sm text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand">
          <UtensilsCrossed size={32} className="text-on-brand" aria-hidden />
        </span>
        <h1 className="text-headline-md text-text">{title}</h1>
        <p className="text-body-md text-text-muted">{subtitle}</p>
      </div>
      <Card className="w-full">
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          {signedInName ? (
            <Field label="Your name" htmlFor="join-name">
              <Input
                id="join-name"
                value={signedInName}
                readOnly
                aria-readonly
                leadingIcon={<Lock size={20} aria-hidden />}
                className="cursor-not-allowed bg-surface-highest text-body-md font-bold text-text-muted"
              />
            </Field>
          ) : resolvingName ? (
            <p className="text-body-md text-text-muted">
              Loading your profile…
            </p>
          ) : (
            <Field label="Your name" htmlFor="join-name">
              <Input
                id="join-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={50}
                placeholder="Your name"
                autoComplete="name"
              />
            </Field>
          )}
          <Field label="Room code" htmlFor="join-code">
            <Input
              id="join-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="e.g. 582901"
              readOnly={lockCode}
              aria-readonly={lockCode || undefined}
              leadingIcon={<Lock size={20} aria-hidden />}
              className={
                lockCode
                  ? "cursor-not-allowed bg-surface-highest text-body-md font-bold text-text-muted"
                  : undefined
              }
            />
          </Field>
          {errorMessage ? (
            <p role="alert" className="text-body-md text-error">
              {errorMessage}
            </p>
          ) : null}
          <Button
            type="submit"
            label={joinRoom.isPending ? "Joining…" : "Join the Squad"}
            loading={joinRoom.isPending}
            // A locked (invite-link) code the server rejects is a dead end — it can't be
            // edited, so a retry is futile; disable Join and let Back be the exit
            // (docs/10 §3.4).
            disabled={resolvingName || (lockCode && joinRoom.isError)}
            trailingIcon={<Users size={20} aria-hidden />}
          />
          <Button
            type="button"
            variant="text"
            label="Back"
            leadingIcon={<ArrowLeft size={20} aria-hidden />}
            onClick={() => router.replace("/")}
          />
        </form>
      </Card>
      <p className="flex items-center gap-xs text-caption text-text-faint">
        <Lightbulb size={16} aria-hidden />
        Joining a squad lets everyone vote on nearby restaurants.
      </p>
    </div>
  );
}
