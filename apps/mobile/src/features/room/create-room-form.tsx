import {
  createRoomRequestSchema,
  DEFAULT_RADIUS_M,
  type PriceLevel,
} from "@munch/core";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { Field } from "../../components/field";
import { colors, spacing } from "../../theme";
import { useCreateRoom } from "./use-create-room";

const PRICE_LEVELS: readonly PriceLevel[] = ["1", "2", "3", "4"];

/** Empty string → NaN so the Zod number schemas reject a blank coordinate/radius. */
function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * Host create-room form (RN parity with apps/web's CreateRoomForm). Sets the host's
 * name, the search anchor, the room-wide filters (host-controlled per CLAUDE.md §2),
 * and the default radius, then calls the create flow. Input is validated client-side
 * against the @munch/core schema (docs/06 §3, validate on both ends); the server
 * re-validates authoritatively. Explicit handlers only — no form semantics that
 * conflict with RN (docs/06 §6).
 */
export function CreateRoomForm() {
  const createRoom = useCreateRoom();

  const [hostDisplayName, setHostDisplayName] = useState("");
  const [anchorLabel, setAnchorLabel] = useState("");
  const [anchorLat, setAnchorLat] = useState("");
  const [anchorLng, setAnchorLng] = useState("");
  const [openNow, setOpenNow] = useState(false);
  const [cuisines, setCuisines] = useState("");
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [radius, setRadius] = useState(String(DEFAULT_RADIUS_M));
  const [validationError, setValidationError] = useState<string | null>(null);

  function togglePriceLevel(level: PriceLevel) {
    setPriceLevels((current) =>
      current.includes(level)
        ? current.filter((value) => value !== level)
        : [...current, level],
    );
  }

  function handleSubmit() {
    const parsed = createRoomRequestSchema.safeParse({
      host_display_name: hostDisplayName,
      anchor_label: anchorLabel,
      anchor_lat: toNumber(anchorLat),
      anchor_lng: toNumber(anchorLng),
      filters: {
        open_now: openNow,
        cuisines: cuisines
          .split(",")
          .map((cuisine) => cuisine.trim())
          .filter((cuisine) => cuisine.length > 0),
        price_levels: priceLevels,
      },
      default_radius_m: toNumber(radius),
    });
    if (!parsed.success) {
      setValidationError(
        "Check the form: a name plus valid anchor coordinates and radius are required.",
      );
      return;
    }
    setValidationError(null);
    createRoom.mutate(parsed.data);
  }

  const errorMessage =
    validationError ?? (createRoom.isError ? createRoom.error.message : null);

  return (
    <View style={styles.form}>
      <Field label="Your name">
        <TextInput
          style={styles.input}
          value={hostDisplayName}
          onChangeText={setHostDisplayName}
          maxLength={50}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
        />
      </Field>
      <Field label="Area label">
        <TextInput
          style={styles.input}
          value={anchorLabel}
          onChangeText={setAnchorLabel}
          placeholder="e.g. Downtown"
          placeholderTextColor={colors.textMuted}
        />
      </Field>
      <Field label="Latitude">
        <TextInput
          style={styles.input}
          value={anchorLat}
          onChangeText={setAnchorLat}
          keyboardType="numbers-and-punctuation"
          placeholder="37.7749"
          placeholderTextColor={colors.textMuted}
        />
      </Field>
      <Field label="Longitude">
        <TextInput
          style={styles.input}
          value={anchorLng}
          onChangeText={setAnchorLng}
          keyboardType="numbers-and-punctuation"
          placeholder="-122.4194"
          placeholderTextColor={colors.textMuted}
        />
      </Field>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Open now</Text>
        <Switch value={openNow} onValueChange={setOpenNow} />
      </View>
      <Field label="Cuisines (comma-separated)">
        <TextInput
          style={styles.input}
          value={cuisines}
          onChangeText={setCuisines}
          placeholder="italian, thai"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
      </Field>
      <Field label="Price range">
        <View style={styles.priceRow}>
          {PRICE_LEVELS.map((level) => {
            const selected = priceLevels.includes(level);
            return (
              <Pressable
                key={level}
                onPress={() => togglePriceLevel(level)}
                style={[styles.priceChip, selected && styles.priceChipSelected]}
              >
                <Text
                  style={[
                    styles.priceChipText,
                    selected && styles.priceChipTextSelected,
                  ]}
                >
                  {"$".repeat(Number(level))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>
      <Field label="Search radius (m)">
        <TextInput
          style={styles.input}
          value={radius}
          onChangeText={setRadius}
          keyboardType="number-pad"
        />
      </Field>
      {errorMessage ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
      <Pressable
        style={[styles.button, createRoom.isPending && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={createRoom.isPending}
      >
        <Text style={styles.buttonText}>
          {createRoom.isPending ? "Creating…" : "Create room"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: { color: colors.text, fontSize: 16 },
  priceRow: { flexDirection: "row", gap: spacing.sm },
  priceChip: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  priceChipSelected: { backgroundColor: colors.accent },
  priceChipText: { color: colors.textMuted, fontSize: 16 },
  priceChipTextSelected: { color: colors.background, fontWeight: "600" },
  error: { color: colors.danger },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: "600" },
});
