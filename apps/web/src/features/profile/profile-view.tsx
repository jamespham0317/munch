"use client";

import {
  ChevronRight,
  Clock,
  LogOut,
  Palette,
  User,
  UtensilsCrossed,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, ConfirmModal } from "@/components/ui";
import { AuthPanel } from "@/features/auth/auth-panel";
import { useCurrentUser } from "@/features/auth/use-current-user";
import { useOwnProfile } from "@/features/auth/use-own-profile";
import { useSignOut } from "@/features/auth/use-sign-out";

/**
 * Profile destination (10-pages.md §3.2, Stitch "User Profile - Signed In"). Signed-in users see
 * the profile hub — a fixed person icon (uneditable, no photo), their name + email, a "View Match
 * History" action that routes to the match-history screen, a disabled "Appearance" placeholder,
 * and a Sign Out button that ends the session after a confirm prompt (returning the user to the
 * guest gate below). Guests (anonymous, no profile — CLAUDE.md §3) keep the unchanged "sign in to
 * save" gate. Screens stay thin — data lives in the hooks / @munch/api-client (CLAUDE.md §4).
 */
export function ProfileView() {
  const userQuery = useCurrentUser();
  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;

  if (userQuery.isPending) {
    return <ProfileSkeleton />;
  }

  // Guest or not signed in: invite them to sign in (unchanged from the pre-redesign Profile
  // destination). Only the signed-in view is reskinned to the hub.
  if (!isSignedIn) {
    return (
      <section className="flex flex-col gap-md">
        <div className="flex flex-col items-center gap-sm text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand">
            <UtensilsCrossed size={32} className="text-on-brand" aria-hidden />
          </span>
          <h1 className="text-headline-md text-text">
            Sign in to save your history
          </h1>
          <p className="text-body-md text-text-muted">
            Don&apos;t lose your favorite matches and group picks!
          </p>
        </div>
        <AuthPanel mode="signin" />
      </section>
    );
  }

  return <SignedInHub email={userQuery.data?.email ?? null} />;
}

function SignedInHub({ email }: { email: string | null }) {
  const router = useRouter();
  const nameQuery = useOwnProfile();
  const signOut = useSignOut();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The profile name is the canonical label; fall back to the email local-part, then a neutral
  // label, so the header never renders blank while the profile read settles.
  const displayName = nameQuery.data ?? emailLocalPart(email) ?? "Your profile";

  return (
    <section className="flex flex-col gap-md">
      <div className="flex flex-col items-center gap-sm text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand">
          <User size={48} className="text-on-brand" aria-hidden />
        </span>
        <h1 className="text-display-lg-mobile text-text md:text-display-lg">
          {displayName}
        </h1>
        {email ? <p className="text-body-md text-text-muted">{email}</p> : null}
      </div>

      <Button
        label="View Match History"
        onClick={() => router.push("/history/matches")}
        leadingIcon={<Clock size={20} aria-hidden />}
      />

      <div className="flex flex-col gap-sm">
        <h2 className="text-title-lg text-text">Preferences</h2>
        <Card padding="none">
          {/* Disabled placeholder: no theming feature exists yet, so the row is shown
              greyed and non-interactive. */}
          <div
            aria-disabled
            className="pointer-events-none flex items-center justify-between p-md opacity-[0.45]"
          >
            <div className="flex items-center gap-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-highest">
                <Palette size={20} className="text-brand" aria-hidden />
              </span>
              <span className="text-body-lg text-text">Appearance</span>
            </div>
            <ChevronRight size={20} className="text-text-muted" aria-hidden />
          </div>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-xs pt-base">
        <Button
          label="Sign Out"
          variant="ghost"
          onClick={() => setConfirmOpen(true)}
          disabled={signOut.isPending}
          leadingIcon={<LogOut size={18} aria-hidden />}
        />
        {signOut.isError ? (
          <p role="alert" className="text-body-md text-error">
            {signOut.error.message}
          </p>
        ) : null}
      </div>

      <ConfirmModal
        open={confirmOpen}
        // On success the auth-identity invalidation flips ProfileView to the guest gate,
        // unmounting this hub (and the modal) — so we only need to close it on error.
        onConfirm={() =>
          signOut.mutate(undefined, { onError: () => setConfirmOpen(false) })
        }
        onDismiss={() => setConfirmOpen(false)}
        title="Sign out?"
        body="You'll need to sign in again to see your match history."
        confirmLabel="Sign Out"
        dismissLabel="Cancel"
        confirmLoading={signOut.isPending}
      />
    </section>
  );
}

/** Card-shaped placeholders so loading never shifts layout (10-pages.md §4). */
function ProfileSkeleton() {
  return (
    <section className="flex flex-col gap-md">
      <div className="flex flex-col items-center gap-sm">
        <div className="h-24 w-24 rounded-full bg-surface-raised" />
        <div className="h-8 w-44 rounded-sm bg-surface-raised" />
        <div className="h-4 w-36 rounded-sm bg-surface-raised" />
      </div>
      <div className="h-14 rounded-full bg-surface-raised" />
    </section>
  );
}

function emailLocalPart(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}
