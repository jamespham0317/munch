"use client";

import {
  createRoomRequestSchema,
  DEFAULT_RADIUS_M,
  type PriceLevel,
} from "@munch/core";
import { type FormEvent, useState } from "react";

import { useCreateRoom } from "./use-create-room";

const PRICE_LEVELS: readonly PriceLevel[] = ["1", "2", "3", "4"];

/** Empty string → NaN so the Zod number schemas reject a blank coordinate/radius. */
function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * Host create-room form. Sets the host's name, the search anchor, the room-wide
 * filters (host-controlled per CLAUDE.md §2), and the default radius, then calls
 * the create flow. Input is validated client-side against the @munch/core schema
 * (docs/06 §3, validate on both ends); the server re-validates authoritatively.
 */
export function CreateRoomForm() {
  const createRoom = useCreateRoom();

  const [hostDisplayName, setHostDisplayName] = useState("");
  const [anchorLabel, setAnchorLabel] = useState("");
  const [anchorLat, setAnchorLat] = useState("");
  const [anchorLng, setAnchorLng] = useState("");
  const [openNow, setOpenNow] = useState(false);
  const [cuisines, setCuisines] = useState("");
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [radius, setRadius] = useState(String(DEFAULT_RADIUS_M));
  const [validationError, setValidationError] = useState<string | null>(null);

  function togglePriceLevel(level: PriceLevel) {
    setPriceLevels((current) =>
      current.includes(level)
        ? current.filter((value) => value !== level)
        : [...current, level],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createRoomRequestSchema.safeParse({
      host_display_name: hostDisplayName,
      anchor_label: anchorLabel,
      anchor_lat: toNumber(anchorLat),
      anchor_lng: toNumber(anchorLng),
      filters: {
        open_now: openNow,
        cuisines: cuisines
          .split(",")
          .map((cuisine) => cuisine.trim())
          .filter((cuisine) => cuisine.length > 0),
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
    <form onSubmit={handleSubmit}>
      <label>
        Your name
        <input
          value={hostDisplayName}
          onChange={(event) => setHostDisplayName(event.target.value)}
          maxLength={50}
        />
      </label>
      <label>
        Area label
        <input
          value={anchorLabel}
          onChange={(event) => setAnchorLabel(event.target.value)}
          placeholder="e.g. Downtown"
        />
      </label>
      <label>
        Latitude
        <input
          value={anchorLat}
          onChange={(event) => setAnchorLat(event.target.value)}
          inputMode="decimal"
          placeholder="37.7749"
        />
      </label>
      <label>
        Longitude
        <input
          value={anchorLng}
          onChange={(event) => setAnchorLng(event.target.value)}
          inputMode="decimal"
          placeholder="-122.4194"
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={openNow}
          onChange={(event) => setOpenNow(event.target.checked)}
        />
        Open now
      </label>
      <label>
        Cuisines (comma-separated)
        <input
          value={cuisines}
          onChange={(event) => setCuisines(event.target.value)}
          placeholder="italian, thai"
        />
      </label>
      <fieldset>
        <legend>Price range</legend>
        {PRICE_LEVELS.map((level) => (
          <label key={level}>
            <input
              type="checkbox"
              checked={priceLevels.includes(level)}
              onChange={() => togglePriceLevel(level)}
            />
            {"$".repeat(Number(level))}
          </label>
        ))}
      </fieldset>
      <label>
        Search radius (m)
        <input
          value={radius}
          onChange={(event) => setRadius(event.target.value)}
          inputMode="numeric"
        />
      </label>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <button type="submit" disabled={createRoom.isPending}>
        {createRoom.isPending ? "Creating…" : "Create room"}
      </button>
    </form>
  );
}
