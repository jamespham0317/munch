import { Screen } from "../../src/components/ui";
import { ProfileView } from "../../src/features/profile/profile-view";

/**
 * Profile tab root (10-pages.md §2/§3.2). Thin wrapper around ProfileView, which gates on the
 * signed-in vs. guest state: signed-in users get the profile hub (with "View Match History"),
 * guests get the "sign in to save" panel (CLAUDE.md §3, §4).
 */
export default function ProfileScreen() {
  return (
    <Screen>
      <ProfileView />
    </Screen>
  );
}
