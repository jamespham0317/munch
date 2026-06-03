import { FullScreenView } from "@/components/full-screen-view";
import { AuthCallbackView } from "@/features/auth/auth-callback-view";

/**
 * OAuth/redirect landing route (docs/04 §2), OUTSIDE any room. Thin pass-through; the view
 * completes the session and routes home (CLAUDE.md §4).
 */
export default function AuthCallbackPage() {
  return (
    <FullScreenView>
      <AuthCallbackView />
    </FullScreenView>
  );
}
