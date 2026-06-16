"use client";

import { PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button, IconBadge } from "@/components/ui";

/**
 * Post-registration success screen (10-pages.md §3.2, Stitch "Account Created Successfully"),
 * OUTSIDE any room. A celebratory hero shown after AuthPanel registers an email+password account.
 * Email confirmation stays ON (supabase/config.toml), so the user is NOT signed in here — the copy
 * points them to confirm, and the single CTA is "Go to Sign In" (the Profile tab, where the sign-in
 * surface lives) rather than the mockup's "Start a Session". Presentation only — no data, no
 * mutation, no provider call (CLAUDE.md §4); the celebratory hero reuses the tonalCircle IconBadge,
 * which carries no motion (§10).
 */
export function AccountCreatedView() {
  const router = useRouter();
  return (
    <section className="flex flex-col items-center gap-md text-center">
      <div className="flex flex-col items-center gap-sm">
        <IconBadge
          variant="tonalCircle"
          icon={<PartyPopper size={36} aria-hidden />}
        />
        <h1 className="text-display-lg-mobile text-text md:text-display-lg">
          Welcome to the Feast!
        </h1>
        <p className="max-w-[22rem] text-body-lg text-text-muted">
          Your account&apos;s been created. Check your email to confirm it, then
          sign in to find your next favorite meal.
        </p>
      </div>
      <div className="flex w-full flex-col gap-gutter">
        <Button
          label="Go to Sign In"
          onClick={() => router.replace("/history")}
        />
      </div>
    </section>
  );
}
