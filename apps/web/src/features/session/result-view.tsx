"use client";

import Link from "next/link";

import { useMatch } from "./use-match";

/**
 * Match announcement screen. Both entry paths (the swiper's own submit_swipe response
 * and a co-member's subscribeSession match event) pre-seed the same query cache key
 * before navigating, so the common case renders instantly; a fresh fetch only runs on a
 * direct or refreshed entry. Renders both terminal outcomes the same way — a unanimous
 * match and a host-accepted top pick (resolution `host_accepted_top`) — differing only in
 * the headline copy.
 */
export function ResultView({ sessionId }: { sessionId: string }) {
  const matchQuery = useMatch(sessionId);

  if (matchQuery.isPending) {
    return <p>Loading match…</p>;
  }
  if (matchQuery.isError) {
    return <p role="alert">{matchQuery.error.message}</p>;
  }

  const { match, restaurant } = matchQuery.data;
  const headline =
    match.resolution === "host_accepted_top"
      ? "The host picked"
      : "It’s a match!";

  return (
    <section>
      <h2>{headline}</h2>
      {restaurant.photo_url ? (
        <img
          src={restaurant.photo_url}
          alt=""
          width={320}
          height={200}
          style={{ objectFit: "cover" }}
        />
      ) : null}
      <h3>{restaurant.name}</h3>
      {restaurant.rating !== null ? (
        <p>⭐ {restaurant.rating.toFixed(1)}</p>
      ) : null}
      <p>Session ended.</p>
      <Link href="/">Back home</Link>
    </section>
  );
}
