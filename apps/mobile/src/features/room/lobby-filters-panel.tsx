import {
  type CuisineId,
  DEFAULT_RADIUS_M,
  type PriceLevel,
  type Room,
} from "@munch/core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Field } from "../../components/field";
import { FiltersFieldset } from "../../components/filters-fieldset";
import { FiltersSummary } from "../../components/filters-summary";
import { colors, spacing } from "../../theme";
import { useUpdateRoomFilters } from "./use-update-room-filters";

/**
 * Lobby filter editing (RN parity with apps/web's LobbyFiltersPanel). The host can change the
 * whole-room filters (open-now / cuisines / price levels / default radius) before starting —
 * this is the client half of "filters wired end-to-end": the next start_session snapshots them
 * onto the session (CLAUDE.md §2.1). Non-hosts see the same filters read-only (host-controlled,
 * CLAUDE.md §2.2). The control is lobby-only; once a session is active update_room_filters raises
 * SESSION_INVALID_STATE, whose safe message is surfaced rather than crashing. Screens stay thin —
 * all data access lives in the hook / @munch/api-client (CLAUDE.md §4).
 */
export function LobbyFiltersPanel({
  room,
  isHost,
}: {
  room: Room;
  isHost: boolean;
}) {
  if (!isHost) {
    return (
      <View style={styles.section}>
        <Text style={styles.heading}>Filters</Text>
        <FiltersSummary
          openNow={room.filterOpenNow}
          cuisines={room.filterCuisines}
          priceLevels={room.filterPriceLevels}
        />
      </View>
    );
  }
  return <HostFilters room={room} />;
}

function HostFilters({ room }: { room: Room }) {
  const update = useUpdateRoomFilters(room.id);

  // Seed the editable controls from the room's current values; the cuisines column is a plain
  // string[] on Room (forward-compat), but the UI only ever emits taxonomy ids, so narrow it.
  const [openNow, setOpenNow] = useState(room.filterOpenNow);
  const [cuisines, setCuisines] = useState<CuisineId[]>(
    room.filterCuisines as CuisineId[],
  );
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>(
    room.filterPriceLevels,
  );
  const [radius, setRadius] = useState(String(room.defaultRadiusM));

  function handleSave() {
    if (update.isPending) return;
    const radiusM = Number(radius);
    update.mutate({
      filters: { open_now: openNow, cuisines, price_levels: priceLevels },
      default_radius_m: Number.isFinite(radiusM) ? radiusM : DEFAULT_RADIUS_M,
    });
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Filters</Text>
      <FiltersFieldset
        openNow={openNow}
        onOpenNowChange={setOpenNow}
        cuisines={cuisines}
        onCuisinesChange={setCuisines}
        priceLevels={priceLevels}
        onPriceLevelsChange={setPriceLevels}
        disabled={update.isPending}
      />
      <Field label="Search radius (m)">
        <TextInput
          style={styles.input}
          value={radius}
          onChangeText={setRadius}
          keyboardType="number-pad"
          editable={!update.isPending}
        />
      </Field>
      {update.isError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {update.error.message}
        </Text>
      ) : null}
      {update.isSuccess ? (
        <Text style={styles.success}>Filters saved.</Text>
      ) : null}
      <Pressable
        style={[styles.button, update.isPending && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={update.isPending}
      >
        <Text style={styles.buttonText}>
          {update.isPending ? "Saving…" : "Save filters"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { color: colors.text, fontSize: 18, fontWeight: "600" },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.danger },
  success: { color: colors.textMuted },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: "600" },
});
