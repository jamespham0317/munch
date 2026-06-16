import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { joinRoomRequestSchema } from "@munch/core";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Field, Input } from "../../components/ui";
import { colors, radii, spacing, typography } from "../../theme";
import { useCurrentUser } from "../auth/use-current-user";
import { useOwnProfile } from "../auth/use-own-profile";
import { useJoinRoom } from "./use-join-room";

/**
 * Join-room form (RN parity with apps/web's JoinRoomForm), the INVITE-LINK target
 * (/room/join/{code}). Manual code entry now lives on the Match home (docs/10 §3.1) — only a
 * deep link reaches this screen, so `initialCode` is supplied and `lockCode` renders the code
 * read-only: a host shared this exact code, so the invitee may not edit it (docs/10 §3.4). Input
 * is validated client-side against the @munch/core schema (docs/06 §3); the server re-validates
 * authoritatively. Explicit handlers only (docs/06 §6). join_room failures surface the
 * api-client's friendly, code-mapped message (errors.ts: ROOM_NOT_FOUND/ROOM_CLOSED/
 * ALREADY_JOINED/RATE_LIMITED/ROOM_IN_SESSION — docs/04 §3.2), never raw provider/DB text. A
 * persistent `text` "Back" button (router.replace("/")) is the exit; when `lockCode` and the
 * join fails the code is a dead end (it can't be edited), so the primary Join button is disabled
 * and Back is the way out rather than a futile retry.
 *
 * A SIGNED-IN user (resolved `profiles` display name) skips the name field — they join by
 * code with their profile name (docs/10 §3.4). The gate is the resolved NAME, so a guest, and
 * the rare signed-in-but-no-profile state, both fall back to name entry and are never stuck.
 * This only chooses how the name is supplied; there is no mid-room sign-in here (docs/04 §2).
 *
 * Layout mirrors the Sign In page (`ProfileView` signed-out hero): a centered icon + `title` +
 * `subtitle` hero above a full-width Card. The route passes the per-entry copy via `title` /
 * `subtitle` (docs/10 §3.4).
 */
export function JoinRoomForm({
  title,
  subtitle,
  initialCode = "",
  lockCode = false,
}: {
  title: string;
  subtitle: string;
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
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons
            name="silverware-fork-knife"
            size={32}
            color={colors.onBrand}
          />
        </View>
        <Text style={styles.heading} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Card>
        <View style={styles.form}>
          {signedInName ? (
            <Field label="Your name">
              <Input
                value={signedInName}
                editable={false}
                leadingIcon={
                  <Feather name="lock" size={20} color={colors.textFaint} />
                }
                style={styles.lockedInput}
              />
            </Field>
          ) : resolvingName ? (
            <Text style={styles.joiningAs}>Loading your profile…</Text>
          ) : (
            <Field label="Your name">
              <Input
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={50}
                placeholder="Your name"
              />
            </Field>
          )}
          <Field label="Room code">
            <Input
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="e.g. 582901"
              editable={!lockCode}
              leadingIcon={
                <Feather name="lock" size={20} color={colors.textFaint} />
              }
              style={lockCode ? styles.lockedInput : undefined}
            />
          </Field>
          {errorMessage ? (
            <Text style={styles.error} accessibilityRole="alert">
              {errorMessage}
            </Text>
          ) : null}
          <Button
            label={joinRoom.isPending ? "Joining…" : "Join the Squad"}
            onPress={handleSubmit}
            loading={joinRoom.isPending}
            // A locked (deep-link) code the server rejects is a dead end — it can't be
            // edited, so a retry is futile; disable Join and let Back be the exit
            // (docs/10 §3.4).
            disabled={resolvingName || (lockCode && joinRoom.isError)}
            trailingIcon={
              <Feather name="users" size={20} color={colors.onBrand} />
            }
          />
          <Button
            variant="text"
            label="Back"
            leadingIcon={
              <Feather name="arrow-left" size={20} color={colors.brand} />
            }
            onPress={() => router.replace("/")}
          />
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
  outer: { gap: spacing.md },
  // Centered icon + title + subtitle hero, matching the Sign In page (HistoryView).
  hero: { alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    ...typography.headlineMd,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
  },
  form: { gap: spacing.gutter },
  joiningAs: { ...typography.bodyMd, color: colors.textMuted },
  error: { ...typography.bodyMd, color: colors.error },
  // Locked (invite-link) code AND the signed-in name field: read-only, dimmed to signal it
  // can't be edited. Bold (keep
  // headlineMd's 700 Quicksand-Bold face/weight) but sized to match the name field (bodyMd).
  // No explicit lineHeight: an iOS TextInput sits the bold glyphs high in a fixed line box, so
  // we let the single line center naturally. Plain radii.md base, like the Sign In inputs.
  lockedInput: {
    ...typography.headlineMd,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: undefined,
    backgroundColor: colors.surfaceHighest,
    color: colors.textMuted,
    opacity: 0.8,
  },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  tipText: { ...typography.caption, color: colors.textFaint },
});
