import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { joinRoomRequestSchema } from "@munch/core";
import { useRouter } from "expo-router";
import { type ComponentProps, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, Input } from "../../src/components/ui";
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
 * The Join card branches on auth (docs/10 §3.1): a GUEST (or unresolved name) is routed to the
 * /room/join/{code} screen, which owns the name field; a SIGNED-IN user joins inline with their
 * profile name (join_room here), so they skip the name prompt. The gate is the resolved NAME
 * (not the signed-in flag), so a profile still loading or missing safely takes the guest route.
 */
export default function HomeScreen() {
  const router = useRouter();
  const userQuery = useCurrentUser();
  const profileQuery = useOwnProfile();
  const joinRoom = useJoinRoom();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  const resolvingName = isSignedIn && profileQuery.isLoading;
  const signedInName = isSignedIn ? (profileQuery.data ?? null) : null;

  // Signed-in (resolved name) → join inline with the profile name (join_room routes to the
  // lobby on success). Guest / unresolved name → route the typed code into the join screen,
  // which owns the name field; a blank code opens the bare join screen for manual entry.
  function goToJoin() {
    const trimmed = code.trim();
    if (signedInName) {
      const parsed = joinRoomRequestSchema.safeParse({
        code: trimmed,
        display_name: signedInName,
      });
      if (!parsed.success) {
        setCodeError("Enter the 6-digit code.");
        return;
      }
      setCodeError(null);
      joinRoom.mutate(parsed.data);
      return;
    }
    if (trimmed) {
      router.push({ pathname: "/room/join/[code]", params: { code: trimmed } });
    } else {
      router.push("/room/join");
    }
  }

  const joinError =
    codeError ?? (joinRoom.isError ? joinRoom.error.message : null);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brandRow}>
        <MaterialCommunityIcons
          name="silverware-fork-knife"
          size={24}
          color={colors.heat}
        />
        <Text style={styles.brand}>Munch</Text>
      </View>

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
          Got an invite? Enter the code below.
        </Text>
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
    </ScrollView>
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
  screen: { backgroundColor: colors.background },
  container: { padding: spacing.screenMarginMobile, gap: spacing.md },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  brand: { ...typography.titleLg, color: colors.text },
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
