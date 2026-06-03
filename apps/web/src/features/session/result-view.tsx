"use client";

import { cuisineLabel, type DeckRestaurant } from "@munch/core";
import { MapPin, Navigation, Share2, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button, Card, FoodChip, ProgressPill } from "@/components/ui";

import { MatchConfetti } from "./match-confetti";
import { useMatch } from "./use-match";

/**
 * Match announcement screen (pages.md §3.7, "It's a Match!"). Both entry paths (the swiper's
 * own submit_swipe response and a co-member's subscribeSession match event) pre-seed the same
 * query cache key before navigating, so the common case renders instantly; a fresh fetch only
 * runs on a direct or refreshed entry. Renders both terminal outcomes the same way — a
 * unanimous match and a host-accepted top pick (resolution `host_accepted_top`) — differing
 * only in the headline copy.
 *
 * "Get Directions" and "Share Match" use only the match payload we already hold — they open an
 * external maps app / the OS share sheet (Web Share API, clipboard fallback) and NEVER call the
 * provider (CLAUDE.md §2.1, design-system.md §8). The confetti is suppressed under
 * reduce-motion (§10). Web twin of the Phase B mobile ResultView.
 */
export function ResultView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const matchQuery = useMatch(sessionId);

  if (matchQuery.isPending) {
    return <p className="text-body-md text-text-muted">Loading match…</p>;
  }
  if (matchQuery.isError) {
    return (
      <p role="alert" className="text-body-md text-error">
        {matchQuery.error.message}
      </p>
    );
  }

  const { match, restaurant } = matchQuery.data;
  const isHostPick = match.resolution === "host_accepted_top";
  const headline = isHostPick ? "The host picked!" : "Everyone agreed!";
  const subcopy = isHostPick
    ? "No unanimous match, so the host chose the closest pick. Time to eat."
    : "Looks like you're all craving the same thing. Time to eat.";

  async function handleShare() {
    const data = {
      text: shareMessage(restaurant),
      url: directionsUrl(restaurant),
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(`${data.text} ${data.url}`);
      }
    } catch {
      // Sharing is best-effort; a dismissed or failed share/copy is not surfaced.
    }
  }

  function handleDirections() {
    window.open(directionsUrl(restaurant), "_blank", "noopener,noreferrer");
  }

  return (
    <section className="flex flex-col gap-gutter">
      <MatchConfetti />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => router.replace("/")}
          aria-label="Close"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-text focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
        >
          <X size={24} aria-hidden />
        </button>
      </div>

      <ProgressPill label="It's a Match!" />
      <h2 className="text-display-lg-mobile text-text md:text-display-lg">
        {headline}
      </h2>
      <p className="text-body-md text-text-muted">{subcopy}</p>

      <Card
        image={restaurant.photo_url ?? undefined}
        imageAlt=""
        imageHeight={220}
        imageOverlay={
          restaurant.cuisines.length > 0 ? (
            <div className="flex h-full flex-col justify-end">
              <div className="flex flex-wrap gap-base">
                {restaurant.cuisines.slice(0, 2).map((id) => (
                  <FoodChip key={id} label={cuisineLabel(id)} selected />
                ))}
              </div>
            </div>
          ) : undefined
        }
      >
        <h3 className="text-headline-md text-text">{restaurant.name}</h3>
        <div className="mt-xs flex items-center gap-base">
          <MapPin size={14} className="text-text-muted" aria-hidden />
          <span className="text-body-md text-text-muted">
            {formatPriceCuisine(restaurant)}
          </span>
          {restaurant.rating !== null ? (
            <ProgressPill
              label={restaurant.rating.toFixed(1)}
              leadingIcon={
                <Star size={12} className="text-brand" aria-hidden />
              }
            />
          ) : null}
        </div>
      </Card>

      <Button
        label="Get Directions"
        onClick={handleDirections}
        leadingIcon={<Navigation size={18} aria-hidden />}
      />
      <Button
        label="Share Match"
        variant="ghost"
        onClick={() => void handleShare()}
        leadingIcon={<Share2 size={18} aria-hidden />}
      />
    </section>
  );
}

/** `1.2 km away • $$` for the match meta row; the pin icon is rendered separately. */
function formatPriceCuisine(restaurant: DeckRestaurant): string {
  const distance = formatDistance(restaurant.distance_m);
  const price = restaurant.price_level
    ? "$".repeat(Number(restaurant.price_level))
    : "";
  return [`${distance} away`, price].filter(Boolean).join(" • ");
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** A universal maps deep link from the matched restaurant's coordinates (no provider call). */
function directionsUrl(restaurant: DeckRestaurant): string {
  const query = encodeURIComponent(`${restaurant.lat},${restaurant.lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function shareMessage(restaurant: DeckRestaurant): string {
  return `It's a match — we're eating at ${restaurant.name}!`;
}
