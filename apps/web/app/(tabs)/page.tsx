"use client";

import {
  ChevronsRight,
  Coffee,
  Heart,
  Plus,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { Button, Card, Input } from "@/components/ui";

/**
 * Welcome / Home screen (10-pages.md §3.1, "Welcome to Munch"). The Match-tab root and the
 * room-flow entry point: a guest-by-default surface offering the two ways in — host a room
 * or join one by code. Thin by design (CLAUDE.md §4): the Create card routes into the create
 * flow and the Join card hands the typed code to the existing join flow; neither calls a data
 * endpoint here. Auth lives on the Profile tab now (10-pages.md §2/§3.2), so there is no sign-in
 * panel on this screen. The (tabs) layout supplies the <main> + centered container.
 */
export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  // Route the typed code into the existing join flow (which owns the join_room call + name
  // field). A blank code opens the bare join screen for manual entry. No wiring added here.
  function goToJoin() {
    const trimmed = code.trim();
    router.push(trimmed ? `/room/join/${trimmed}` : "/room/join");
  }

  return (
    <section className="flex flex-col gap-md">
      <div className="flex items-center gap-base">
        <UtensilsCrossed size={24} className="text-heat" aria-hidden />
        <span className="text-title-lg text-text">Munch</span>
      </div>

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
          <Button label="Join" variant="secondary" onClick={goToJoin} />
        </div>
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
