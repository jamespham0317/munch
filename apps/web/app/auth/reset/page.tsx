import { FullScreenView } from "@/components/full-screen-view";
import { PasswordResetView } from "@/features/auth/password-reset-view";

/**
 * Password-reset route (docs/04 §2), OUTSIDE any room. Thin pass-through; the view handles both
 * the request and the recovery-session update steps (CLAUDE.md §4).
 */
export default function PasswordResetPage() {
  return (
    <FullScreenView
      title="Reset password"
      subtitle="We'll email you a link to set a new password."
    >
      <PasswordResetView />
    </FullScreenView>
  );
}
