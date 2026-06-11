import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

import { JoinRoomForm } from "../../../src/features/room/join-room-form";
import { colors, spacing, typography } from "../../../src/theme";

/**
 * Link/QR deep-link target: /room/join/{code} (path-parity with apps/web). The code
 * from the route pre-fills the join form; a bare /room/join renders the same form
 * blank. expo-router resolves both the `munch://` scheme and (once a domain is
 * configured) the https universal link to this route.
 */
export default function JoinRoomByCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title} accessibilityRole="header">
        Join with Code
      </Text>
      <Text style={styles.subtitle}>
        You&apos;re invited! Confirm the details below to join the room.
      </Text>
      <JoinRoomForm initialCode={code ?? ""} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.screenMarginMobile, gap: spacing.md },
  title: { ...typography.displayLgMobile, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
});
