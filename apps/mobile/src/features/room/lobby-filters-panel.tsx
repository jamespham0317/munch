import {
  type CuisineId,
  DEFAULT_RADIUS_M,
  type PriceLevel,
  type Room,
} from "@munch/core";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AnchorSummary } from "../../components/anchor-summary";
import { FiltersFieldset } from "../../components/filters-fieldset";
import { FiltersSummary } from "../../components/filters-summary";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { colors, spacing, typography } from "../../theme";
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
        <AnchorSummary
          anchorLabel={room.anchorLabel}
          radiusM={room.defaultRadiusM}
        />
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
      {/* Anchor is host-controlled and set on Create Room via the map (no editable map in the
          lobby, Phase 4.6) — shown read-only here; the radius stays editable below. */}
      <AnchorSummary anchorLabel={room.anchorLabel} />
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
        <Input
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
      <Button
        label={update.isPending ? "Saving…" : "Save filters"}
        onPress={handleSave}
        loading={update.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { ...typography.titleLg, color: colors.text },
  error: { ...typography.bodyMd, color: colors.error },
  success: { ...typography.bodyMd, color: colors.textMuted },
});
