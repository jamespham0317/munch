"use client";

import {
  type CuisineId,
  DEFAULT_RADIUS_M,
  type PriceLevel,
  RADIUS_MAX_M,
  type Room,
} from "@munch/core";
import { useState } from "react";

import { FiltersFieldset } from "@/components/filters-fieldset";
import { FiltersSummary } from "@/components/filters-summary";
import { RadiusSlider } from "@/components/radius-slider";
import { Button, Card, Field } from "@/components/ui";

import { useUpdateRoomFilters } from "./use-update-room-filters";

/**
 * Lobby filter editing. The host can change the whole-room filters (open-now / cuisines /
 * price levels / default radius) before starting — this is the client half of "filters wired
 * end-to-end": the next start_session snapshots them onto the session (CLAUDE.md §2.1).
 * Non-hosts see the same filters read-only (host-controlled, CLAUDE.md §2.2). The control is
 * lobby-only; once a session is active update_room_filters raises SESSION_INVALID_STATE, whose
 * safe message is surfaced rather than crashing. Screens stay thin — all data access lives in
 * the hook / @munch/api-client (CLAUDE.md §4).
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
      <Card>
        <h2 className="text-title-lg text-text">Filters</h2>
        <div className="mt-base">
          <FiltersSummary
            openNow={room.filterOpenNow}
            cuisines={room.filterCuisines}
            priceLevels={room.filterPriceLevels}
          />
        </div>
      </Card>
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
  const [radius, setRadius] = useState(room.defaultRadiusM);

  function handleSave() {
    if (update.isPending) return;
    update.mutate({
      filters: { open_now: openNow, cuisines, price_levels: priceLevels },
      default_radius_m: Number.isFinite(radius) ? radius : DEFAULT_RADIUS_M,
    });
  }

  return (
    <Card>
      <h2 className="text-title-lg text-text">Filters</h2>
      <div className="mt-md flex flex-col gap-md">
        <FiltersFieldset
          openNow={openNow}
          onOpenNowChange={setOpenNow}
          cuisines={cuisines}
          onCuisinesChange={setCuisines}
          priceLevels={priceLevels}
          onPriceLevelsChange={setPriceLevels}
          disabled={update.isPending}
        />
        <Field label="Search radius">
          <RadiusSlider
            valueM={radius}
            maxM={RADIUS_MAX_M}
            onChange={setRadius}
          />
        </Field>
        {update.isError ? (
          <p role="alert" className="text-body-md text-error">
            {update.error.message}
          </p>
        ) : null}
        {update.isSuccess ? (
          <p className="text-body-md text-text-muted">Filters saved.</p>
        ) : null}
        <Button
          label={update.isPending ? "Saving…" : "Save filters"}
          variant="ghost"
          onClick={handleSave}
          disabled={update.isPending}
          loading={update.isPending}
        />
      </div>
    </Card>
  );
}
