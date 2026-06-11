import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
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
 * scrim, slide animation.
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
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={dismissDisabled ? undefined : onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={dismissDisabled ? undefined : onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        {/* Swallow taps on the sheet so they don't reach the dismiss scrim. */}
        <Pressable
          style={[styles.sheet, shadow("shadowActive")]}
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
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: "85%",
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
