import { Feather } from "@expo/vector-icons";
import { joinRoomRequestSchema } from "@munch/core";
import { useRouter } from "expo-router";
import { type ComponentProps, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Card, Input, Screen } from "../../src/components/ui";
import { useCurrentUser } from "../../src/features/auth/use-current-user";
import { useOwnProfile } from "../../src/features/auth/use-own-profile";
import { useJoinRoom } from "../../src/features/room/use-join-room";
import { colors, radii, shadow, spacing, typography } from "../../src/theme";

/**
 * Welcome / Home screen (10-pages.md §3.1, "Welcome to Munch"). The Match-tab root and the
 * room-flow entry point: a guest-by-default surface offering the two ways in — host a room
 * or join one by code. Thin by design (CLAUDE.md §4): the Create card routes into the create
 * flow. Auth lives in the Profile tab now (10-pages.md §2/§3.2), so there is no sign-in panel
 * on this screen.
 *
 * The Join card joins INLINE here (docs/10 §3.1) — manual code entry no longer redirects to the
 * /room/join screen (that is now the invite-link-only target). A GUEST types a name + code; a
 * SIGNED-IN user (resolved `profiles` name) skips the name field and joins with their profile
 * name. Both call join_room, which routes to the lobby on success and surfaces a friendly inline
 * error otherwise. The gate is the resolved NAME (not the signed-in flag), so a profile still
 * loading or missing safely falls back to name entry.
 */
export default function HomeScreen() {
  const router = useRouter();
  const userQuery = useCurrentUser();
  const profileQuery = useOwnProfile();
  const joinRoom = useJoinRoom();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  const resolvingName = isSignedIn && profileQuery.isLoading;
  const signedInName = isSignedIn ? (profileQuery.data ?? null) : null;

  // Validate { code, name } against the @munch/core schema, then join inline via join_room
  // (routes to the lobby on success; a bad/closed/in-session code surfaces a friendly inline
  // error). Guests supply the name from the field; signed-in users use their profile name.
  function goToJoin() {
    const parsed = joinRoomRequestSchema.safeParse({
      code: code.trim(),
      display_name: signedInName ?? displayName,
    });
    if (!parsed.success) {
      setCodeError(
        signedInName
          ? "Enter the 6-digit code."
          : "Enter the 6-digit code and your name.",
      );
      return;
    }
    setCodeError(null);
    joinRoom.mutate(parsed.data);
  }

  const joinError =
    codeError ?? (joinRoom.isError ? joinRoom.error.message : null);

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Ready to eat?
      </Text>
      <Text style={styles.subtitle}>
        Start a session with friends or join an existing one.
      </Text>

      <Pressable
        onPress={() => router.push("/room/create")}
        accessibilityRole="button"
        accessibilityLabel="Create a room"
        style={({ pressed }) => pressed && styles.cardPressed}
      >
        <Card style={styles.createCard}>
          <View style={styles.createGlyph}>
            <Feather name="plus" size={22} color={colors.brand} />
          </View>
          <Text style={styles.createTitle}>Create a Room</Text>
          <Text style={styles.createBody}>
            Host a session and invite your crew.
          </Text>
        </Card>
      </Pressable>

      <Card>
        <View style={styles.joinHeader}>
          <Feather name="users" size={20} color={colors.heat} />
          <Text style={styles.joinTitle}>Join with Code</Text>
        </View>
        <Text style={styles.joinHint}>
          Got an invite? Enter your name and the code below.
        </Text>
        {/* Name: guests type it; a signed-in user joins with their profile name and skips the
            field. The gate is the resolved name, so an unresolved profile falls back to entry. */}
        {signedInName ? (
          <Text style={styles.joiningAs}>
            Joining as <Text style={styles.joiningAsName}>{signedInName}</Text>
          </Text>
        ) : resolvingName ? (
          <Text style={styles.joiningAs}>Loading your profile…</Text>
        ) : (
          <Input
            style={styles.joinNameInput}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={50}
            placeholder="Your name"
            accessibilityLabel="Your name"
          />
        )}
        <View style={styles.joinRow}>
          <Input
            style={styles.joinInput}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="e.g. 582901"
            returnKeyType="go"
            onSubmitEditing={goToJoin}
            accessibilityLabel="Room code"
          />
          <Button
            label={joinRoom.isPending ? "Joining…" : "Join"}
            variant="secondary"
            onPress={goToJoin}
            loading={joinRoom.isPending}
            disabled={resolvingName}
          />
        </View>
        {joinError ? (
          <Text style={styles.joinError} accessibilityRole="alert">
            {joinError}
          </Text>
        ) : null}
      </Card>

      <Text style={styles.stepsHeading}>How Munch Works</Text>
      <View style={styles.steps}>
        <Step
          color={colors.heat}
          iconColor={colors.onHeat}
          icon="chevrons-right"
          title="1. Swipe & Like"
          body="Vote on restaurants anonymously."
        />
        <Step
          color={colors.brand}
          iconColor={colors.onBrand}
          icon="heart"
          title="2. Find Matches"
          body="When everyone likes it, it's a match!"
        />
        <Step
          color={colors.text}
          iconColor={colors.background}
          icon="coffee"
          title="3. Let's Eat"
          body="Stop arguing, start eating."
        />
      </View>
    </Screen>
  );
}

/** A single "How Munch Works" row: a colored circular icon tile + title/body. */
function Step({
  color,
  iconColor,
  icon,
  title,
  body,
}: {
  color: string;
  iconColor: string;
  icon: ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
}) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepIcon, { backgroundColor: color }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.stepText}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const STEP_ICON = 44;

const styles = StyleSheet.create({
  title: { ...typography.displayLgMobile, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },

  cardPressed: { opacity: 0.95 },
  createCard: { backgroundColor: colors.brand, gap: spacing.base },
  createGlyph: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.onBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  createTitle: { ...typography.headlineMd, color: colors.onBrand },
  createBody: { ...typography.bodyMd, color: colors.textMuted },

  joinHeader: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  joinTitle: { ...typography.titleLg, color: colors.text },
  joinHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  joiningAs: {
    ...typography.bodyMd,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  joiningAsName: { color: colors.text },
  joinNameInput: { marginBottom: spacing.sm },
  joinRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  joinInput: { flex: 1 },
  joinError: {
    ...typography.bodyMd,
    color: colors.error,
    marginTop: spacing.sm,
  },

  stepsHeading: { ...typography.headlineMd, color: colors.text },
  steps: { gap: spacing.sm },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.gutter,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.gutter,
    ...shadow("shadowLow"),
  },
  stepIcon: {
    width: STEP_ICON,
    height: STEP_ICON,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { flex: 1, gap: spacing.xs },
  stepTitle: { ...typography.titleLg, color: colors.text },
  stepBody: { ...typography.caption, color: colors.textMuted },
});
