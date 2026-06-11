import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { Screen } from "../../src/components/ui";
import { PasswordResetView } from "../../src/features/auth/password-reset-view";
import { colors, typography } from "../../src/theme";

/**
 * Password-reset screen (docs/05 §3), OUTSIDE any room. Thin wrapper: the recovery deep link
 * reopens the app at munch://auth/reset?code=… so the route forwards `code` to the view, which
 * handles both the request and the recovery-session update steps (CLAUDE.md §3, §4).
 */
export default function ResetScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return (
    <Screen contentStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        Reset password
      </Text>
      <PasswordResetView code={code} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // `flexGrow` lets the reset view fill the screen and pin any footer to the bottom;
  // the screen margin + gap come from the Screen scaffold.
  content: { flexGrow: 1 },
  title: { ...typography.displayLgMobile, color: colors.text },
});
