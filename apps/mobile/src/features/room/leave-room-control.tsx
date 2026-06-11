import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, ConfirmModal } from "../../components/ui";
import { colors, spacing, typography } from "../../theme";
import { useRoomExit } from "./use-room-exit";

/**
 * The caller's own "Leave room" / "End room" control (Phase 4.7; RN parity with apps/web's
 * LeaveRoomControl), rendered on both the lobby and the swipe screen. A non-host leaves (server
 * removes them + re-checks for an immediate match); the host ends the room (soft-close + cancel, no
 * transfer — CLAUDE.md invariant 3). Departure is irreversible, so a branded ConfirmModal gates the
 * action before the mutation fires (replacing the OS Alert). The leave copy is context-aware: in the
 * lobby a member can still rejoin (the roster only freezes once a session starts — docs/04 §3.2), so
 * the "can't rejoin" warning is shown only on the session screen. The modal stays open with a spinner
 * while the mutation runs and closes on error (success routes home). Thin by design — all the server
 * logic and routing live in useRoomExit (CLAUDE.md §4).
 */
export function LeaveRoomControl({
  isHost,
  exit,
  context,
}: {
  isHost: boolean;
  exit: ReturnType<typeof useRoomExit>;
  /** Which surface this renders on — drives the context-aware leave copy. */
  context: "lobby" | "session";
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mutation = isHost ? exit.end : exit.leave;
  const triggerLabel = isHost ? "End room" : "Leave room";

  const copy = isHost
    ? {
        title: "End the room for everyone?",
        body: "This closes the room for everyone and can't be undone.",
        confirmLabel: "End room",
        dismissLabel: "Cancel",
      }
    : {
        title: "Are you sure you want to leave?",
        body:
          context === "lobby"
            ? "You'll leave the room. You can rejoin with the room code while the group's still in the lobby."
            : "You won't be able to rejoin, and your swipes will stop counting toward a match.",
        confirmLabel: "Leave room",
        dismissLabel: "Stay",
      };

  function handleConfirm() {
    mutation.mutate(undefined, { onError: () => setConfirmOpen(false) });
  }

  return (
    <View style={styles.container}>
      <Button
        label={triggerLabel}
        variant="ghost"
        onPress={() => setConfirmOpen(true)}
        disabled={mutation.isPending}
      />
      {mutation.isError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {mutation.error.message}
        </Text>
      ) : null}
      <ConfirmModal
        open={confirmOpen}
        onConfirm={handleConfirm}
        onDismiss={() => setConfirmOpen(false)}
        title={copy.title}
        body={copy.body}
        confirmLabel={copy.confirmLabel}
        dismissLabel={copy.dismissLabel}
        confirmLoading={mutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  error: { ...typography.bodyMd, color: colors.error },
});
