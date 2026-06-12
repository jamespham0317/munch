import { FullScreenView } from "@/components/full-screen-view";
import { PasswordResetView } from "@/features/auth/password-reset-view";

/**
 * Password-reset route (docs/04 §2), OUTSIDE any room. Thin pass-through; the view handles both
 * the request and the recovery-session update steps (CLAUDE.md §4).
 */
export default function PasswordResetPage() {
  // No shell title/subtitle: the reset card owns its own centered headline + icon badge
  // per state (Stitch "Forgot Password"), so the FullScreenView contributes only the
  // brand row + cream canvas (docs/10 §3.2).
  return (
    <FullScreenView>
      <PasswordResetView />
    </FullScreenView>
  );
}
