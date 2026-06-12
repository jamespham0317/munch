import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radii, shadow, spacing, typography } from "../../theme";
import { Button } from "./button";

/**
 * Confirmation modal primitive (09-design-system.md §7) — the in-app replacement for the OS
 * alert/confirm on destructive actions (the room leave/end flow). A bottom-anchored sheet that
 * slides up from the bottom (and back down on dismiss) over a dimmed scrim whose tint is applied
 * INSTANTLY — the dim covers the whole screen the moment the modal opens rather than sweeping up
 * with the card. (RN's built-in `animationType="slide"` slides scrim + card together, which is
 * why the card is driven by its own `Animated` translate over a non-animated scrim instead.) The
 * sheet holds an error-container icon badge, a centered headline + body, and stacked `primary`
 * (confirm) + `neutral` (dismiss) pill buttons. Presentational only — no data, no domain logic
 * (CLAUDE.md §4); the caller owns the open state and the mutation. The scrim tap and the Android
 * back button both dismiss; `confirmLoading` keeps the sheet open with a spinner (and disables
 * dismissal) while the action runs.
 */
export function ConfirmModal({
  open,
  onConfirm,
  onDismiss,
  title,
  body,
  confirmLabel,
  dismissLabel,
  confirmLoading = false,
}: {
  open: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  dismissLabel: string;
  confirmLoading?: boolean;
}) {
  // The card slides over an instantly-tinted scrim. The Modal stays mounted through the
  // slide-down exit (`mounted`), then unmounts, so dismissing still animates the card down —
  // only the scrim's appearance is made instant (see the component doc).
  const screenH = Dimensions.get("window").height;
  const translateY = useRef(new Animated.Value(screenH)).current;
  const [mounted, setMounted] = useState(open);

  // Mount as soon as `open` goes true; the slide-out effect below unmounts after the exit.
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Drive the card: slide up to rest on open, down off-screen on close (then unmount).
  useEffect(() => {
    if (!mounted) return;
    Animated.timing(translateY, {
      toValue: open ? 0 : screenH,
      duration: open ? 260 : 200,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, mounted, screenH, translateY]);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={confirmLoading ? undefined : onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={confirmLoading ? undefined : onDismiss}
        accessibilityRole="button"
        accessibilityLabel={dismissLabel}
      >
        {/* The card alone slides (Animated translate); the scrim above is instant. */}
        <Animated.View
          style={[styles.cardWrap, { transform: [{ translateY }] }]}
        >
          {/* Swallow taps on the card so they don't reach the dismiss scrim. */}
          <Pressable
            style={[styles.card, shadow("shadowActive")]}
            onPress={() => {}}
            accessibilityViewIsModal
            accessibilityRole="alert"
          >
            <View style={[styles.badge, shadow("shadowLow")]}>
              <Feather name="log-out" size={32} color={colors.error} />
            </View>
            <View style={styles.textBlock}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
            </View>
            <View style={styles.actions}>
              <Button
                label={confirmLabel}
                variant="primary"
                onPress={onConfirm}
                loading={confirmLoading}
              />
              <Button
                label={dismissLabel}
                variant="neutral"
                onPress={onDismiss}
                disabled={confirmLoading}
              />
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/** Charcoal at a given alpha — derived from the `text` token, not a new palette value. */
function charcoalAlpha(alpha: number): string {
  const hex = colors.text.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: charcoalAlpha(0.4),
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xl,
  },
  // Full-width wrapper that carries the slide transform; centers the capped-width card.
  cardWrap: { width: "100%", alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  textBlock: { gap: spacing.base },
  title: { ...typography.headlineMd, color: colors.text, textAlign: "center" },
  body: { ...typography.bodyMd, color: colors.textMuted, textAlign: "center" },
  actions: { gap: spacing.base },
});
