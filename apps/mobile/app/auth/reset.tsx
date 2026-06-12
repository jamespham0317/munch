import { useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";

import { Screen } from "../../src/components/ui";
import { PasswordResetView } from "../../src/features/auth/password-reset-view";

/**
 * Password-reset screen (docs/05 §3), OUTSIDE any room. Thin wrapper: the recovery deep link
 * reopens the app at munch://auth/reset?code=… so the route forwards `code` to the view, which
 * handles both the request and the recovery-session update steps (CLAUDE.md §3, §4). No screen
 * title: the reset card owns its own centered headline + icon badge per state (Stitch "Forgot
 * Password", docs/10 §3.2).
 */
export default function ResetScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return (
    <Screen contentStyle={styles.content}>
      <PasswordResetView code={code} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // `flexGrow` + centered justification floats the reset card in the screen and lets its
  // footer sit below; the screen margin comes from the Screen scaffold.
  content: { flexGrow: 1, justifyContent: "center" },
});
