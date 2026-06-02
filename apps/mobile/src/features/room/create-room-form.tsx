import {
  createRoomRequestSchema,
  type CuisineId,
  DEFAULT_RADIUS_M,
  type PriceLevel,
} from "@munch/core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Field } from "../../components/field";
import { FiltersFieldset } from "../../components/filters-fieldset";
import { colors, spacing } from "../../theme";
import { useCreateRoom } from "./use-create-room";

/** Empty string → NaN so the Zod number schemas reject a blank coordinate/radius. */
function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * Host create-room form (RN parity with apps/web's CreateRoomForm). Sets the host's
 * name, the search anchor, the room-wide filters (host-controlled per CLAUDE.md §2),
 * and the default radius, then calls the create flow. Cuisines come from the closed
 * @munch/core CUISINES taxonomy via FiltersFieldset (no free text) — the submitted
 * filters carry only taxonomy ids. Input is validated client-side against the
 * @munch/core schema (docs/06 §3, validate on both ends); the server re-validates
 * authoritatively. Explicit handlers only — no form semantics that conflict with RN
 * (docs/06 §6).
 */
export function CreateRoomForm() {
  const createRoom = useCreateRoom();

  const [hostDisplayName, setHostDisplayName] = useState("");
  const [anchorLabel, setAnchorLabel] = useState("");
  const [anchorLat, setAnchorLat] = useState("");
  const [anchorLng, setAnchorLng] = useState("");
  const [openNow, setOpenNow] = useState(false);
  const [cuisines, setCuisines] = useState<CuisineId[]>([]);
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [radius, setRadius] = useState(String(DEFAULT_RADIUS_M));
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit() {
    const parsed = createRoomRequestSchema.safeParse({
      host_display_name: hostDisplayName,
      anchor_label: anchorLabel,
      anchor_lat: toNumber(anchorLat),
      anchor_lng: toNumber(anchorLng),
      filters: {
        open_now: openNow,
        cuisines,
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
      <FiltersFieldset
        openNow={openNow}
        onOpenNowChange={setOpenNow}
        cuisines={cuisines}
        onCuisinesChange={setCuisines}
        priceLevels={priceLevels}
        onPriceLevelsChange={setPriceLevels}
      />
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
