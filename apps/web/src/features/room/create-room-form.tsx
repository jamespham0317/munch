"use client";

import {
  createRoomRequestSchema,
  type CuisineId,
  DEFAULT_RADIUS_M,
  type PriceLevel,
  RADIUS_MAX_M,
} from "@munch/core";
import { MapPin } from "lucide-react";
import { type FormEvent, useState } from "react";

import { FiltersFieldset } from "@/components/filters-fieldset";
import { RadiusSlider } from "@/components/radius-slider";
import { Button, Field, Input } from "@/components/ui";

import { useCreateRoom } from "./use-create-room";

/** Empty string → NaN so the Zod number schemas reject a blank coordinate. */
function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * Host create-room form. Sets the host's name, the search anchor, the room-wide
 * filters (host-controlled per CLAUDE.md §2), and the default radius, then calls
 * the create flow. Cuisines come from the closed @munch/core CUISINES taxonomy via
 * FiltersFieldset (no free text). Input is validated client-side against the @munch/core
 * schema (docs/06 §3, validate on both ends); the server re-validates authoritatively.
 * The "Where are we eating?" pin is a decorative affordance: geocoding/map is deferred
 * (presentation-only reskin), so the host enters lat/lng.
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      <Field label="Your name" htmlFor="host-name">
        <Input
          id="host-name"
          value={hostDisplayName}
          onChange={(event) => setHostDisplayName(event.target.value)}
          maxLength={50}
          placeholder="Your name"
          autoComplete="name"
        />
      </Field>
      <Field label="Where are we eating?" htmlFor="anchor-label">
        <div className="relative">
          <Input
            id="anchor-label"
            className="pr-11"
            value={anchorLabel}
            onChange={(event) => setAnchorLabel(event.target.value)}
            placeholder="Search neighborhood or city…"
          />
          <span className="pointer-events-none absolute inset-y-0 right-gutter flex items-center">
            <MapPin size={18} className="text-text-faint" aria-hidden />
          </span>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-gutter">
        <Field label="Latitude" htmlFor="anchor-lat">
          <Input
            id="anchor-lat"
            value={anchorLat}
            onChange={(event) => setAnchorLat(event.target.value)}
            inputMode="decimal"
            placeholder="37.7749"
          />
        </Field>
        <Field label="Longitude" htmlFor="anchor-lng">
          <Input
            id="anchor-lng"
            value={anchorLng}
            onChange={(event) => setAnchorLng(event.target.value)}
            inputMode="decimal"
            placeholder="-122.4194"
          />
        </Field>
      </div>
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
        <p role="alert" className="text-body-md text-error">
          {errorMessage}
        </p>
      ) : null}
      <Button
        type="submit"
        label={createRoom.isPending ? "Creating…" : "Start Room"}
        loading={createRoom.isPending}
      />
      <p className="text-center text-caption text-text-muted">
        Inviting friends will be the next step.
      </p>
    </form>
  );
}
