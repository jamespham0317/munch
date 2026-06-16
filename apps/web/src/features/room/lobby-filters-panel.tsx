"use client";

import {
  type CuisineId,
  DEFAULT_RADIUS_M,
  type LatLng,
  type PriceLevel,
  RADIUS_MAX_M,
  type Room,
} from "@munch/core";
import { CheckCircle2, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { AnchorMap } from "@/components/anchor-map";
import { FiltersFieldset } from "@/components/filters-fieldset";
import { FiltersSummary } from "@/components/filters-summary";
import { RadiusSlider } from "@/components/radius-slider";
import { Button, Card, Field, Sheet } from "@/components/ui";

import { useUpdateRoomFilters } from "./use-update-room-filters";

/**
 * Lobby filter editing. Filters AND the anchor are whole-room and host-controlled (CLAUDE.md
 * §2.2): the host edits them in a bottom sheet behind a "Filters" toggle (anchor via the same
 * map as Create Room), non-hosts see them read-only — the anchor as a locked,
 * non-interactive map (docs/10 §3.5). Either way they are the client half of "filters wired
 * end-to-end" — the next start_session snapshots them onto the session (CLAUDE.md §2.1). The
 * control is lobby-only; once a session is active update_room_filters raises
 * SESSION_INVALID_STATE, whose safe message is surfaced rather than crashing. Screens stay thin
 * — all data access lives in the hook / @munch/api-client (CLAUDE.md §4). Edits push live to all
 * members via the rooms realtime channel (subscribeRoomSettings, 0021) wired in useRoomLobby.
 */

function formatKm(metres: number): string {
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Non-host read-only summary, rendered in the lobby column. */
export function LobbyFiltersSummary({ room }: { room: Room }) {
  // Memoized so the static map isn't torn down and rebuilt on every render — it remounts only
  // when the host actually moves the anchor (delivered live via the rooms channel).
  const center = useMemo<LatLng>(
    () => ({ lat: room.anchorLat, lng: room.anchorLng }),
    [room.anchorLat, room.anchorLng],
  );
  return (
    <Card>
      <h2 className="text-title-lg text-text">Filters</h2>
      <div className="mt-base flex flex-col gap-base">
        <div className="flex flex-col gap-xs">
          <AnchorMap
            radiusM={room.defaultRadiusM}
            initialCenter={center}
            readOnly
          />
          <p className="text-caption text-text-muted">
            {formatKm(room.defaultRadiusM)} radius
          </p>
        </div>
        <FiltersSummary
          openNow={room.filterOpenNow}
          cuisines={room.filterCuisines}
          priceLevels={room.filterPriceLevels}
        />
      </div>
    </Card>
  );
}

/**
 * Host control: a "Filters" toggle pill (Stitch "Lobby") that opens the editable filters in a
 * bottom Sheet. "Apply filters" saves via update_room_filters and closes the sheet on success;
 * an error keeps it open. Dismissing without applying discards the edits — Apply is the only
 * commit path — so the controls re-seed from the room's current values each time it opens.
 */
export function LobbyFiltersButton({ room }: { room: Room }) {
  const update = useUpdateRoomFilters(room.id);
  const [open, setOpen] = useState(false);

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
  // Staged anchor: seeded from the room on open, updated as the host pans the map (the map's
  // onAnchorChange emits its center). Committed only on Apply, like every other control here.
  const [anchor, setAnchor] = useState<LatLng>({
    lat: room.anchorLat,
    lng: room.anchorLng,
  });
  // The map's starting center is the room's current anchor when the sheet opens. Memoized on the
  // room anchor so it stays stable while the host pans (the room row only changes after Apply,
  // which closes the sheet), avoiding a mid-edit map rebuild.
  const initialCenter = useMemo<LatLng>(
    () => ({ lat: room.anchorLat, lng: room.anchorLng }),
    [room.anchorLat, room.anchorLng],
  );

  function handleOpen() {
    setOpenNow(room.filterOpenNow);
    setCuisines(room.filterCuisines as CuisineId[]);
    setPriceLevels(room.filterPriceLevels);
    setRadius(room.defaultRadiusM);
    setAnchor({ lat: room.anchorLat, lng: room.anchorLng });
    update.reset();
    setOpen(true);
  }

  function handleApply() {
    if (update.isPending) return;
    update.mutate(
      {
        anchor_lat: anchor.lat,
        anchor_lng: anchor.lng,
        filters: { open_now: openNow, cuisines, price_levels: priceLevels },
        default_radius_m: Number.isFinite(radius) ? radius : DEFAULT_RADIUS_M,
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-label-md text-brand transition-transform hover:bg-brand/10 active:scale-95"
      >
        <SlidersHorizontal size={18} aria-hidden />
        Filters
      </button>
      <Sheet
        open={open}
        onDismiss={() => setOpen(false)}
        title="Filters"
        dismissDisabled={update.isPending}
        footer={
          <div className="flex flex-col gap-base">
            <Button
              label={update.isPending ? "Applying…" : "Apply filters"}
              onClick={handleApply}
              loading={update.isPending}
              leadingIcon={<CheckCircle2 size={20} aria-hidden />}
            />
            {update.isError ? (
              <p role="alert" className="text-body-md text-error">
                {update.error.message}
              </p>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-col gap-md">
          {/* Anchor is host-controlled (CLAUDE.md §2.2), edited via the same map as Create Room.
              The host pans to set the anchor; the radius slider below drives the map zoom and the
              fixed ring. */}
          <div className="flex flex-col gap-base">
            <span className="text-label-md uppercase text-text-muted">
              Where are we eating?
            </span>
            <AnchorMap
              radiusM={radius}
              initialCenter={initialCenter}
              onAnchorChange={(lat, lng) => setAnchor({ lat, lng })}
            />
          </div>
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
        </div>
      </Sheet>
    </>
  );
}
