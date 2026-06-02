import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

import { PasswordResetView } from "../../src/features/auth/password-reset-view";
import { colors, spacing } from "../../src/theme";

/**
 * Password-reset screen (docs/05 §3), OUTSIDE any room. Thin wrapper: the recovery deep link
 * reopens the app at munch://auth/reset?code=… so the route forwards `code` to the view, which
 * handles both the request and the recovery-session update steps (CLAUDE.md §3, §4).
 */
export default function ResetScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Reset password</Text>
      <PasswordResetView code={code} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
});
