import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, ConfirmModal } from "../../components/ui";
import { colors, radii, spacing, typography } from "../../theme";
import { AuthPanel } from "../auth/auth-panel";
import { useCurrentUser } from "../auth/use-current-user";
import { useOwnProfile } from "../auth/use-own-profile";
import { useSignOut } from "../auth/use-sign-out";

/**
 * Profile tab (10-pages.md §3.2, Stitch "User Profile - Signed In"). Signed-in users see the
 * profile hub — a fixed person icon (uneditable, no photo), their name + email, a "View Match
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
  // tab). Only the signed-in view is reskinned to the hub.
  if (!isSignedIn) {
    return (
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.guestAvatar}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={32}
              color={colors.onBrand}
            />
          </View>
          <Text style={styles.heading} accessibilityRole="header">
            Sign in to save your history
          </Text>
          <Text style={styles.subtitle}>
            Don&apos;t lose your favorite matches and group picks!
          </Text>
        </View>
        <AuthPanel mode="signin" />
      </View>
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
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Feather name="user" size={48} color={colors.onBrand} />
        </View>
        <Text style={styles.name} accessibilityRole="header">
          {displayName}
        </Text>
        {email ? <Text style={styles.subtitle}>{email}</Text> : null}
      </View>

      <Button
        label="View Match History"
        onPress={() => router.push("/profile/match-history")}
        leadingIcon={<Feather name="clock" size={20} color={colors.onBrand} />}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Card padding="none">
          {/* Disabled placeholder: no theming feature exists yet, so the row is shown
              greyed and non-interactive (no Pressable, no handler). */}
          <View style={styles.prefRow} accessibilityElementsHidden>
            <View style={styles.prefLeft}>
              <View style={styles.prefIcon}>
                <MaterialCommunityIcons
                  name="palette-outline"
                  size={20}
                  color={colors.brand}
                />
              </View>
              <Text style={styles.prefLabel}>Appearance</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </View>
        </Card>
      </View>

      <View style={styles.signOut}>
        <Button
          label="Sign Out"
          variant="ghost"
          onPress={() => setConfirmOpen(true)}
          disabled={signOut.isPending}
          leadingIcon={<Feather name="log-out" size={18} color={colors.text} />}
        />
        {signOut.isError ? (
          <Text style={styles.error} accessibilityRole="alert">
            {signOut.error.message}
          </Text>
        ) : null}
      </View>

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
    </View>
  );
}

/** Card-shaped placeholders so loading never shifts layout (10-pages.md §4). */
function ProfileSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={[styles.avatar, styles.skeletonFill]} />
        <View style={styles.skeletonName} />
        <View style={styles.skeletonEmail} />
      </View>
      <View style={styles.skeletonButton} />
    </View>
  );
}

function emailLocalPart(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  hero: { alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  guestAvatar: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    ...typography.displayLgMobile,
    color: colors.text,
    textAlign: "center",
  },
  heading: {
    ...typography.headlineMd,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
  },

  section: { gap: spacing.sm },
  sectionTitle: { ...typography.titleLg, color: colors.text },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    opacity: 0.45,
  },
  prefLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  prefIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  prefLabel: { ...typography.bodyLg, color: colors.text },

  signOut: { alignItems: "center", gap: spacing.xs, paddingTop: spacing.base },
  error: { ...typography.bodyMd, color: colors.error, textAlign: "center" },

  skeletonFill: { backgroundColor: colors.surfaceRaised },
  skeletonName: {
    width: 180,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
  },
  skeletonEmail: {
    width: 140,
    height: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
  },
  skeletonButton: {
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceRaised,
  },
});
