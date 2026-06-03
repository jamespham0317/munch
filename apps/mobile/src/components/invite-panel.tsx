import * as Linking from "expo-linking";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { colors, spacing } from "../theme";

/**
 * Invite affordance: the 6-digit code, a Share of the join link, and a QR of that
 * link. The link is built with expo-linking's createURL so it is environment-aware —
 * the dev URL in Expo Go, the `munch://` scheme in a standalone build — and routes to
 * /room/join/{code} (parity with apps/web's path-based link). Presentational; the
 * code is passed in (CLAUDE.md §4).
 */
export function InvitePanel({ code }: { code: string }) {
  const joinUrl = Linking.createURL(`/room/join/${code}`);

  async function handleShare() {
    try {
      await Share.share({ message: joinUrl });
    } catch {
      // Sharing is best-effort; a dismissed or failed share is not surfaced.
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Invite friends</Text>
      <Text style={styles.code}>{code}</Text>
      <View style={styles.qr}>
        <QRCode value={joinUrl} size={160} />
      </View>
      <Pressable style={styles.button} onPress={() => void handleShare()}>
        <Text style={styles.buttonText}>Share join link</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.gutter,
  },
  heading: { color: colors.text, fontSize: 18, fontWeight: "600" },
  code: {
    color: colors.brand,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 4,
  },
  // White backdrop keeps the dark-on-light QR scannable against the cream canvas.
  qr: {
    backgroundColor: colors.surface,
    padding: spacing.base,
    borderRadius: 8,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.md,
  },
  buttonText: { color: colors.onBrand, fontSize: 16, fontWeight: "600" },
});
