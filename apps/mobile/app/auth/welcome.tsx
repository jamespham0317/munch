import { StyleSheet } from "react-native";

import { Screen } from "../../src/components/ui";
import { AccountCreatedView } from "../../src/features/auth/account-created-view";

/**
 * Account-created success screen (docs/05 §3), OUTSIDE any room. Thin wrapper: AuthPanel navigates
 * here after a successful register. No screen title — the view owns its own celebratory hero (Stitch
 * "Account Created Successfully", docs/10 §3.2). Vertically centred (flexGrow + center on the scroll
 * content), falling back to scroll if it ever overflows.
 */
export default function AccountCreatedScreen() {
  return (
    <Screen contentStyle={styles.centered}>
      <AccountCreatedView />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, justifyContent: "center" },
});
