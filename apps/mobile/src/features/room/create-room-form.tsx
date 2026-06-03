import { Feather } from "@expo/vector-icons";
import {
  createRoomRequestSchema,
  type CuisineId,
  DEFAULT_RADIUS_M,
  type PriceLevel,
  RADIUS_MAX_M,
} from "@munch/core";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FiltersFieldset } from "../../components/filters-fieldset";
import { Button, Field, Input, RadiusSlider } from "../../components/ui";
import { colors, spacing, typography } from "../../theme";
import { useCreateRoom } from "./use-create-room";

/** Empty string → NaN so the Zod number schemas reject a blank coordinate. */
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
 * (docs/06 §6). The "Where are we eating?" field's pin is a decorative affordance:
 * geocoding/map is deferred (presentation-only reskin), so the host enters lat/lng.
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
  const [radius, setRadius] = useState(DEFAULT_RADIUS_M);
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
      default_radius_m: radius,
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
        <Input
          value={hostDisplayName}
          onChangeText={setHostDisplayName}
          maxLength={50}
          placeholder="Your name"
        />
      </Field>
      <Field label="Where are we eating?">
        <View>
          <Input
            style={styles.anchorInput}
            value={anchorLabel}
            onChangeText={setAnchorLabel}
            placeholder="Search neighborhood or city…"
          />
          <View style={styles.anchorIcon} pointerEvents="none">
            <Feather name="map-pin" size={18} color={colors.textFaint} />
          </View>
        </View>
      </Field>
      <View style={styles.coordRow}>
        <View style={styles.coordCol}>
          <Field label="Latitude">
            <Input
              value={anchorLat}
              onChangeText={setAnchorLat}
              keyboardType="numbers-and-punctuation"
              placeholder="37.7749"
            />
          </Field>
        </View>
        <View style={styles.coordCol}>
          <Field label="Longitude">
            <Input
              value={anchorLng}
              onChangeText={setAnchorLng}
              keyboardType="numbers-and-punctuation"
              placeholder="-122.4194"
            />
          </Field>
        </View>
      </View>
      <FiltersFieldset
        openNow={openNow}
        onOpenNowChange={setOpenNow}
        cuisines={cuisines}
        onCuisinesChange={setCuisines}
        priceLevels={priceLevels}
        onPriceLevelsChange={setPriceLevels}
      />
      <Field label="Search radius">
        <RadiusSlider
          valueM={radius}
          maxM={RADIUS_MAX_M}
          onChange={setRadius}
        />
      </Field>
      {errorMessage ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
      <Button
        label={createRoom.isPending ? "Creating…" : "Start Room"}
        onPress={handleSubmit}
        loading={createRoom.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  anchorInput: { paddingRight: 44 },
  anchorIcon: {
    position: "absolute",
    right: spacing.gutter,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  coordRow: { flexDirection: "row", gap: spacing.gutter },
  coordCol: { flex: 1 },
  error: { ...typography.bodyMd, color: colors.error },
});
