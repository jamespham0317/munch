import { useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";

import { Screen } from "../../src/components/ui";
import { PasswordResetView } from "../../src/features/auth/password-reset-view";

/**
 * Password-reset screen (docs/05 §3), OUTSIDE any room. Thin wrapper: the recovery deep link
 * reopens the app at munch://auth/reset?code=… so the route forwards `code` to the view, which
 * handles both the request and the recovery-session update steps (CLAUDE.md §3, §4). No screen
 * title: the view owns its own per-state headline + icon badge (above the card on the form steps;
 * Stitch "Forgot Password", docs/10 §3.2). Top-aligned like the Join-via-link screen — the plain
 * `Screen` scaffold, vertically centred (flexGrow + center on the scroll content) so the per-state
 * hero sits mid-screen, falling back to scroll if a step ever overflows (e.g. with the keyboard up).
 */
export default function ResetScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return (
    <Screen contentStyle={styles.centered}>
      <PasswordResetView code={code} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, justifyContent: "center" },
});
