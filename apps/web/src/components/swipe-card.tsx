"use client";

import { cuisineLabel, type DeckRestaurant } from "@munch/core";
import { Heart, MapPin, Star, X } from "lucide-react";
import { type PointerEvent, useRef, useState } from "react";

import { Card } from "./ui/card";
import { FoodChip } from "./ui/chip";
import { ProgressPill } from "./ui/progress-pill";

/**
 * The Decision Card (design-system.md §8): the swipe card. A photo header with a distance
 * pill overlay, the restaurant name + rating chip, a `price • cuisine` line, and decorative
 * cuisine chips, composed from the web UI primitives (which are seeded from @munch/ui). Takes
 * a DeckRestaurant + two button handlers; holds no business logic and reads no data
 * (CLAUDE.md §4). The matching/shuffle/distance rules all live upstream. Web twin of the
 * Phase B mobile SwipeCard.
 *
 * A drag/throw gesture is layered on for feel: dragging the card past a horizontal
 * threshold and releasing triggers the same onLike/onPass handlers as the buttons (right =
 * like, left = pass). The pass/like buttons remain the accessible fallback (§10). The gesture
 * is pure UI — it only calls the existing handlers and NEVER touches the provider
 * (CLAUDE.md §2.1). The per-frame drag transform is the one inline style that remains (it is
 * computed per pointer move); everything else styles from the Tailwind theme.
 *
 * The middle "save/super-like" bookmark of the mockup is intentionally NOT built — v1 is
 * like/pass only (design-system.md §8, ui-roadmap.md §7).
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

  const priceCuisine = formatPriceCuisine(restaurant);

  return (
    <div aria-label={restaurant.name}>
      {/* Per-frame drag transform is the sole remaining inline style (computed per pointer
          move, design-system.md §8 / ui-roadmap.md exit); the snap-back transition is dropped
          under reduced motion. */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={
          dragX === 0
            ? "touch-pan-y transition-transform motion-reduce:transition-none"
            : "touch-pan-y"
        }
        style={{
          transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
          cursor: disabled ? "default" : "grab",
        }}
      >
        <Card
          padding="decision"
          image={restaurant.photo_url ?? undefined}
          imageAlt=""
          imageHeight={260}
          imageOverlay={
            <ProgressPill
              tone="onImage"
              label={formatDistance(restaurant.distance_m)}
              leadingIcon={
                <MapPin size={12} className="text-heat" aria-hidden />
              }
            />
          }
        >
          <div className="flex items-center justify-between gap-sm">
            <h3 className="min-w-0 flex-shrink truncate text-title-lg text-text">
              {restaurant.name}
            </h3>
            {restaurant.rating !== null ? (
              <ProgressPill
                label={restaurant.rating.toFixed(1)}
                leadingIcon={
                  <Star size={12} className="text-brand" aria-hidden />
                }
              />
            ) : null}
          </div>
          {priceCuisine ? (
            <p className="mt-xs text-body-md text-text-muted">
              {priceCuisine}
              {restaurant.is_open_now === false ? " · closed" : ""}
            </p>
          ) : null}
          {restaurant.cuisines.length > 0 ? (
            <div className="mt-gutter flex flex-wrap gap-base">
              {restaurant.cuisines.map((id) => (
                <FoodChip key={id} label={cuisineLabel(id)} />
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-md flex justify-center gap-lg">
        <button
          type="button"
          onClick={onPass}
          disabled={disabled}
          aria-label="Pass"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-highest text-text shadow-low transition-transform active:translate-y-[var(--munch-press-translate-y)] disabled:opacity-50 disabled:active:translate-y-0 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
        >
          <X size={28} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onLike}
          disabled={disabled}
          aria-label="Like"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-on-brand shadow-low transition-transform active:translate-y-[var(--munch-press-translate-y)] disabled:opacity-50 disabled:active:translate-y-0 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
        >
          <Heart size={28} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** `$$ • Japanese, Seafood` — the price/cuisine summary line; either part may be absent. */
function formatPriceCuisine(restaurant: DeckRestaurant): string {
  const price = restaurant.price_level
    ? "$".repeat(Number(restaurant.price_level))
    : "";
  const cuisines = restaurant.cuisines.map(cuisineLabel).join(", ");
  return [price, cuisines].filter(Boolean).join(" • ");
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
