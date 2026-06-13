import { Feather } from "@expo/vector-icons";
import {
  createRoomRequestSchema,
  type CuisineId,
  DEFAULT_RADIUS_M,
  type PriceLevel,
  RADIUS_MAX_M,
} from "@munch/core";
import { useRef, useState } from "react";
import { StyleSheet, Text, type TextInput, View } from "react-native";

import { AnchorMap } from "../../components/anchor-map";
import { FiltersFieldset } from "../../components/filters-fieldset";
import { Button, Field, Input, RadiusSlider } from "../../components/ui";
import { colors, spacing, typography } from "../../theme";
import { useCurrentUser } from "../auth/use-current-user";
import { useOwnProfile } from "../auth/use-own-profile";
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
 *
 * A SIGNED-IN host (resolved `profiles` display name) skips the name field — they create with
 * their profile name, shown read-only as a locked name field (lock icon, non-editable, mirroring
 * the locked Room-code field, docs/10 §3.3/§3.4). The gate is the resolved NAME, so a guest, and the rare
 * signed-in-but-no-profile state, both fall back to name entry and are never stuck. This only
 * chooses how the name is supplied; there is no mid-room sign-in here (docs/04 §2).
 *
 * `scrollToTop` is supplied by the screen (which owns the ScrollView) so an empty-name submit
 * can bring the name field — the form's topmost element — back into view.
 */
export function CreateRoomForm({ scrollToTop }: { scrollToTop?: () => void }) {
  const createRoom = useCreateRoom();
  const cancelCreateRoom = useCancelCreateRoom();
  const userQuery = useCurrentUser();
  const profileQuery = useOwnProfile();

  const isSignedIn = userQuery.data ? !userQuery.data.isAnonymous : false;
  const resolvingName = isSignedIn && profileQuery.isLoading;
  const signedInName = isSignedIn ? (profileQuery.data ?? null) : null;

  const [hostDisplayName, setHostDisplayName] = useState("");
  const [anchorLat, setAnchorLat] = useState<number | null>(null);
  const [anchorLng, setAnchorLng] = useState<number | null>(null);
  const [openNow, setOpenNow] = useState(false);
  const [cuisines, setCuisines] = useState<CuisineId[]>([]);
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [radius, setRadius] = useState(DEFAULT_RADIUS_M);
  const [nameError, setNameError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const nameInputRef = useRef<TextInput>(null);

  function handleSubmit() {
    setNameError(null);
    setValidationError(null);
    // Name first, with its own field-specific inline message — it is the only
    // realistically-reachable failure (the map auto-emits an anchor and the radius
    // slider defaults), so it gets a field-specific error rather than the catch-all.
    // Only guards the typed-name path: a signed-in host's profile name is read-only and
    // guaranteed non-empty (profiles.display_name is NOT NULL), so the check is skipped.
    if (!signedInName && hostDisplayName.trim().length === 0) {
      setNameError("Enter your name");
      // The name field sits at the top of a long form (map, filters, buttons below), so on
      // submit it may be scrolled off-screen — scroll back to it and focus it (opening the
      // keyboard) so the host can type immediately.
      scrollToTop?.();
      nameInputRef.current?.focus();
      return;
    }
    const parsed = createRoomRequestSchema.safeParse({
      host_display_name: signedInName ?? hostDisplayName,
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
        <Text style={styles.creatingAs}>Loading your profile…</Text>
      ) : (
        <Field label="Your name" error={nameError ?? undefined}>
          <Input
            ref={nameInputRef}
            value={hostDisplayName}
            onChangeText={setHostDisplayName}
            maxLength={50}
            placeholder="Your name"
          />
        </Field>
      )}
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
        disabled={resolvingName}
      />
      {/* Ghost-outline Cancel below the primary action, matching the lobby "End room" control:
          abandons creation and returns to Match. No room exists yet, so it's a pure client-side
          discard. Disabled while a create is in flight (the create_room RPC may already be
          committing — see useCancelCreateRoom). */}
      <Button
        variant="ghost"
        label="Cancel"
        onPress={cancelCreateRoom}
        disabled={createRoom.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  // Profile-loading placeholder shown while the signed-in name resolves.
  creatingAs: { ...typography.bodyMd, color: colors.textMuted },
  // Locked signed-in name: read-only, dimmed, lock-iconed — identical treatment to the locked
  // Room-code field on the invite-link Join screen (join-room-form.tsx, docs/10 §3.3/§3.4).
  lockedInput: {
    ...typography.headlineMd,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: undefined,
    backgroundColor: colors.surfaceHighest,
    color: colors.textMuted,
    opacity: 0.8,
  },
  error: { ...typography.bodyMd, color: colors.error },
});
