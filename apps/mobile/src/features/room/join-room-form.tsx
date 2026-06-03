import { joinRoomRequestSchema } from "@munch/core";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Field } from "../../components/ui/field";
import { colors, spacing } from "../../theme";
import { useJoinRoom } from "./use-join-room";

/**
 * Join-room form (RN parity with apps/web's JoinRoomForm). `initialCode` pre-fills the
 * field from the /room/join/{code} deep link; a bare /room/join renders the same form
 * blank for manual entry. Input is validated client-side against the @munch/core
 * schema (docs/06 §3); the server re-validates authoritatively. Explicit handlers only
 * (docs/06 §6).
 */
export function JoinRoomForm({ initialCode = "" }: { initialCode?: string }) {
  const joinRoom = useJoinRoom();

  const [code, setCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Re-sync the pre-filled code when the deep-link param changes. expo-router reuses
  // this screen (no remount) if a different /room/join/{code} link is opened while the
  // join screen is already mounted, so the useState seed alone would keep the stale
  // code. Syncing here — rather than keying the whole form — preserves a name the user
  // may have already typed.
  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  function handleSubmit() {
    const parsed = joinRoomRequestSchema.safeParse({
      code: code.trim(),
      display_name: displayName,
    });
    if (!parsed.success) {
      setValidationError("Enter the 6-digit code and your name.");
      return;
    }
    setValidationError(null);
    joinRoom.mutate(parsed.data);
  }

  const errorMessage =
    validationError ?? (joinRoom.isError ? joinRoom.error.message : null);

  return (
    <View style={styles.form}>
      <Field label="Room code">
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          placeholderTextColor={colors.textMuted}
        />
      </Field>
      <Field label="Your name">
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={50}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
        />
      </Field>
      {errorMessage ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
      <Pressable
        style={[styles.button, joinRoom.isPending && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={joinRoom.isPending}
      >
        <Text style={styles.buttonText}>
          {joinRoom.isPending ? "Joining…" : "Join room"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.gutter },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.base,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.error },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: spacing.gutter,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.onBrand, fontSize: 16, fontWeight: "600" },
});
