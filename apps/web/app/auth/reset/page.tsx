import { PasswordResetView } from "@/features/auth/password-reset-view";

/**
 * Password-reset route (docs/04 §2), OUTSIDE any room. Thin pass-through; the view handles both
 * the request and the recovery-session update steps (CLAUDE.md §4).
 */
export default function PasswordResetPage() {
  return (
    <main>
      <h1>Reset password</h1>
      <PasswordResetView />
    </main>
  );
}
