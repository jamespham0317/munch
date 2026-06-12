import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { joinRoomRequestSchema } from "@munch/core";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Field, IconBadge, Input } from "../../components/ui";
import { colors, radii, spacing, typography } from "../../theme";
import { useCurrentUser } from "../auth/use-current-user";
import { useOwnProfile } from "../auth/use-own-profile";
import { useJoinRoom } from "./use-join-room";

/** Display a raw 6-digit join code grouped as `582-901` (presentation only — the value
 *  submitted to join_room stays the raw digits, so validation is unchanged). */
function formatCode(raw: string): string {
  return raw.length === 6 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
}

/**
 * Join-room form (RN parity with apps/web's JoinRoomForm), the INVITE-LINK target
 * (/room/join/{code}). Manual code entry now lives on the Match home (docs/10 §3.1) — only a
 * deep link reaches this screen, so `initialCode` is supplied and `lockCode` renders the code
 * read-only: a host shared this exact code, so the invitee may not edit it (docs/10 §3.4). Input
 * is validated client-side against the @munch/core schema (docs/06 §3); the server re-validates
 * authoritatively. Explicit handlers only (docs/06 §6). join_room failures surface the
 * api-client's friendly, code-mapped message (errors.ts: ROOM_NOT_FOUND/ROOM_CLOSED/
 * ALREADY_JOINED/RATE_LIMITED/ROOM_IN_SESSION — docs/04 §3.2), never raw provider/DB text. When
 * `lockCode` and the join fails, the code is a dead end (it can't be edited), so the action
 * becomes a Cancel back to Match rather than a retry.
 *
 * A SIGNED-IN user (resolved `profiles` display name) skips the name field — they join by
 * code with their profile name (docs/10 §3.4). The gate is the resolved NAME, so a guest, and
 * the rare signed-in-but-no-profile state, both fall back to name entry and are never stuck.
 * This only chooses how the name is supplied; there is no mid-room sign-in here (docs/04 §2).
 */
export function JoinRoomForm({
  initialCode = "",
  lockCode = false,
}: {
  initialCode?: string;
  lockCode?: boolean;
}) {
  const router = useRouter();
  const joinRoom = useJoinRoom();
  const userQuery = useCurrentUser();
  const profileQuery = useOwnProfile();

  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  const resolvingName = isSignedIn && profileQuery.isLoading;
  const signedInName = isSignedIn ? (profileQuery.data ?? null) : null;

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
      display_name: signedInName ?? displayName,
    });
    if (!parsed.success) {
      setValidationError(
        signedInName
          ? "Enter the 6-digit code."
          : "Enter the 6-digit code and your name.",
      );
      return;
    }
    setValidationError(null);
    joinRoom.mutate(parsed.data);
  }

  const errorMessage =
    validationError ?? (joinRoom.isError ? joinRoom.error.message : null);

  return (
    <View style={styles.outer}>
      <Card>
        <View style={styles.form}>
          <View style={styles.badgeRow}>
            <IconBadge
              icon={
                <MaterialCommunityIcons
                  name="silverware-fork-knife"
                  size={32}
                  color={colors.onBrand}
                />
              }
            />
          </View>
          {signedInName ? (
            <Text style={styles.joiningAs}>
              Joining as{" "}
              <Text style={styles.joiningAsName}>{signedInName}</Text>
            </Text>
          ) : resolvingName ? (
            <Text style={styles.joiningAs}>Loading your profile…</Text>
          ) : (
            <Field label="Enter your name">
              <Input
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={50}
                placeholder="Hungry Human"
                leadingIcon={
                  <Feather name="user" size={20} color={colors.textFaint} />
                }
                style={styles.pill}
              />
            </Field>
          )}
          <Field label="Room code">
            <Input
              value={lockCode ? formatCode(code) : code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={lockCode ? 7 : 6}
              placeholder="e.g. 582901"
              editable={!lockCode}
              leadingIcon={
                <Feather name="lock" size={20} color={colors.textFaint} />
              }
              style={lockCode ? styles.lockedInput : styles.pill}
            />
          </Field>
          {errorMessage ? (
            <Text style={styles.error} accessibilityRole="alert">
              {errorMessage}
            </Text>
          ) : null}
          {/* A locked (deep-link) code that the server rejects is a dead end — it can't be
              edited — so the action is a Cancel back to Match, not a retry (docs/10 §3.4). */}
          {lockCode && joinRoom.isError ? (
            <Button
              variant="text"
              label="Cancel"
              leadingIcon={<Feather name="x" size={20} color={colors.brand} />}
              onPress={() => router.replace("/")}
            />
          ) : (
            <Button
              label={joinRoom.isPending ? "Joining…" : "Join the Squad"}
              onPress={handleSubmit}
              loading={joinRoom.isPending}
              disabled={resolvingName}
              elevated
              trailingIcon={
                <Feather name="users" size={20} color={colors.onBrand} />
              }
            />
          )}
        </View>
      </Card>
      <View style={styles.tip}>
        <MaterialCommunityIcons
          name="lightbulb-outline"
          size={16}
          color={colors.textFaint}
        />
        <Text style={styles.tipText}>
          Joining a squad lets everyone vote on nearby restaurants.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { gap: spacing.md, alignItems: "center" },
  form: { gap: spacing.gutter },
  badgeRow: { alignItems: "center" },
  pill: { borderRadius: radii.full },
  joiningAs: { ...typography.bodyMd, color: colors.textMuted },
  joiningAsName: { color: colors.text },
  error: { ...typography.bodyMd, color: colors.error },
  // Locked (invite-link) code: read-only, prominent, dimmed to signal it can't be edited.
  lockedInput: {
    ...typography.headlineMd,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHighest,
    color: colors.textMuted,
    opacity: 0.8,
  },
  tip: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  tipText: { ...typography.caption, color: colors.textFaint },
});
