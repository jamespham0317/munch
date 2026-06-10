import { Alert, StyleSheet, Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { colors, spacing, typography } from "../../theme";
import { useRoomExit } from "./use-room-exit";

/**
 * The caller's own "Leave room" / "End room" control (Phase 4.7; RN parity with apps/web's
 * LeaveRoomControl), rendered on both the lobby and the swipe screen. A non-host leaves (server
 * removes them + re-checks for an immediate match); the host ends the room (soft-close + cancel, no
 * transfer — CLAUDE.md invariant 3). Departure is irreversible, so a native Alert confirms the
 * action before the mutation fires. Thin by design — all the server logic and routing live in
 * useRoomExit (CLAUDE.md §4).
 */
export function LeaveRoomControl({
  isHost,
  exit,
}: {
  isHost: boolean;
  exit: ReturnType<typeof useRoomExit>;
}) {
  const mutation = isHost ? exit.end : exit.leave;
  const label = isHost ? "End room" : "Leave room";
  const confirmMessage = isHost
    ? "End the room for everyone? This closes the session and can't be undone."
    : "Leave this room? You'll stop counting toward a match.";

  function handlePress() {
    Alert.alert(label, confirmMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: label,
        style: "destructive",
        onPress: () => mutation.mutate(),
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Button
        label={mutation.isPending ? "Leaving…" : label}
        variant="ghost"
        onPress={handlePress}
        disabled={mutation.isPending}
        loading={mutation.isPending}
      />
      {mutation.isError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {mutation.error.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  error: { ...typography.bodyMd, color: colors.error },
});
