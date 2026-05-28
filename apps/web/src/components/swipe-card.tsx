import type { DeckRestaurant } from "@munch/core";

/**
 * Presentational swipe card: photo, name, rating, price level, distance. Takes a
 * DeckRestaurant + two button handlers; holds no business logic and reads no data
 * (CLAUDE.md §4). The matching/shuffle/distance rules all live upstream.
 *
 * `distance_m` is the server-computed value from the haversine helper in 0009; we
 * format it but never recompute it.
 */
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
  return (
    <article aria-label={restaurant.name}>
      {restaurant.photo_url ? (
        <img
          src={restaurant.photo_url}
          alt=""
          width={320}
          height={200}
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
