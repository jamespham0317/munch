import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { Screen } from "../../../src/components/ui";
import { JoinRoomForm } from "../../../src/features/room/join-room-form";
import { colors, typography } from "../../../src/theme";

/**
 * Link/QR deep-link target: /room/join/{code} (path-parity with apps/web). The code from the
 * route pre-fills the join form and is LOCKED (lockCode) — a host shared this exact code, so the
 * invitee confirms a name and joins but can't edit the code (docs/10 §3.4). Manual code entry
 * lives on the Match home now. expo-router resolves both the `munch://` scheme and (once a domain
 * is configured) the https universal link to this route.
 */
export default function JoinRoomByCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Join the Squad
      </Text>
      <Text style={styles.subtitle}>
        You&apos;ve been invited! Ready to settle the food debate?
      </Text>
      <JoinRoomForm initialCode={code ?? ""} lockCode />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.displayLgMobile, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
});
