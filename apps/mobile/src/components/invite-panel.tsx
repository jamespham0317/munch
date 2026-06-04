import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { colors, radii, shadow, spacing, typography } from "../theme";

/**
 * Invite affordance (10-pages.md §3.5, "Lobby with QR Code"): the amber code card with the
 * 6-digit code, a scannable QR of the join link, and tap-to-copy. The link is built with
 * expo-linking's createURL so it is environment-aware — the dev URL in Expo Go, the
 * `munch://` scheme in a standalone build — and routes to /room/join/{code} (parity with
 * apps/web's path-based link). Presentational; the code is passed in (CLAUDE.md §4).
 */

/** Shared join-link builder so the lobby's "Invite more" share uses the same URL as the QR. */
export function buildJoinUrl(code: string): string {
  return Linking.createURL(`/room/join/${code}`);
}

/** Display the 6-digit code as `123-456` for readability; the stored value is unchanged. */
function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

export function InvitePanel({ code }: { code: string }) {
  const joinUrl = buildJoinUrl(code);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copying is best-effort; a failed clipboard write is not surfaced.
    }
  }

  return (
    <Pressable
      onPress={() => void handleCopy()}
      accessibilityRole="button"
      accessibilityLabel="Copy join link"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.code}>{formatCode(code)}</Text>
      <View style={styles.qr}>
        <QRCode value={joinUrl} size={140} />
      </View>
      <View style={styles.hintRow}>
        <Feather
          name={copied ? "check" : "copy"}
          size={14}
          color={colors.onBrand}
        />
        <Text style={styles.hint}>
          {copied ? "Link copied!" : "Tap to copy link or scan QR"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brand,
    borderRadius: radii.xl,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.gutter,
    ...shadow("shadowLow"),
  },
  pressed: { transform: [{ translateY: 2 }] },
  code: {
    ...typography.displayLgMobile,
    color: colors.onBrand,
    letterSpacing: 4,
  },
  // White backdrop keeps the dark-on-light QR scannable against the amber card.
  qr: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  hintRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  hint: { ...typography.caption, color: colors.onBrand },
});
