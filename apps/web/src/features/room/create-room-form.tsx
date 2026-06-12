"use client";

import {
  createRoomRequestSchema,
  type CuisineId,
  DEFAULT_RADIUS_M,
  type PriceLevel,
  RADIUS_MAX_M,
} from "@munch/core";
import { Lock } from "lucide-react";
import { type FormEvent, useState } from "react";

import { AnchorMap } from "@/components/anchor-map";
import { FiltersFieldset } from "@/components/filters-fieldset";
import { RadiusSlider } from "@/components/radius-slider";
import { Button, Field, Input } from "@/components/ui";
import { useCurrentUser } from "@/features/auth/use-current-user";
import { useOwnProfile } from "@/features/auth/use-own-profile";

import { useCancelCreateRoom, useCreateRoom } from "./use-create-room";

/**
 * Host create-room form. Sets the host's name, the search anchor, the room-wide
 * filters (host-controlled per CLAUDE.md §2), and the default radius, then calls
 * the create flow. Cuisines come from the closed @munch/core CUISINES taxonomy via
 * FiltersFieldset (no free text). Input is validated client-side against the @munch/core
 * schema (docs/06 §3, validate on both ends); the server re-validates authoritatively.
 * The anchor (anchor_lat/anchor_lng) is set on the AnchorMap by dragging the map under
 * the fixed center pin (Phase 4.6, docs/07 §6.6); "Where are we eating?" heads the map +
 * radius group (no free-text label — Phase 4.8, docs/07 §6.8).
 *
 * A SIGNED-IN host (resolved `profiles` display name) skips the name field — they create with
 * their profile name, shown read-only as a locked name field (lock icon, non-editable, mirroring
 * the locked Room-code field, docs/10 §3.3/§3.4). The gate is the resolved NAME, so a guest, and the rare
 * signed-in-but-no-profile state, both fall back to name entry and are never stuck. This only
 * chooses how the name is supplied; there is no mid-room sign-in here (docs/04 §2).
 */
export function CreateRoomForm() {
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(null);
    setValidationError(null);
    // Name first, with its own friendly inline message — it is the only
    // realistically-reachable failure (the map auto-emits an anchor and the radius
    // slider defaults), so it gets a field-specific error rather than the catch-all.
    // Only guards the typed-name path: a signed-in host's profile name is read-only and
    // guaranteed non-empty (profiles.display_name is NOT NULL), so the check is skipped.
    if (!signedInName && hostDisplayName.trim().length === 0) {
      setNameError(
        "What should we call you? Add your name to create the room.",
      );
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      {signedInName ? (
        <Field label="Your name" htmlFor="host-name">
          <Input
            id="host-name"
            value={signedInName}
            readOnly
            aria-readonly
            leadingIcon={<Lock size={20} aria-hidden />}
            className="cursor-not-allowed bg-surface-highest text-body-md font-bold text-text-muted"
          />
        </Field>
      ) : resolvingName ? (
        <p className="text-body-md text-text-muted">Loading your profile…</p>
      ) : (
        <Field
          label="Your name"
          htmlFor="host-name"
          error={nameError ?? undefined}
        >
          <Input
            id="host-name"
            value={hostDisplayName}
            onChange={(event) => setHostDisplayName(event.target.value)}
            maxLength={50}
            placeholder="Your name"
            autoComplete="name"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "host-name-error" : undefined}
          />
        </Field>
      )}
      {/* "Where are we eating?" heads the map + radius group (Phase 4.8). A plain heading,
          not a <Field> label, so the inner "Search radius" Field's <label> isn't nested. */}
      <div className="flex flex-col gap-base">
        <span className="text-label-md uppercase text-text-muted">
          Where are we eating?
        </span>
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
      </div>
      <FiltersFieldset
        openNow={openNow}
        onOpenNowChange={setOpenNow}
        cuisines={cuisines}
        onCuisinesChange={setCuisines}
        priceLevels={priceLevels}
        onPriceLevelsChange={setPriceLevels}
      />
      {errorMessage ? (
        <p role="alert" className="text-body-md text-error">
          {errorMessage}
        </p>
      ) : null}
      <Button
        type="submit"
        label={createRoom.isPending ? "Creating…" : "Start Room"}
        loading={createRoom.isPending}
        disabled={resolvingName}
      />
      <p className="text-center text-caption text-text-muted">
        Inviting friends will be the next step.
      </p>
      {/* Ghost-outline Cancel below the primary action, matching the lobby "End room" control:
          abandons creation and returns to Match. No room exists yet, so it's a pure client-side
          discard. Disabled while a create is in flight (the create_room RPC may already be
          committing — see useCancelCreateRoom). */}
      <Button
        variant="ghost"
        label="Cancel"
        onClick={cancelCreateRoom}
        disabled={createRoom.isPending}
      />
    </form>
  );
}
