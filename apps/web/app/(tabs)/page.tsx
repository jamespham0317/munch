"use client";

import { joinRoomRequestSchema } from "@munch/core";
import { ChevronsRight, Coffee, Heart, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { useCurrentUser } from "@/features/auth/use-current-user";
import { useOwnProfile } from "@/features/auth/use-own-profile";
import { useJoinRoom } from "@/features/room/use-join-room";

/**
 * Welcome / Home screen (10-pages.md §3.1, "Welcome to Munch"). The Match-tab root and the
 * room-flow entry point: a guest-by-default surface offering the two ways in — host a room
 * or join one by code. Thin by design (CLAUDE.md §4): the Create card routes into the create
 * flow. Auth lives on the Profile tab now (10-pages.md §2/§3.2), so there is no sign-in panel
 * on this screen. The (tabs) layout supplies the <main> + centered container.
 *
 * The Join card branches on auth (docs/10 §3.1): a GUEST (or unresolved name) is routed to the
 * /room/join/{code} screen, which owns the name field; a SIGNED-IN user joins inline with their
 * profile name (join_room here), so they skip the name prompt. The gate is the resolved NAME
 * (not the signed-in flag), so a profile still loading or missing safely takes the guest route.
 */
export default function HomePage() {
  const router = useRouter();
  const userQuery = useCurrentUser();
  const profileQuery = useOwnProfile();
  const joinRoom = useJoinRoom();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  const resolvingName = isSignedIn && profileQuery.isLoading;
  const signedInName = isSignedIn ? (profileQuery.data ?? null) : null;

  // Signed-in (resolved name) → join inline with the profile name (join_room routes to the
  // lobby on success). Guest / unresolved name → route the typed code into the join screen,
  // which owns the name field; a blank code opens the bare join screen for manual entry.
  function goToJoin() {
    const trimmed = code.trim();
    if (signedInName) {
      const parsed = joinRoomRequestSchema.safeParse({
        code: trimmed,
        display_name: signedInName,
      });
      if (!parsed.success) {
        setCodeError("Enter the 6-digit code.");
        return;
      }
      setCodeError(null);
      joinRoom.mutate(parsed.data);
      return;
    }
    router.push(trimmed ? `/room/join/${trimmed}` : "/room/join");
  }

  const joinError =
    codeError ?? (joinRoom.isError ? joinRoom.error.message : null);

  return (
    <section className="flex flex-col gap-md">
      <header className="flex flex-col gap-base">
        <h1 className="text-display-lg-mobile text-text md:text-display-lg">
          Ready to eat?
        </h1>
        <p className="text-body-md text-text-muted">
          Start a session with friends or join an existing one.
        </p>
      </header>

      <Link
        href="/room/create"
        className="block rounded-xl transition-transform active:translate-y-[var(--munch-press-translate-y)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40 motion-reduce:transition-none"
      >
        <Card surface="brand">
          <div className="flex flex-col gap-base">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-on-brand">
              <Plus size={22} className="text-brand" aria-hidden />
            </span>
            <span className="text-headline-md">Create a Room</span>
            <span className="text-body-md text-text-muted">
              Host a session and invite your crew.
            </span>
          </div>
        </Card>
      </Link>

      <Card className="flex flex-col gap-sm">
        <div className="flex items-center gap-base">
          <Users size={20} className="text-heat" aria-hidden />
          <span className="text-title-lg text-text">Join with Code</span>
        </div>
        <p className="text-caption text-text-muted">
          Got an invite? Enter the code below.
        </p>
        <div className="flex items-center gap-sm">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") goToJoin();
            }}
            inputMode="numeric"
            maxLength={6}
            placeholder="e.g. 582901"
            aria-label="Room code"
          />
          <Button
            label={joinRoom.isPending ? "Joining…" : "Join"}
            variant="secondary"
            onClick={goToJoin}
            loading={joinRoom.isPending}
            disabled={resolvingName}
          />
        </div>
        {joinError ? (
          <p role="alert" className="text-body-md text-error">
            {joinError}
          </p>
        ) : null}
      </Card>

      <h2 className="text-headline-md text-text">How Munch Works</h2>
      <div className="flex flex-col gap-sm">
        <Step
          tile="bg-heat text-on-heat"
          icon={<ChevronsRight size={20} aria-hidden />}
          title="1. Swipe & Like"
          body="Vote on restaurants anonymously."
        />
        <Step
          tile="bg-brand text-on-brand"
          icon={<Heart size={20} aria-hidden />}
          title="2. Find Matches"
          body="When everyone likes it, it's a match!"
        />
        <Step
          tile="bg-text text-background"
          icon={<Coffee size={20} aria-hidden />}
          title="3. Let's Eat"
          body="Stop arguing, start eating."
        />
      </div>
    </section>
  );
}

/** A single "How Munch Works" row: a colored circular icon tile + title/body. */
function Step({
  tile,
  icon,
  title,
  body,
}: {
  tile: string;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-center gap-gutter rounded-md bg-surface p-gutter shadow-low">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tile}`}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-xs">
        <span className="text-title-lg text-text">{title}</span>
        <span className="text-caption text-text-muted">{body}</span>
      </div>
    </div>
  );
}
