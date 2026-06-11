"use client";

import {
  type CuisineId,
  DEFAULT_RADIUS_M,
  type PriceLevel,
  RADIUS_MAX_M,
  type Room,
} from "@munch/core";
import { CheckCircle2, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { AnchorSummary } from "@/components/anchor-summary";
import { FiltersFieldset } from "@/components/filters-fieldset";
import { FiltersSummary } from "@/components/filters-summary";
import { RadiusSlider } from "@/components/radius-slider";
import { Button, Card, Field, Sheet } from "@/components/ui";

import { useUpdateRoomFilters } from "./use-update-room-filters";

/**
 * Lobby filter editing. Filters are whole-room and host-controlled (CLAUDE.md §2.2): the host
 * edits them in a bottom sheet behind a "Filters" toggle, non-hosts see them read-only. Either
 * way they are the client half of "filters wired end-to-end" — the next start_session snapshots
 * them onto the session (CLAUDE.md §2.1). The control is lobby-only; once a session is active
 * update_room_filters raises SESSION_INVALID_STATE, whose safe message is surfaced rather than
 * crashing. Screens stay thin — all data access lives in the hook / @munch/api-client (CLAUDE.md
 * §4).
 */

/** Non-host read-only summary, rendered in the lobby column. */
export function LobbyFiltersSummary({ room }: { room: Room }) {
  return (
    <Card>
      <h2 className="text-title-lg text-text">Filters</h2>
      <div className="mt-base flex flex-col gap-xs">
        <AnchorSummary radiusM={room.defaultRadiusM} />
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

  function handleOpen() {
    setOpenNow(room.filterOpenNow);
    setCuisines(room.filterCuisines as CuisineId[]);
    setPriceLevels(room.filterPriceLevels);
    setRadius(room.defaultRadiusM);
    update.reset();
    setOpen(true);
  }

  function handleApply() {
    if (update.isPending) return;
    update.mutate(
      {
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
          {/* Anchor is host-controlled and set on Create Room via the map (no editable map in
              the lobby, Phase 4.6) — shown read-only here; the radius stays editable below. */}
          <AnchorSummary />
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
