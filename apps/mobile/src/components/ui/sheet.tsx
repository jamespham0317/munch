import { Feather } from "@expo/vector-icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radii, shadow, spacing, typography } from "../../theme";

/**
 * Bottom-sheet primitive (09-design-system.md §7) — a generalization of ConfirmModal's
 * scrim/dismiss machinery with a drag handle, a header (title + close), a scrollable body,
 * and an optional pinned footer. Presentational only — no data, no domain logic (CLAUDE.md
 * §4); the caller owns the open state and any mutation. The scrim tap, the header close
 * button, and the Android back button dismiss (unless `dismissDisabled`, e.g. while a save
 * is in flight). The web twin is the DOM Sheet (createPortal). RN `Modal` over a dimmed
 * scrim whose tint is applied INSTANTLY — only the panel slides up (and back down on
 * dismiss), driven by its own `Animated` translate. (RN's built-in `animationType="slide"`
 * sweeps scrim + panel together, which is why the scrim is non-animated instead; mirrors
 * ConfirmModal — see its component doc.)
 */
export function Sheet({
  open,
  onDismiss,
  title,
  children,
  footer,
  dismissDisabled = false,
}: {
  open: boolean;
  onDismiss: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Block scrim/back/close dismissal (e.g. while the caller's mutation runs). */
  dismissDisabled?: boolean;
}) {
  // The panel slides over an instantly-tinted scrim. The Modal stays mounted through the
  // slide-down exit (`mounted`), then unmounts, so dismissing still animates the panel down —
  // only the scrim's appearance is made instant (mirrors ConfirmModal; see its component doc).
  const screenH = Dimensions.get("window").height;
  const translateY = useRef(new Animated.Value(screenH)).current;
  const [mounted, setMounted] = useState(open);

  // Mount as soon as `open` goes true; the slide-out effect below unmounts after the exit.
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Drive the panel: slide up to rest on open, down off-screen on close (then unmount).
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
      onRequestClose={dismissDisabled ? undefined : onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={dismissDisabled ? undefined : onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        {/* The panel alone slides (Animated translate); the scrim above is instant. */}
        <Animated.View
          style={[styles.sheetWrap, { transform: [{ translateY }] }]}
        >
          {/* Swallow taps on the sheet so they don't reach the dismiss scrim. */}
          <Pressable
            style={[
              styles.sheet,
              { maxHeight: screenH * 0.85 },
              shadow("shadowActive"),
            ]}
            onPress={() => {}}
            accessibilityViewIsModal
          >
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable
                onPress={onDismiss}
                disabled={dismissDisabled}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && !dismissDisabled && styles.closePressed,
                ]}
              >
                <Feather name="x" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
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
  },
  // Full-width wrapper that carries the slide transform; content-height so the scrim above
  // the sheet stays tappable to dismiss.
  sheetWrap: { width: "100%" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    overflow: "hidden",
  },
  handleRow: { alignItems: "center", paddingVertical: spacing.base },
  handle: {
    width: 48,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHighest,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.headlineMd, color: colors.text },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  closePressed: { opacity: 0.6 },
  body: { flexShrink: 1 },
  bodyContent: { padding: spacing.md, gap: spacing.md },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.base,
  },
});
