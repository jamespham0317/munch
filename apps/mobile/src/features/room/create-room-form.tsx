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

import { AnchorMap } from "../../components/anchor-map";
import { FiltersFieldset } from "../../components/filters-fieldset";
import { Button, Field, Input, RadiusSlider } from "../../components/ui";
import { colors, spacing, typography } from "../../theme";
import { useCancelCreateRoom, useCreateRoom } from "./use-create-room";

/**
 * Host create-room form (RN parity with apps/web's CreateRoomForm). Sets the host's
 * name, the search anchor, the room-wide filters (host-controlled per CLAUDE.md §2),
 * and the default radius, then calls the create flow. Cuisines come from the closed
 * @munch/core CUISINES taxonomy via FiltersFieldset (no free text) — the submitted
 * filters carry only taxonomy ids. Input is validated client-side against the
 * @munch/core schema (docs/06 §3, validate on both ends); the server re-validates
 * authoritatively. Explicit handlers only — no form semantics that conflict with RN
 * (docs/06 §6). The anchor (anchor_lat/anchor_lng) is set on the AnchorMap by dragging
 * the map under the fixed center pin (Phase 4.6, docs/07 §6.6); "Where are we eating?"
 * heads the map + radius group (no free-text label — Phase 4.8, docs/07 §6.8).
 */
export function CreateRoomForm() {
  const createRoom = useCreateRoom();
  const cancelCreateRoom = useCancelCreateRoom();

  const [hostDisplayName, setHostDisplayName] = useState("");
  const [anchorLat, setAnchorLat] = useState<number | null>(null);
  const [anchorLng, setAnchorLng] = useState<number | null>(null);
  const [openNow, setOpenNow] = useState(false);
  const [cuisines, setCuisines] = useState<CuisineId[]>([]);
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [radius, setRadius] = useState(DEFAULT_RADIUS_M);
  const [nameError, setNameError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit() {
    setNameError(null);
    setValidationError(null);
    // Name first, with its own friendly inline message — it is the only
    // realistically-reachable failure (the map auto-emits an anchor and the radius
    // slider defaults), so it gets a field-specific error rather than the catch-all.
    if (hostDisplayName.trim().length === 0) {
      setNameError(
        "What should we call you? Add your name to create the room.",
      );
      return;
    }
    const parsed = createRoomRequestSchema.safeParse({
      host_display_name: hostDisplayName,
      // The map emits a center on mount, so these are set before submit; the NaN
      // fallback only guards the brief pre-emit window and lets Zod reject it.
      anchor_lat: anchorLat ?? Number.NaN,
      anchor_lng: anchorLng ?? Number.NaN,
      filters: {
        open_now: openNow,
        cuisines,
        price_levels: priceLevels,
      },
      default_radius_m: radius,
    });
    if (!parsed.success) {
      setValidationError(
        "Check the form: a valid location and radius are required.",
      );
      return;
    }
    createRoom.mutate(parsed.data);
  }

  const errorMessage =
    validationError ?? (createRoom.isError ? createRoom.error.message : null);

  return (
    <View style={styles.form}>
      <Field label="Your name" error={nameError ?? undefined}>
        <Input
          value={hostDisplayName}
          onChangeText={setHostDisplayName}
          maxLength={50}
          placeholder="Your name"
        />
      </Field>
      {/* "Where are we eating?" heads the map + radius group (Phase 4.8). RN's Field is a
          plain label+View (no nesting concern), so it wraps the inner "Search radius" Field. */}
      <Field label="Where are we eating?">
        <AnchorMap
          radiusM={radius}
          onAnchorChange={(lat, lng) => {
            setAnchorLat(lat);
            setAnchorLng(lng);
          }}
        />
        <Field label="Search radius">
          <RadiusSlider
            valueM={radius}
            maxM={RADIUS_MAX_M}
            onChange={setRadius}
          />
        </Field>
      </Field>
      <FiltersFieldset
        openNow={openNow}
        onOpenNowChange={setOpenNow}
        cuisines={cuisines}
        onCuisinesChange={setCuisines}
        priceLevels={priceLevels}
        onPriceLevelsChange={setPriceLevels}
      />
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
      {/* Low-emphasis Cancel below the primary action (Stitch "Create a Room"): abandons
          creation and returns to Match. No room exists yet, so it's a pure client-side
          discard. Disabled while a create is in flight (the create_room RPC may already be
          committing — see useCancelCreateRoom). */}
      <Button
        variant="text"
        label="Cancel"
        leadingIcon={<Feather name="x" size={20} color={colors.brand} />}
        onPress={cancelCreateRoom}
        disabled={createRoom.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  error: { ...typography.bodyMd, color: colors.error },
});
