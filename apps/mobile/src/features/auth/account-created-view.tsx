import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button, IconBadge } from "../../components/ui";
import { colors, spacing, typography } from "../../theme";

/**
 * Post-registration success screen (RN parity with apps/web's AccountCreatedView; 10-pages.md §3.2,
 * Stitch "Account Created Successfully"), OUTSIDE any room. A celebratory hero shown after AuthPanel
 * registers an email+password account. Email confirmation stays ON (supabase/config.toml), so the
 * user is NOT signed in here — the copy points them to confirm, and the primary CTA is "Go to Sign
 * In" (the Profile tab, where the sign-in surface lives) rather than the mockup's "Start a Session".
 * router.replace so the (tabs) screen's animationTypeForReplace="pop" carries /history in from the
 * LEFT. Presentation only — no data, no mutation, no provider call (CLAUDE.md §4); the tonalCircle
 * IconBadge carries no motion (§10).
 */
export function AccountCreatedView() {
  const router = useRouter();
  return (
    <View style={styles.outer}>
      <View style={styles.hero}>
        <IconBadge
          variant="tonalCircle"
          icon={
            <MaterialCommunityIcons
              name="party-popper"
              size={36}
              color={colors.brandDeep}
            />
          }
        />
        <Text style={styles.headline} accessibilityRole="header">
          Welcome to the Feast!
        </Text>
        <Text style={styles.subtext}>
          Your account&apos;s been created. Check your email to confirm it, then
          sign in to find your next favorite meal.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label="Go to Sign In"
          onPress={() => router.replace("/history")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { gap: spacing.md },
  hero: { alignItems: "center", gap: spacing.sm },
  actions: { gap: spacing.gutter },
  headline: {
    ...typography.displayLgMobile,
    color: colors.text,
    textAlign: "center",
  },
  subtext: {
    ...typography.bodyLg,
    color: colors.textMuted,
    textAlign: "center",
  },
});
