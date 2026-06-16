import { ProfileView } from "@/features/profile/profile-view";

/**
 * Profile destination route (10-pages.md §2/§3.2). Thin pass-through; ProfileView gates on the
 * signed-in vs. guest state: signed-in users get the profile hub (with "View Match History"),
 * guests get the "sign in to save" panel (CLAUDE.md §3, §4). The (tabs) layout supplies the
 * <main> + centered container.
 */
export default function ProfilePage() {
  return <ProfileView />;
}
