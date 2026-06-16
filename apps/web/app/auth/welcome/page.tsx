import { FullScreenView } from "@/components/full-screen-view";
import { AccountCreatedView } from "@/features/auth/account-created-view";

/**
 * Account-created success route (docs/04 §2), OUTSIDE any room. Thin pass-through; AuthPanel
 * navigates here after a successful register. No shell title/subtitle — the view owns its own
 * celebratory hero, so FullScreenView contributes only the brand row + cream canvas (docs/10 §3.2),
 * exactly like auth/reset.
 */
export default function AccountCreatedPage() {
  return (
    <FullScreenView>
      <AccountCreatedView />
    </FullScreenView>
  );
}
