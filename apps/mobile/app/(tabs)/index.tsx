import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { type ComponentProps, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, Input } from "../../src/components/ui";
import { colors, radii, shadow, spacing, typography } from "../../src/theme";

/**
 * Welcome / Home screen (pages.md §3.1, "Welcome to Munch"). The Match-tab root and the
 * room-flow entry point: a guest-by-default surface offering the two ways in — host a room
 * or join one by code. Thin by design (CLAUDE.md §4): the Create card routes into the create
 * flow and the Join card hands the typed code to the existing join flow; neither calls a data
 * endpoint here. Auth lives in the Profile tab now (pages.md §2/§3.2), so there is no sign-in
 * panel on this screen.
 */
export default function HomeScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");

  // Route the typed code into the existing join flow (which owns the join_room call + name
  // field). A blank code opens the bare join screen for manual entry. No wiring added here.
  function goToJoin() {
    const trimmed = code.trim();
    if (trimmed) {
      router.push({ pathname: "/room/join/[code]", params: { code: trimmed } });
    } else {
      router.push("/room/join");
    }
  }

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
          <Button label="Join" variant="secondary" onPress={goToJoin} />
        </View>
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
