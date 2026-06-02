"use client";

import type { DeckRestaurant } from "@munch/core";
import { type PointerEvent, useRef, useState } from "react";

/**
 * Presentational swipe card: photo, name, rating, price level, distance. Takes a
 * DeckRestaurant + two button handlers; holds no business logic and reads no data
 * (CLAUDE.md §4). The matching/shuffle/distance rules all live upstream.
 *
 * A drag/throw gesture is layered on for feel: dragging the card past a horizontal
 * threshold and releasing triggers the same onLike/onPass handlers as the buttons (right =
 * like, left = pass). The buttons remain the accessible fallback. The gesture is pure UI —
 * it only calls the existing handlers and NEVER touches the provider (CLAUDE.md §2.1).
 *
 * `distance_m` is the server-computed value from the haversine helper in 0009; we
 * format it but never recompute it.
 */

/** Horizontal drag distance (px) past which a release commits the swipe. */
const SWIPE_THRESHOLD_PX = 120;

export function SwipeCard({
  restaurant,
  onLike,
  onPass,
  disabled,
}: {
  restaurant: DeckRestaurant;
  onLike: () => void;
  onPass: () => void;
  disabled: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const startXRef = useRef<number | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    startXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (startXRef.current === null) return;
    setDragX(event.clientX - startXRef.current);
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (startXRef.current === null) return;
    const offset = event.clientX - startXRef.current;
    startXRef.current = null;
    setDragX(0);
    if (disabled) return;
    if (offset >= SWIPE_THRESHOLD_PX) {
      onLike();
    } else if (offset <= -SWIPE_THRESHOLD_PX) {
      onPass();
    }
  }

  return (
    <article aria-label={restaurant.name}>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
          transition:
            startXRef.current === null ? "transform 0.2s ease" : "none",
          touchAction: "pan-y",
          cursor: disabled ? "default" : "grab",
        }}
      >
        {restaurant.photo_url ? (
          <img
            src={restaurant.photo_url}
            alt=""
            width={320}
            height={200}
            draggable={false}
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 320,
              height: 200,
              background: "#eee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            No photo
          </div>
        )}
        <h3>{restaurant.name}</h3>
        <p>
          {restaurant.rating !== null ? (
            <span>⭐ {restaurant.rating.toFixed(1)} </span>
          ) : null}
          {restaurant.price_level
            ? `${"$".repeat(Number(restaurant.price_level))} · `
            : null}
          {formatDistance(restaurant.distance_m)}
          {restaurant.is_open_now === false ? " · closed" : null}
        </p>
        {restaurant.cuisines.length > 0 ? (
          <p>{restaurant.cuisines.join(" · ")}</p>
        ) : null}
      </div>
      <div>
        <button type="button" onClick={onPass} disabled={disabled}>
          Pass
        </button>
        <button type="button" onClick={onLike} disabled={disabled}>
          Like
        </button>
      </div>
    </article>
  );
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
