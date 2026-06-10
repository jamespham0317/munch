import { randomUUID } from "node:crypto";

import type { CreateRoomRequest } from "@munch/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { signInAnonymously } from "./auth";
import { getMatchHistory } from "./endpoints/history";
import type { SessionEvent } from "./endpoints/realtime";
import { subscribeSession } from "./endpoints/realtime";
import { createRoom, joinRoom, leaveRoom } from "./endpoints/rooms";
import {
  getResolutionRanking,
  resolveSession,
  startSession,
} from "./endpoints/sessions";
import { submitSwipe } from "./endpoints/swipes";
import type { ClientResult } from "./errors";

/**
 * Phase 2 + Phase 3 integration tests for the core mechanic against a LOCAL Supabase, run
 * through the real api-client functions so the snake↔camel + error mapping are exercised
 * end-to-end. The highest-risk logic lives here: the server-authoritative unanimous match
 * check (incl. member-leaves-mid-session), submit_swipe idempotency, the host-leave
 * session-cancel, the realtime match event (Phase 2, CLAUDE.md §7), and the Phase-3 host
 * resolution surface — deck-exhaustion → awaiting_host_resolution, the closest-to-unanimous
 * ranking, and resolve_session accept_top / widen (CLAUDE.md §2.1, §2.4).
 *
 * GATING: like rooms.integration.test.ts these skip unless the SUPABASE_TEST_* env vars are
 * present, so `pnpm test` stays green in CI (which starts no Supabase). The pure unit tests
 * (matching.test.ts, ranking.test.ts, swipes.test.ts, sessions.test.ts, errors.test.ts)
 * always run. To run these locally:
 *
 *   supabase start && supabase db reset
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321 \
 *   SUPABASE_TEST_ANON_KEY=<anon key from `supabase start`> \
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=<service_role key from `supabase start`> \
 *     pnpm --filter @munch/api-client test
 *
 * The Edge-Function blocks (start_session, and Phase-3 resolve_session accept_top/widen) ALSO
 * need the functions served with the FakeProvider (so tests never hit the real provider —
 * CLAUDE.md §7). Opt in with MUNCH_TEST_EDGE=1 and, in a second terminal, serve ALL functions
 * (one command covers both start-session and resolve-session):
 *
 *   supabase functions serve --env-file supabase/functions/.env.test
 *
 * where .env.test sets PROVIDER=fake (+ the local SUPABASE_URL / SERVICE_ROLE key). See
 * supabase/functions/.env.example. The Phase-3 exhaustion + ranking + realtime-status tests
 * are pure RPC/realtime paths and run under ENABLED alone; only accept_top/widen need the
 * served Edge Function and self-skip (early return) when MUNCH_TEST_EDGE is unset.
 *
 * Keys come from the environment, never inlined — a hardcoded `eyJ…` JWT would trip
 * scripts/check-secrets.sh (a CI gate; CLAUDE.md §3). The service-role client is used ONLY for
 * deterministic setup/teardown, never shipped.
 */

const TEST_URL = process.env.SUPABASE_TEST_URL;
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const ENABLED = Boolean(TEST_URL && ANON_KEY && SERVICE_KEY);
/** The start_session block additionally needs the edge fn served with PROVIDER=fake. */
const EDGE_ENABLED = ENABLED && process.env.MUNCH_TEST_EDGE === "1";

/** Provider tag for restaurants seeded directly by these tests (kept distinct from the edge
 *  FakeProvider's `fake`, so each block cleans up only its own rows in afterAll). */
const SEED_PROVIDER = "fake-it";
/** The FakeProvider fixture length (supabase/functions/_shared/provider/fake-restaurants.json). */
const FAKE_DECK_SIZE = 5;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is required to run the session integration tests.`,
    );
  }
  return value;
}

/** A Node-side client with session persistence/refresh off so identities stay isolated. */
function makeClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as SupabaseClient;
}

/** Assert a ClientResult succeeded and return its data (narrows away the error variant). */
function unwrap<T>(result: ClientResult<T>): T {
  if (result.error) {
    throw new Error(`expected success but got ${result.error.error.code}`);
  }
  return result.data;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Indexed access under noUncheckedIndexedAccess: assert the element is present. */
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`index ${i} out of bounds`);
  return v;
}

function makeCreateReq(name: string): CreateRoomRequest {
  return {
    host_display_name: name,
    anchor_label: "Test Anchor",
    anchor_lat: 37.7749,
    anchor_lng: -122.4194,
    // Unfiltered baseline: the edge FakeProvider now HONORS filters (Phase 4), so an
    // open_now/cuisine/price filter would shrink the returned fixture. These tests assert
    // on the FULL fixture (deck-fetch-once, widen-unseen), so the baseline carries no filter.
    filters: { open_now: false, cuisines: [], price_levels: [] },
    default_radius_m: 3000,
  };
}

describe.skipIf(!ENABLED)("Phase 2 core mechanic (integration)", () => {
  // Deleting a room cascades to its sessions → cached_decks/swipes/matches (0002 FKs). Seeded
  // `restaurants` have no room FK, so they're tracked and purged by provider tag separately.
  const createdRoomIds: string[] = [];
  const createdUserIds: string[] = [];

  let admin: SupabaseClient;
  let url: string;
  let anonKey: string;

  /** A member: its own client + the member_id from create/join, for presence toggles. */
  interface Member {
    client: SupabaseClient;
    memberId: string;
    userId: string;
  }

  /** Mint a fresh anonymous identity (own client + session), tracked for teardown. */
  async function newClient(): Promise<{
    client: SupabaseClient;
    userId: string;
  }> {
    const client = makeClient(url, anonKey);
    const session = unwrap(await signInAnonymously(client));
    createdUserIds.push(session.user.id);
    return { client, userId: session.user.id };
  }

  /** Create a room and return its id plus the host as a Member. */
  async function newRoomWithHost(
    name: string,
  ): Promise<{ roomId: string; host: Member }> {
    const { client, userId } = await newClient();
    const { room, member } = unwrap(
      await createRoom(client, makeCreateReq(name)),
    );
    createdRoomIds.push(room.id);
    return { roomId: room.id, host: { client, memberId: member.id, userId } };
  }

  /** Add a guest member to a room by code. */
  async function addGuest(code: string, name: string): Promise<Member> {
    const { client, userId } = await newClient();
    const { member } = unwrap(
      await joinRoom(client, { code, display_name: name }),
    );
    return { client, memberId: member.id, userId };
  }

  /** The room's share code (needed by addGuest); read via the admin client. */
  async function roomCode(roomId: string): Promise<string> {
    const { data, error } = await admin
      .from("rooms")
      .select("code")
      .eq("id", roomId)
      .single()
      .returns<{ code: string }>();
    if (error || !data) throw new Error(`roomCode failed: ${error?.message}`);
    return data.code;
  }

  /**
   * Seed an `active` session with a cached deck directly via the service-role client —
   * bypasses the start_session Edge Function so the match-check tests don't depend on the
   * provider being served. The deck is what start_session would have produced.
   */
  async function seedActiveSession(
    roomId: string,
    deckSize: number,
  ): Promise<{ sessionId: string; restaurantIds: string[] }> {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const restRows = Array.from({ length: deckSize }, (_, i) => ({
      provider: SEED_PROVIDER,
      provider_ref: `seed-${randomUUID()}`,
      name: `Seed Restaurant ${i}`,
      lat: 37.775 + i * 0.001,
      lng: -122.419 - i * 0.001,
      rating: 4.0,
      price_level: "2",
      cuisines: ["italian"],
      photo_url: null,
      is_open_now: true,
      expires_at: expiresAt,
    }));
    const { data: rests, error: rErr } = await admin
      .from("restaurants")
      .insert(restRows)
      .select("id")
      .returns<{ id: string }[]>();
    if (rErr || !rests) throw new Error(`seed restaurants: ${rErr?.message}`);
    const restaurantIds = rests.map((r) => r.id);

    const { data: sess, error: sErr } = await admin
      .from("sessions")
      .insert({
        room_id: roomId,
        status: "active",
        radius_m: 3000,
        filter_open_now: true,
        filter_cuisines: [],
        filter_price_levels: [],
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single()
      .returns<{ id: string }>();
    if (sErr || !sess) throw new Error(`seed session: ${sErr?.message}`);

    const deckRows = restaurantIds.map((restaurant_id) => ({
      session_id: sess.id,
      restaurant_id,
      added_round: 0,
    }));
    const { error: dErr } = await admin.from("cached_decks").insert(deckRows);
    if (dErr) throw new Error(`seed cached_decks: ${dErr.message}`);

    return { sessionId: sess.id, restaurantIds };
  }

  async function sessionStatus(sessionId: string): Promise<string> {
    const { data, error } = await admin
      .from("sessions")
      .select("status")
      .eq("id", sessionId)
      .single()
      .returns<{ status: string }>();
    if (error || !data) throw new Error(`sessionStatus: ${error?.message}`);
    return data.status;
  }

  async function matchRowCount(sessionId: string): Promise<number> {
    const { count, error } = await admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (error) throw new Error(`matchRowCount: ${error.message}`);
    return count ?? 0;
  }

  beforeAll(() => {
    url = required("SUPABASE_TEST_URL", TEST_URL);
    anonKey = required("SUPABASE_TEST_ANON_KEY", ANON_KEY);
    const serviceKey = required("SUPABASE_TEST_SERVICE_ROLE_KEY", SERVICE_KEY);
    admin = makeClient(url, serviceKey);
  });

  afterAll(async () => {
    if (createdRoomIds.length > 0) {
      await admin.from("rooms").delete().in("id", createdRoomIds);
    }
    // Rooms are gone (cascading away sessions/matches), so the seeded restaurants no longer
    // have referencing rows and can be safely purged by their tag.
    await admin.from("restaurants").delete().eq("provider", SEED_PROVIDER);
    for (const uid of createdUserIds) {
      await admin.auth.admin.deleteUser(uid);
    }
  });

  it("submit_swipe declares the match only on the last present member's like", async () => {
    const { roomId, host } = await newRoomWithHost("Host A");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const g2 = await addGuest(code, "Guest 2");
    const { sessionId, restaurantIds } = await seedActiveSession(roomId, 3);
    const card = at(restaurantIds, 0);
    const req = {
      session_id: sessionId,
      restaurant_id: card,
      decision: "like" as const,
    };

    const r1 = unwrap(await submitSwipe(host.client, req));
    expect(r1).toEqual({ recorded: true, match: null });
    const r2 = unwrap(await submitSwipe(g1.client, req));
    expect(r2).toEqual({ recorded: true, match: null });

    // Third (last present) like → the server declares the match, atomically.
    const r3 = unwrap(await submitSwipe(g2.client, req));
    expect(r3.match).not.toBeNull();
    expect(r3.match?.restaurant_id).toBe(card);
    expect(r3.match?.resolution).toBe("unanimous");
    expect(await sessionStatus(sessionId)).toBe("matched");
  });

  it("submit_swipe is idempotent — re-liking a matched card doesn't duplicate or regress", async () => {
    const { roomId, host } = await newRoomWithHost("Host B");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const { sessionId, restaurantIds } = await seedActiveSession(roomId, 3);
    const card = at(restaurantIds, 1);
    const req = {
      session_id: sessionId,
      restaurant_id: card,
      decision: "like" as const,
    };

    // This room has exactly 2 present members (host + g1). The host likes once...
    expect(unwrap(await submitSwipe(host.client, req)).match).toBeNull();
    // ...and re-likes while the session is still active: the insert is idempotent
    // (on conflict do nothing), so this is a no-op that still reports no match.
    expect(unwrap(await submitSwipe(host.client, req)).match).toBeNull();
    expect(await sessionStatus(sessionId)).toBe("active");

    // g1's like is the last present member's → the server declares the match.
    const declaring = unwrap(await submitSwipe(g1.client, req));
    expect(declaring.match?.restaurant_id).toBe(card);
    expect(await sessionStatus(sessionId)).toBe("matched");
    expect(await matchRowCount(sessionId)).toBe(1);

    // Re-submitting after the match: the session is terminal, so submit_swipe refuses with
    // SESSION_INVALID_STATE (you can't swipe on an ended session). Crucially this is NOT a
    // regression — no duplicate match row, status stays `matched`.
    const replay = await submitSwipe(g1.client, req);
    expect(replay.error?.error.code).toBe("SESSION_INVALID_STATE");
    expect(await matchRowCount(sessionId)).toBe(1);
    expect(await sessionStatus(sessionId)).toBe("matched");
  });

  it("re-evaluates against the live cohort when a non-liker leaves mid-session", async () => {
    const { roomId, host } = await newRoomWithHost("Host C");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const g2 = await addGuest(code, "Guest 2");
    const { sessionId, restaurantIds } = await seedActiveSession(roomId, 3);
    const card = at(restaurantIds, 0);
    const req = {
      session_id: sessionId,
      restaurant_id: card,
      decision: "like" as const,
    };

    // 2 of 3 active members like the card → not unanimous yet.
    expect(unwrap(await submitSwipe(g1.client, req)).match).toBeNull();
    expect(unwrap(await submitSwipe(g2.client, req)).match).toBeNull();
    expect(await sessionStatus(sessionId)).toBe("active");

    // The host (the lone non-liker) leaves → active cohort is now {g1, g2}, both likers.
    const { error: leaveErr } = await admin
      .from("room_members")
      .update({ left_at: new Date().toISOString() })
      .eq("id", host.memberId);
    expect(leaveErr).toBeNull();

    // A re-evaluation by a remaining member declares the match against the smaller cohort
    // (CLAUDE.md §2.3 — "every currently ACTIVE member", left_at IS NULL). g1's like already
    // exists, so this is an idempotent insert whose match check now passes.
    const reeval = unwrap(await submitSwipe(g1.client, req));
    expect(reeval.match?.restaurant_id).toBe(card);
    expect(await sessionStatus(sessionId)).toBe("matched");
  });

  it("leaveRoom by the host ends the room AND cancels the active session", async () => {
    const { roomId, host } = await newRoomWithHost("Host D");
    const { sessionId } = await seedActiveSession(roomId, 3);

    const result = unwrap(await leaveRoom(host.client, roomId));
    expect(result.roomEnded).toBe(true);
    expect(await sessionStatus(sessionId)).toBe("cancelled");

    const { data: roomRow } = await admin
      .from("rooms")
      .select("is_active")
      .eq("id", roomId)
      .single()
      .returns<{ is_active: boolean }>();
    expect(roomRow?.is_active).toBe(false);
  });

  it("cancel_active_session raises NOT_HOST for a non-host caller", async () => {
    const { roomId } = await newRoomWithHost("Host E");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    await seedActiveSession(roomId, 3);

    // Call the RPC directly (the api-client never exposes it to non-hosts). The RPC raises
    // 'NOT_HOST' as the exception MESSAGE; the active session must remain untouched.
    const { error } = await g1.client.rpc("cancel_active_session", {
      p_room_id: roomId,
    });
    expect(error?.message).toBe("NOT_HOST");
  });

  it("subscribeSession delivers a SessionMatchEvent to a co-member subscriber", async () => {
    const { roomId, host } = await newRoomWithHost("Host F");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const { sessionId, restaurantIds } = await seedActiveSession(roomId, 3);
    const card = at(restaurantIds, 0);
    const req = {
      session_id: sessionId,
      restaurant_id: card,
      decision: "like" as const,
    };

    // Realtime needs the subscriber's JWT; set it explicitly since persistSession is off.
    const token = (await g1.client.auth.getSession()).data.session
      ?.access_token;
    await g1.client.realtime.setAuth(token ?? null);

    let resolveMatch: (e: SessionEvent) => void = () => undefined;
    const matchEvent = new Promise<SessionEvent>((resolve) => {
      resolveMatch = resolve;
    });
    const channel = subscribeSession(g1.client, sessionId, (event) => {
      if (event.kind === "match") resolveMatch(event);
    });

    try {
      // Give the subscription a moment to reach SUBSCRIBED before triggering the match.
      await delay(1500);
      // g1 (the subscriber) likes first, host likes last → the match is inserted by the
      // host's submit_swipe, and g1 must receive it via the channel (not its own response).
      expect(unwrap(await submitSwipe(g1.client, req)).match).toBeNull();
      unwrap(await submitSwipe(host.client, req));

      const event = await Promise.race([
        matchEvent,
        delay(15_000).then(() => null),
      ]);

      expect(event, "no match event received within timeout").not.toBeNull();
      if (event && event.kind === "match") {
        expect(event.payload.session_id).toBe(sessionId);
        expect(event.payload.match.restaurant_id).toBe(card);
        expect(event.payload.restaurant.id).toBe(card);
      }
    } finally {
      await g1.client.removeChannel(channel);
    }
  }, 20_000);
});

describe.skipIf(!EDGE_ENABLED)(
  "start_session Edge Function (integration)",
  () => {
    const createdRoomIds: string[] = [];
    const createdUserIds: string[] = [];

    let admin: SupabaseClient;
    let url: string;
    let anonKey: string;

    async function newHostClient(name: string): Promise<{
      client: SupabaseClient;
      roomId: string;
    }> {
      const client = makeClient(url, anonKey);
      const session = unwrap(await signInAnonymously(client));
      createdUserIds.push(session.user.id);
      const { room } = unwrap(await createRoom(client, makeCreateReq(name)));
      createdRoomIds.push(room.id);
      return { client, roomId: room.id };
    }

    async function deckSizeFor(roomId: string): Promise<number> {
      const { data: sess } = await admin
        .from("sessions")
        .select("id")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<{ id: string }[]>();
      const sessionId = sess?.[0]?.id;
      if (!sessionId) return 0;
      const { count } = await admin
        .from("cached_decks")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId);
      return count ?? 0;
    }

    beforeAll(() => {
      url = required("SUPABASE_TEST_URL", TEST_URL);
      anonKey = required("SUPABASE_TEST_ANON_KEY", ANON_KEY);
      const serviceKey = required(
        "SUPABASE_TEST_SERVICE_ROLE_KEY",
        SERVICE_KEY,
      );
      admin = makeClient(url, serviceKey);
    });

    afterAll(async () => {
      if (createdRoomIds.length > 0) {
        await admin.from("rooms").delete().in("id", createdRoomIds);
      }
      // The edge FakeProvider upserts `restaurants` tagged provider='fake'; purge them once the
      // referencing sessions/cached_decks are gone (cascaded with the rooms above).
      await admin.from("restaurants").delete().eq("provider", "fake");
      for (const uid of createdUserIds) {
        await admin.auth.admin.deleteUser(uid);
      }
    });

    it("fetches the deck exactly once and activates the session", async () => {
      const { client, roomId } = await newHostClient("Edge Host A");

      const result = unwrap(await startSession(client, { radius_m: 3000 }));
      expect(result.session.status).toBe("active");
      expect(result.deck_size).toBe(FAKE_DECK_SIZE);

      // The deck cached == one fetch's worth (FakeProvider returns the whole fixture once).
      expect(await deckSizeFor(roomId)).toBe(FAKE_DECK_SIZE);

      // A second start is refused — proving NO second provider fetch happens for the room.
      const second = await startSession(client, { radius_m: 3000 });
      expect(second.error?.error.code).toBe("SESSION_INVALID_STATE");
    });

    it("surfaces PROVIDER_ERROR when the provider throws (requires PROVIDER_FAKE_THROW=1)", async () => {
      // Only meaningful when the served function has PROVIDER_FAKE_THROW set; skipped otherwise
      // so the happy-path run above doesn't false-fail. Opt in with MUNCH_TEST_EDGE_THROW=1.
      if (process.env.MUNCH_TEST_EDGE_THROW !== "1") return;
      const { client } = await newHostClient("Edge Host B");
      const result = await startSession(client, { radius_m: 3000 });
      expect(result.error?.error.code).toBe("PROVIDER_ERROR");
    });
  },
);

/**
 * Phase 3 host-resolution integration tests (CLAUDE.md §2.1, §2.4; docs/04 §3.7–§3.9). The
 * highest-risk Phase-3 behavior, exercised through the real api-client + local Supabase:
 *   * deck exhaustion → awaiting_host_resolution (submit_swipe, present-cohort scoped);
 *   * get_resolution_ranking — fewest passes, then rating, then distance (NOT raw likes);
 *   * resolve_session accept_top (ZERO provider calls) + widen (EXACTLY ONE, appends unseen);
 *   * the awaiting_host_resolution / resolved realtime status transitions reach a co-member.
 *
 * Exhaustion + ranking + realtime are pure RPC/realtime paths → run under ENABLED. accept_top
 * and widen go through the resolve-session Edge Function (widen needs the server-only provider
 * key) → those tests self-skip with an early return unless MUNCH_TEST_EDGE=1 and the function
 * is served with PROVIDER=fake (same convention as the PROVIDER_FAKE_THROW test above).
 */
describe.skipIf(!ENABLED)("Phase 3 host resolution (integration)", () => {
  // The FakeProvider fixture has provider_refs fake-001..fake-005
  // (supabase/functions/_shared/provider/fake-restaurants.json). Widen tests seed a SUBSET so
  // the provider, honoring excludeProviderRefs, returns only the complement — proving
  // append-only behavior with EXACTLY one provider call.
  const createdRoomIds: string[] = [];
  const createdUserIds: string[] = [];

  let admin: SupabaseClient;
  let url: string;
  let anonKey: string;

  interface Member {
    client: SupabaseClient;
    memberId: string;
    userId: string;
  }

  async function newClient(): Promise<{
    client: SupabaseClient;
    userId: string;
  }> {
    const client = makeClient(url, anonKey);
    const session = unwrap(await signInAnonymously(client));
    createdUserIds.push(session.user.id);
    return { client, userId: session.user.id };
  }

  async function newRoomWithHost(
    name: string,
  ): Promise<{ roomId: string; host: Member }> {
    const { client, userId } = await newClient();
    const { room, member } = unwrap(
      await createRoom(client, makeCreateReq(name)),
    );
    createdRoomIds.push(room.id);
    return { roomId: room.id, host: { client, memberId: member.id, userId } };
  }

  async function addGuest(code: string, name: string): Promise<Member> {
    const { client, userId } = await newClient();
    const { member } = unwrap(
      await joinRoom(client, { code, display_name: name }),
    );
    return { client, memberId: member.id, userId };
  }

  async function roomCode(roomId: string): Promise<string> {
    const { data, error } = await admin
      .from("rooms")
      .select("code")
      .eq("id", roomId)
      .single()
      .returns<{ code: string }>();
    if (error || !data) throw new Error(`roomCode failed: ${error?.message}`);
    return data.code;
  }

  /** Per-restaurant ranking inputs the crafted-swipe ranking test controls. */
  interface RestaurantSpec {
    rating: number | null;
    lat: number;
    lng: number;
  }

  /**
   * Seed an `active` session whose deck is exactly the given specs, tagged with SEED_PROVIDER
   * (random provider_refs, so it never collides with the FakeProvider fixture). Lets a test
   * pin each card's rating + coordinates to assert the ranking tiebreaks deterministically.
   */
  async function seedSessionWithSpecs(
    roomId: string,
    specs: RestaurantSpec[],
  ): Promise<{ sessionId: string; restaurantIds: string[] }> {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const restRows = specs.map((spec, i) => ({
      provider: SEED_PROVIDER,
      provider_ref: `seed-${randomUUID()}`,
      name: `Seed Restaurant ${i}`,
      lat: spec.lat,
      lng: spec.lng,
      rating: spec.rating,
      price_level: "2",
      cuisines: ["italian"],
      photo_url: null,
      is_open_now: true,
      expires_at: expiresAt,
    }));
    const { data: rests, error: rErr } = await admin
      .from("restaurants")
      .insert(restRows)
      .select("id")
      .returns<{ id: string }[]>();
    if (rErr || !rests) throw new Error(`seed restaurants: ${rErr?.message}`);
    const restaurantIds = rests.map((r) => r.id);

    const sessionId = await insertActiveSession(roomId);
    await insertDeck(sessionId, restaurantIds, 0);
    return { sessionId, restaurantIds };
  }

  /**
   * Seed an `active` session whose deck is a SUBSET of the FakeProvider fixture (provider
   * 'fake'). A subsequent widen, passing these refs as excludeProviderRefs, makes the
   * FakeProvider return only the complement — so the widen appends exactly the unseen cards.
   * Restaurants are UPSERTed (the fixture rows are deduped by provider_ref across sessions),
   * so multiple tests can seed the same refs without tripping the 0013 unique constraint.
   */
  async function seedFixtureSubsetSession(
    roomId: string,
    refs: string[],
  ): Promise<{ sessionId: string; restaurantIds: string[] }> {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const restRows = refs.map((ref, i) => ({
      provider: "fake",
      provider_ref: ref,
      name: `Fixture ${ref}`,
      lat: 37.775 + i * 0.0005,
      lng: -122.419 - i * 0.0005,
      rating: 4.0,
      price_level: "2",
      cuisines: ["italian"],
      photo_url: null,
      is_open_now: true,
      expires_at: expiresAt,
    }));
    const { data: rests, error: rErr } = await admin
      .from("restaurants")
      .upsert(restRows, { onConflict: "provider,provider_ref" })
      .select("id, provider_ref")
      .returns<{ id: string; provider_ref: string }[]>();
    if (rErr || !rests) throw new Error(`seed fixture: ${rErr?.message}`);
    // Preserve the caller's ref order for stable index access.
    const byRef = new Map(rests.map((r) => [r.provider_ref, r.id]));
    const restaurantIds = refs.map((ref) => {
      const id = byRef.get(ref);
      if (!id) throw new Error(`missing seeded ref ${ref}`);
      return id;
    });

    const sessionId = await insertActiveSession(roomId);
    await insertDeck(sessionId, restaurantIds, 0);
    return { sessionId, restaurantIds };
  }

  async function insertActiveSession(roomId: string): Promise<string> {
    const { data: sess, error: sErr } = await admin
      .from("sessions")
      .insert({
        room_id: roomId,
        status: "active",
        radius_m: 3000,
        // Unfiltered baseline (see makeCreateReq): widen goes through the now-filter-aware
        // FakeProvider, so no filter here keeps the unseen-card complement at full size.
        filter_open_now: false,
        filter_cuisines: [],
        filter_price_levels: [],
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single()
      .returns<{ id: string }>();
    if (sErr || !sess) throw new Error(`seed session: ${sErr?.message}`);
    return sess.id;
  }

  async function insertDeck(
    sessionId: string,
    restaurantIds: string[],
    addedRound: number,
  ): Promise<void> {
    const deckRows = restaurantIds.map((restaurant_id) => ({
      session_id: sessionId,
      restaurant_id,
      added_round: addedRound,
    }));
    const { error } = await admin.from("cached_decks").insert(deckRows);
    if (error) throw new Error(`seed cached_decks: ${error.message}`);
  }

  /** Flip a session to awaiting_host_resolution via the service-role client (isolates the
   *  resolve_session tests from the submit_swipe exhaustion path, which has its own tests). */
  async function setAwaiting(sessionId: string): Promise<void> {
    const { error } = await admin
      .from("sessions")
      .update({ status: "awaiting_host_resolution" })
      .eq("id", sessionId);
    if (error) throw new Error(`setAwaiting: ${error.message}`);
  }

  async function setMemberLeft(memberId: string, left: boolean): Promise<void> {
    const { error } = await admin
      .from("room_members")
      .update({ left_at: left ? new Date().toISOString() : null })
      .eq("id", memberId);
    if (error) throw new Error(`setMemberLeft: ${error.message}`);
  }

  async function sessionStatus(sessionId: string): Promise<string> {
    const { data, error } = await admin
      .from("sessions")
      .select("status")
      .eq("id", sessionId)
      .single()
      .returns<{ status: string }>();
    if (error || !data) throw new Error(`sessionStatus: ${error?.message}`);
    return data.status;
  }

  async function matchRowCount(sessionId: string): Promise<number> {
    const { count, error } = await admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (error) throw new Error(`matchRowCount: ${error.message}`);
    return count ?? 0;
  }

  /** The deck's provider_refs grouped by added_round — to assert widen appends a new round. */
  async function deckRefsByRound(
    sessionId: string,
  ): Promise<Map<number, string[]>> {
    const { data, error } = await admin
      .from("cached_decks")
      .select("added_round, restaurants!inner(provider_ref)")
      .eq("session_id", sessionId)
      .returns<
        { added_round: number; restaurants: { provider_ref: string } }[]
      >();
    if (error || !data) throw new Error(`deckRefsByRound: ${error?.message}`);
    const byRound = new Map<number, string[]>();
    for (const row of data) {
      const refs = byRound.get(row.added_round) ?? [];
      refs.push(row.restaurants.provider_ref);
      byRound.set(row.added_round, refs);
    }
    return byRound;
  }

  const like = (session_id: string, restaurant_id: string) => ({
    session_id,
    restaurant_id,
    decision: "like" as const,
  });
  const pass = (session_id: string, restaurant_id: string) => ({
    session_id,
    restaurant_id,
    decision: "pass" as const,
  });

  beforeAll(() => {
    url = required("SUPABASE_TEST_URL", TEST_URL);
    anonKey = required("SUPABASE_TEST_ANON_KEY", ANON_KEY);
    const serviceKey = required("SUPABASE_TEST_SERVICE_ROLE_KEY", SERVICE_KEY);
    admin = makeClient(url, serviceKey);
  });

  afterAll(async () => {
    if (createdRoomIds.length > 0) {
      await admin.from("rooms").delete().in("id", createdRoomIds);
    }
    // Rooms gone → their sessions/cached_decks cascaded away, so the seeded restaurants
    // (both the SEED_PROVIDER specs and the 'fake' fixture rows, incl. any widen appended)
    // are now unreferenced and can be purged by tag.
    await admin
      .from("restaurants")
      .delete()
      .in("provider", [SEED_PROVIDER, "fake"]);
    for (const uid of createdUserIds) {
      await admin.auth.admin.deleteUser(uid);
    }
  });

  // --- Deck exhaustion → awaiting_host_resolution --------------------------

  it("exhausts to awaiting_host_resolution once every present member has swiped every card", async () => {
    const { roomId, host } = await newRoomWithHost("P3 Host A");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const { sessionId, restaurantIds } = await seedSessionWithSpecs(roomId, [
      { rating: 4.0, lat: 37.775, lng: -122.42 },
      { rating: 4.0, lat: 37.776, lng: -122.421 },
    ]);
    const c0 = at(restaurantIds, 0);
    const c1 = at(restaurantIds, 1);

    // Both pass c0; host passes c1. No card is unanimous (c1 still unswiped by g1).
    unwrap(await submitSwipe(host.client, pass(sessionId, c0)));
    unwrap(await submitSwipe(g1.client, pass(sessionId, c0)));
    unwrap(await submitSwipe(host.client, pass(sessionId, c1)));
    // g1 still has an unswiped card → the present cohort is NOT exhausted yet.
    expect(await sessionStatus(sessionId)).toBe("active");

    // g1's last swipe completes the deck for every present member → exhausted.
    unwrap(await submitSwipe(g1.client, pass(sessionId, c1)));
    expect(await sessionStatus(sessionId)).toBe("awaiting_host_resolution");
  });

  it("flips to awaiting_host_resolution when an absent member shrinks the exhausted cohort", async () => {
    const { roomId, host } = await newRoomWithHost("P3 Host B");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const g2 = await addGuest(code, "Guest 2");
    const { sessionId, restaurantIds } = await seedSessionWithSpecs(roomId, [
      { rating: 4.0, lat: 37.775, lng: -122.42 },
      { rating: 4.0, lat: 37.776, lng: -122.421 },
    ]);
    const c0 = at(restaurantIds, 0);
    const c1 = at(restaurantIds, 1);

    // host + g1 swipe both cards (all passes); g2 swipes only c0. Active cohort {host,g1,g2}
    // is not exhausted — g2 still has c1 unswiped.
    for (const m of [host, g1]) {
      unwrap(await submitSwipe(m.client, pass(sessionId, c0)));
      unwrap(await submitSwipe(m.client, pass(sessionId, c1)));
    }
    unwrap(await submitSwipe(g2.client, pass(sessionId, c0)));
    expect(await sessionStatus(sessionId)).toBe("active");

    // g2 leaves the active cohort → remaining {host,g1} have swiped everything. Detection
    // lives on submit_swipe, so the next (idempotent) swipe is what flips the status.
    await setMemberLeft(g2.memberId, true);
    unwrap(await submitSwipe(host.client, pass(sessionId, c0)));
    expect(await sessionStatus(sessionId)).toBe("awaiting_host_resolution");
  });

  it("ends matched (not awaiting) when the last card is also the last unanimous like", async () => {
    const { roomId, host } = await newRoomWithHost("P3 Host C");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const { sessionId, restaurantIds } = await seedSessionWithSpecs(roomId, [
      { rating: 4.0, lat: 37.775, lng: -122.42 },
      { rating: 4.0, lat: 37.776, lng: -122.421 },
    ]);
    const c0 = at(restaurantIds, 0);
    const c1 = at(restaurantIds, 1);

    // Both pass c0 (dead), both like c1 — c1's final like completes the deck AND is unanimous.
    unwrap(await submitSwipe(host.client, pass(sessionId, c0)));
    unwrap(await submitSwipe(g1.client, pass(sessionId, c0)));
    unwrap(await submitSwipe(host.client, like(sessionId, c1)));
    const last = unwrap(await submitSwipe(g1.client, like(sessionId, c1)));

    // The match check runs FIRST, and the exhaustion update is guarded on status='active':
    // the session ends `matched`, never awaiting_host_resolution.
    expect(last.match?.restaurant_id).toBe(c1);
    expect(last.match?.resolution).toBe("unanimous");
    expect(await sessionStatus(sessionId)).toBe("matched");
  });

  // --- get_resolution_ranking ---------------------------------------------

  it("ranks by fewest passes, then rating, then distance (present-member-scoped)", async () => {
    const { roomId, host } = await newRoomWithHost("P3 Host D");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    // Anchor is (37.7749, -122.4194). Coordinates chosen so b is NEAR and c is FAR.
    const { sessionId, restaurantIds } = await seedSessionWithSpecs(roomId, [
      { rating: 4.6, lat: 37.776, lng: -122.42 }, // a: pass 1, best rating
      { rating: 4.0, lat: 37.775, lng: -122.4195 }, // b: pass 1, rating 4.0, NEAR
      { rating: 4.0, lat: 37.805, lng: -122.449 }, // c: pass 1, rating 4.0, FAR
      { rating: null, lat: 37.776, lng: -122.42 }, // d: pass 1, null rating (sorts last)
      { rating: 4.2, lat: 37.776, lng: -122.42 }, // e: pass 2
    ]);
    const [a, b, c, d, e] = [
      at(restaurantIds, 0),
      at(restaurantIds, 1),
      at(restaurantIds, 2),
      at(restaurantIds, 3),
      at(restaurantIds, 4),
    ];

    // a..d each get exactly 1 pass (host passes, guest likes — never unanimous). e gets 2.
    for (const card of [a, b, c, d]) {
      unwrap(await submitSwipe(host.client, pass(sessionId, card)));
      unwrap(await submitSwipe(g1.client, like(sessionId, card)));
    }
    unwrap(await submitSwipe(host.client, pass(sessionId, e)));
    unwrap(await submitSwipe(g1.client, pass(sessionId, e)));
    // Every present member swiped every card with no unanimous like → awaiting.
    expect(await sessionStatus(sessionId)).toBe("awaiting_host_resolution");

    const { ranking } = unwrap(
      await getResolutionRanking(host.client, {
        session_id: sessionId,
      }),
    );
    // Order: pass 1 group [a(4.6), b(4.0 near), c(4.0 far), d(null)], then e (pass 2).
    expect(ranking.map((r) => r.restaurant_id)).toEqual([a, b, c, d, e]);
    // Present-member-scoped counts: 2 members, a has 1 pass / 1 like.
    const top = at(ranking, 0);
    expect(top.member_count).toBe(2);
    expect(top.pass_count).toBe(1);
    expect(top.like_count).toBe(1);
    // The distance tiebreak is real (b is genuinely nearer than c).
    expect(at(ranking, 1).distance_m).toBeLessThan(at(ranking, 2).distance_m);
  });

  it("raises NOT_HOST when a non-host requests the ranking", async () => {
    const { roomId, host } = await newRoomWithHost("P3 Host E");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const { sessionId, restaurantIds } = await seedSessionWithSpecs(roomId, [
      { rating: 4.0, lat: 37.775, lng: -122.42 },
    ]);
    // Exhaust so the session is in a realistic awaiting state for the call.
    const c0 = at(restaurantIds, 0);
    unwrap(await submitSwipe(host.client, pass(sessionId, c0)));
    unwrap(await submitSwipe(g1.client, pass(sessionId, c0)));

    const result = await getResolutionRanking(g1.client, {
      session_id: sessionId,
    });
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("NOT_HOST");
  });

  // --- Realtime status transitions -----------------------------------------

  it("delivers awaiting_host_resolution then resolved status events to a co-member", async () => {
    const { roomId, host } = await newRoomWithHost("P3 Host F");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const { sessionId, restaurantIds } = await seedSessionWithSpecs(roomId, [
      { rating: 4.0, lat: 37.775, lng: -122.42 },
    ]);
    const c0 = at(restaurantIds, 0);

    const token = (await g1.client.auth.getSession()).data.session
      ?.access_token;
    await g1.client.realtime.setAuth(token ?? null);

    const statuses: string[] = [];
    const channel = subscribeSession(g1.client, sessionId, (event) => {
      if (event.kind === "status") statuses.push(event.payload.status);
    });

    try {
      await delay(1500);
      // Drive exhaustion: both pass the only card → awaiting_host_resolution (a status event).
      unwrap(await submitSwipe(host.client, pass(sessionId, c0)));
      unwrap(await submitSwipe(g1.client, pass(sessionId, c0)));
      // A direct resolve (the resolve_session logic has its own tests) → resolved (another).
      // This isolates the realtime-delivery assertion from the Edge Function.
      await admin
        .from("sessions")
        .update({
          status: "resolved",
          matched_restaurant_id: c0,
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      // Poll briefly for both broadcasts to arrive.
      for (let i = 0; i < 30 && !statuses.includes("resolved"); i++) {
        await delay(300);
      }
      expect(statuses).toContain("awaiting_host_resolution");
      expect(statuses).toContain("resolved");
    } finally {
      await g1.client.removeChannel(channel);
    }
  }, 20_000);

  // --- resolve_session via the resolve-session Edge Function ----------------
  // These need MUNCH_TEST_EDGE=1 + the function served with PROVIDER=fake; they self-skip
  // otherwise (same convention as the start_session PROVIDER_FAKE_THROW test).

  it("accept_top writes a host_accepted_top match, resolves the session, and adds no cards", async () => {
    if (!EDGE_ENABLED) return;
    const { roomId, host } = await newRoomWithHost("P3 Host G");
    const code = await roomCode(roomId);
    await addGuest(code, "Guest 1");
    const { sessionId, restaurantIds } = await seedSessionWithSpecs(roomId, [
      { rating: 4.0, lat: 37.775, lng: -122.42 },
      { rating: 4.0, lat: 37.776, lng: -122.421 },
    ]);
    await setAwaiting(sessionId);
    const top = at(restaurantIds, 0);
    const deckBefore = (await deckRefsByRound(sessionId)).get(0)?.length ?? 0;

    const result = unwrap(
      await resolveSession(host.client, {
        session_id: sessionId,
        action: "accept_top",
        restaurant_id: top,
      }),
    );
    expect(result.session.status).toBe("resolved");
    expect("match" in result ? result.match.resolution : null).toBe(
      "host_accepted_top",
    );
    expect("match" in result ? result.match.restaurant_id : null).toBe(top);
    expect(await sessionStatus(sessionId)).toBe("resolved");
    expect(await matchRowCount(sessionId)).toBe(1);

    // accept_top makes ZERO provider calls (CLAUDE.md §2.1) — observable proxy: the deck is
    // unchanged. The authoritative check is the resolve_session.accept.ok log (provider_calls:0).
    const deckAfter = (await deckRefsByRound(sessionId)).get(0)?.length ?? 0;
    expect(deckAfter).toBe(deckBefore);

    // Idempotent / no-regression: a second accept hits the awaiting_host_resolution state
    // guard (the session is now resolved) → SESSION_INVALID_STATE, with no duplicate match.
    const replay = await resolveSession(host.client, {
      session_id: sessionId,
      action: "accept_top",
      restaurant_id: top,
    });
    expect(replay.error?.error.code).toBe("SESSION_INVALID_STATE");
    expect(await matchRowCount(sessionId)).toBe(1);
  });

  it("widen appends ONLY unseen restaurants and returns the session to active", async () => {
    if (!EDGE_ENABLED) return;
    const { roomId, host } = await newRoomWithHost("P3 Host H");
    const code = await roomCode(roomId);
    await addGuest(code, "Guest 1");
    // Seed a deck of the first two fixture refs; widen must append exactly the other three.
    const { sessionId } = await seedFixtureSubsetSession(roomId, [
      "fake-001",
      "fake-002",
    ]);
    await setAwaiting(sessionId);

    const result = unwrap(
      await resolveSession(host.client, {
        session_id: sessionId,
        action: "widen",
        radius_m: 5000,
      }),
    );
    expect(result.session.status).toBe("active");
    // FakeProvider excluded the seen refs → 3 unseen fixture cards appended.
    expect("new_restaurants" in result ? result.new_restaurants : -1).toBe(3);
    expect(await sessionStatus(sessionId)).toBe("active");

    const byRound = await deckRefsByRound(sessionId);
    expect((byRound.get(0) ?? []).sort()).toEqual(["fake-001", "fake-002"]);
    // Appended at added_round = n+1 = 1, and ONLY the unseen refs (excludeProviderRefs honored).
    expect((byRound.get(1) ?? []).sort()).toEqual([
      "fake-003",
      "fake-004",
      "fake-005",
    ]);
  });

  it("carries earlier likes across a widen round into a later unanimous match", async () => {
    if (!EDGE_ENABLED) return;
    const { roomId, host } = await newRoomWithHost("P3 Host I");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const g2 = await addGuest(code, "Guest 2");
    const { sessionId, restaurantIds } = await seedFixtureSubsetSession(
      roomId,
      ["fake-001", "fake-002"],
    );
    const r1 = at(restaurantIds, 0);
    const r2 = at(restaurantIds, 1);

    // Phase 1 (present {host, g1, g2}): host + g1 LIKE r1, g2 PASSES r1 → not unanimous.
    // Everyone passes r2. The last swipe exhausts the deck → awaiting_host_resolution.
    unwrap(await submitSwipe(host.client, like(sessionId, r1)));
    unwrap(await submitSwipe(g1.client, like(sessionId, r1)));
    unwrap(await submitSwipe(g2.client, pass(sessionId, r1)));
    unwrap(await submitSwipe(host.client, pass(sessionId, r2)));
    unwrap(await submitSwipe(g1.client, pass(sessionId, r2)));
    unwrap(await submitSwipe(g2.client, pass(sessionId, r2)));
    expect(await sessionStatus(sessionId)).toBe("awaiting_host_resolution");

    // Host widens → unseen fixture cards appended; session back to active.
    unwrap(
      await resolveSession(host.client, {
        session_id: sessionId,
        action: "widen",
        radius_m: 5000,
      }),
    );
    expect(await sessionStatus(sessionId)).toBe("active");

    // g2 (the lone r1-passer) leaves the active cohort; a fresh member joins and likes r1.
    // r1 is a PRE-widen card: host + g1 liked it before the widen and those likes were never
    // deleted. With g2 gone and the newcomer's like, the active cohort {host, g1, g3} have
    // all liked r1 → a unanimous match on a pre-widen card (earlier likes still count).
    await setMemberLeft(g2.memberId, true);
    const g3 = await addGuest(code, "Guest 3");
    const declaring = unwrap(await submitSwipe(g3.client, like(sessionId, r1)));
    expect(declaring.match?.restaurant_id).toBe(r1);
    expect(declaring.match?.resolution).toBe("unanimous");
    expect(await sessionStatus(sessionId)).toBe("matched");
  });

  it("rejects a non-host resolve with NOT_HOST and a non-awaiting resolve with SESSION_INVALID_STATE", async () => {
    if (!EDGE_ENABLED) return;
    const { roomId, host } = await newRoomWithHost("P3 Host J");
    const code = await roomCode(roomId);
    const g1 = await addGuest(code, "Guest 1");
    const { sessionId, restaurantIds } = await seedSessionWithSpecs(roomId, [
      { rating: 4.0, lat: 37.775, lng: -122.42 },
    ]);
    const top = at(restaurantIds, 0);

    // Non-host on an awaiting session → NOT_HOST.
    await setAwaiting(sessionId);
    const nonHost = await resolveSession(g1.client, {
      session_id: sessionId,
      action: "accept_top",
      restaurant_id: top,
    });
    expect(nonHost.error?.error.code).toBe("NOT_HOST");

    // Host on a non-awaiting (still active) session → SESSION_INVALID_STATE.
    await admin
      .from("sessions")
      .update({ status: "active" })
      .eq("id", sessionId);
    const badState = await resolveSession(host.client, {
      session_id: sessionId,
      action: "widen",
      radius_m: 5000,
    });
    expect(badState.error?.error.code).toBe("SESSION_INVALID_STATE");
  });
});

/**
 * Phase 4 match_history write path (CLAUDE.md §2.3, §3; docs/01 §10, docs/03 §3.9). The
 * retention hook is the highest-risk Phase-4 server logic — it must honor GUEST EPHEMERALITY
 * (only a member with a `profiles` row gets a row; guests get none) and be idempotent. These
 * run on the pure submit_swipe RPC path (no Edge Function), so they're gated on ENABLED alone.
 *
 * The "signed-in" test identity is an anonymous auth user that ALSO has a `profiles` row
 * (admin-seeded — the service-role bypasses profiles_insert_own). That is exactly what
 * record_match_history keys off (a profiles row, NOT a non-null user_id; guests have a user_id
 * too), and it mirrors a guest→account upgrade without needing the email-OTP flow in a test.
 */
describe.skipIf(!ENABLED)("Phase 4 match_history write (integration)", () => {
  const createdRoomIds: string[] = [];
  const createdUserIds: string[] = [];

  let admin: SupabaseClient;
  let url: string;
  let anonKey: string;

  interface Member {
    client: SupabaseClient;
    memberId: string;
    userId: string;
  }

  async function newClient(): Promise<{
    client: SupabaseClient;
    userId: string;
  }> {
    const client = makeClient(url, anonKey);
    const session = unwrap(await signInAnonymously(client));
    createdUserIds.push(session.user.id);
    return { client, userId: session.user.id };
  }

  /** Give an anon user a profiles row → counts as "signed-in" for record_match_history. */
  async function makeSignedIn(
    userId: string,
    displayName: string,
  ): Promise<void> {
    const { error } = await admin
      .from("profiles")
      .insert({ id: userId, display_name: displayName });
    if (error) throw new Error(`makeSignedIn: ${error.message}`);
  }

  /** Create a room whose host is a signed-in user (host display_name === profile name). */
  async function newRoomWithSignedInHost(
    name: string,
  ): Promise<{ roomId: string; host: Member }> {
    const { client, userId } = await newClient();
    const { room, member } = unwrap(
      await createRoom(client, makeCreateReq(name)),
    );
    createdRoomIds.push(room.id);
    await makeSignedIn(userId, name);
    return { roomId: room.id, host: { client, memberId: member.id, userId } };
  }

  async function addMember(
    code: string,
    name: string,
    signedIn: boolean,
  ): Promise<Member> {
    const { client, userId } = await newClient();
    const { member } = unwrap(
      await joinRoom(client, { code, display_name: name }),
    );
    if (signedIn) await makeSignedIn(userId, name);
    return { client, memberId: member.id, userId };
  }

  async function roomCode(roomId: string): Promise<string> {
    const { data, error } = await admin
      .from("rooms")
      .select("code")
      .eq("id", roomId)
      .single()
      .returns<{ code: string }>();
    if (error || !data) throw new Error(`roomCode failed: ${error?.message}`);
    return data.code;
  }

  /** Seed an `active` session + cached deck via the service-role client (same as the Phase-2
   *  block — bypasses the start_session Edge Function so these history tests need no served fn). */
  async function seedActiveSession(
    roomId: string,
    deckSize: number,
  ): Promise<{ sessionId: string; restaurantIds: string[] }> {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const restRows = Array.from({ length: deckSize }, (_, i) => ({
      provider: SEED_PROVIDER,
      provider_ref: `seed-${randomUUID()}`,
      name: `Seed Restaurant ${i}`,
      lat: 37.775 + i * 0.001,
      lng: -122.419 - i * 0.001,
      rating: 4.0,
      price_level: "2",
      cuisines: ["italian"],
      photo_url: i === 0 ? "https://example.test/photo-0.jpg" : null,
      is_open_now: true,
      expires_at: expiresAt,
    }));
    const { data: rests, error: rErr } = await admin
      .from("restaurants")
      .insert(restRows)
      .select("id")
      .returns<{ id: string }[]>();
    if (rErr || !rests) throw new Error(`seed restaurants: ${rErr?.message}`);
    const restaurantIds = rests.map((r) => r.id);

    const { data: sess, error: sErr } = await admin
      .from("sessions")
      .insert({
        room_id: roomId,
        status: "active",
        radius_m: 3000,
        filter_open_now: false,
        filter_cuisines: [],
        filter_price_levels: [],
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single()
      .returns<{ id: string }>();
    if (sErr || !sess) throw new Error(`seed session: ${sErr?.message}`);

    const deckRows = restaurantIds.map((restaurant_id) => ({
      session_id: sess.id,
      restaurant_id,
      added_round: 0,
    }));
    const { error: dErr } = await admin.from("cached_decks").insert(deckRows);
    if (dErr) throw new Error(`seed cached_decks: ${dErr.message}`);

    return { sessionId: sess.id, restaurantIds };
  }

  /** One history-row shape, read back via the service-role client for assertions. */
  interface HistoryRow {
    user_id: string;
    match_id: string;
    restaurant_name: string;
    restaurant_photo_url: string | null;
    participant_names: string[];
  }

  async function historyRowsFor(userId: string): Promise<HistoryRow[]> {
    const { data, error } = await admin
      .from("match_history")
      .select(
        "user_id, match_id, restaurant_name, restaurant_photo_url, participant_names",
      )
      .eq("user_id", userId)
      .returns<HistoryRow[]>();
    if (error) throw new Error(`historyRowsFor: ${error.message}`);
    return data ?? [];
  }

  /** Total history rows for a session's match — to assert idempotency across the whole match. */
  async function historyCountForSession(sessionId: string): Promise<number> {
    const { data: m, error: mErr } = await admin
      .from("matches")
      .select("id")
      .eq("session_id", sessionId)
      .single()
      .returns<{ id: string }>();
    if (mErr || !m) throw new Error(`match lookup: ${mErr?.message}`);
    const { count, error } = await admin
      .from("match_history")
      .select("user_id", { count: "exact", head: true })
      .eq("match_id", m.id);
    if (error) throw new Error(`historyCountForSession: ${error.message}`);
    return count ?? 0;
  }

  const like = (session_id: string, restaurant_id: string) => ({
    session_id,
    restaurant_id,
    decision: "like" as const,
  });

  beforeAll(() => {
    url = required("SUPABASE_TEST_URL", TEST_URL);
    anonKey = required("SUPABASE_TEST_ANON_KEY", ANON_KEY);
    const serviceKey = required("SUPABASE_TEST_SERVICE_ROLE_KEY", SERVICE_KEY);
    admin = makeClient(url, serviceKey);
  });

  afterAll(async () => {
    if (createdRoomIds.length > 0) {
      await admin.from("rooms").delete().in("id", createdRoomIds);
    }
    await admin.from("restaurants").delete().eq("provider", SEED_PROVIDER);
    // Deleting the auth user cascades its profiles row AND its match_history rows
    // (both FK auth.users on delete cascade, 0002), so no extra cleanup is needed.
    for (const uid of createdUserIds) {
      await admin.auth.admin.deleteUser(uid);
    }
  });

  it("writes one history row per signed-in present member on a unanimous match", async () => {
    const { roomId, host } = await newRoomWithSignedInHost("Alice");
    const code = await roomCode(roomId);
    const guest = await addMember(code, "Bob", true);
    const { sessionId, restaurantIds } = await seedActiveSession(roomId, 3);
    const card = at(restaurantIds, 0);

    // Both present members are signed-in and both like card 0 → unanimous match.
    unwrap(await submitSwipe(host.client, like(sessionId, card)));
    const declaring = unwrap(
      await submitSwipe(guest.client, like(sessionId, card)),
    );
    expect(declaring.match?.resolution).toBe("unanimous");

    const hostRows = await historyRowsFor(host.userId);
    const guestRows = await historyRowsFor(guest.userId);
    expect(hostRows).toHaveLength(1);
    expect(guestRows).toHaveLength(1);

    // The snapshot is the matched restaurant + the present cohort's names (ordered by joined_at:
    // host joined first). card 0 carries a photo_url, which the snapshot preserves.
    const row = at(hostRows, 0);
    expect(row.restaurant_name).toBe("Seed Restaurant 0");
    expect(row.restaurant_photo_url).toBe("https://example.test/photo-0.jpg");
    expect(row.participant_names).toEqual(["Alice", "Bob"]);
    // Both rows reference the same match.
    expect(at(guestRows, 0).match_id).toBe(row.match_id);
    expect(await historyCountForSession(sessionId)).toBe(2);
  });

  it("excludes guests — only signed-in members get a history row (ephemerality)", async () => {
    const { roomId, host } = await newRoomWithSignedInHost("Carol");
    const code = await roomCode(roomId);
    const guest = await addMember(code, "Dave", false); // no profile → a guest
    const { sessionId, restaurantIds } = await seedActiveSession(roomId, 3);
    const card = at(restaurantIds, 0);

    unwrap(await submitSwipe(host.client, like(sessionId, card)));
    unwrap(await submitSwipe(guest.client, like(sessionId, card)));

    // The signed-in host gets a row; the guest (no profiles row) gets none.
    expect(await historyRowsFor(host.userId)).toHaveLength(1);
    expect(await historyRowsFor(guest.userId)).toHaveLength(0);
    // The guest still appears in the snapshot (they were present), but persists no row of their own.
    const row = at(await historyRowsFor(host.userId), 0);
    expect(row.participant_names).toEqual(["Carol", "Dave"]);
    expect(await historyCountForSession(sessionId)).toBe(1);
  });

  it("is idempotent — re-firing record_match_history writes no extra rows", async () => {
    const { roomId, host } = await newRoomWithSignedInHost("Erin");
    const code = await roomCode(roomId);
    const guest = await addMember(code, "Frank", true);
    const { sessionId, restaurantIds } = await seedActiveSession(roomId, 3);
    const card = at(restaurantIds, 0);

    unwrap(await submitSwipe(host.client, like(sessionId, card)));
    unwrap(await submitSwipe(guest.client, like(sessionId, card)));
    expect(await historyCountForSession(sessionId)).toBe(2);

    // A double-fire (e.g. resolve-session retrying via the service-role rpc) is a no-op — the
    // function is idempotent on the unique (user_id, match_id) with `on conflict do nothing`.
    const { error } = await admin.rpc("record_match_history", {
      p_session_id: sessionId,
    });
    expect(error).toBeNull();
    expect(await historyCountForSession(sessionId)).toBe(2);
  });

  it("a guest's getMatchHistory returns [] while a signed-in member sees their row", async () => {
    const { roomId, host } = await newRoomWithSignedInHost("Grace");
    const code = await roomCode(roomId);
    const guest = await addMember(code, "Heidi", false); // a guest
    const { sessionId, restaurantIds } = await seedActiveSession(roomId, 3);
    const card = at(restaurantIds, 0);

    unwrap(await submitSwipe(host.client, like(sessionId, card)));
    unwrap(await submitSwipe(guest.client, like(sessionId, card)));

    // Round-trip through the real api-client read: RLS scopes each caller to their OWN rows.
    const hostHistory = unwrap(await getMatchHistory(host.client));
    expect(hostHistory).toHaveLength(1);
    expect(at(hostHistory, 0).restaurantName).toBe("Seed Restaurant 0");

    const guestHistory = unwrap(await getMatchHistory(guest.client));
    expect(guestHistory).toEqual([]);
  });
});

/**
 * Phase 4 filters + empty-deck edge + accept_top history, through the served Edge Functions
 * (CLAUDE.md §2.1, §2.2, §3; docs/04 §3.5, §3.9). These prove that:
 *   * a host cuisine filter visibly SHAPES the cached deck (smaller, and every cached row
 *     satisfies it) — the FakeProvider now honors filters at the single provider call;
 *   * an initial pool that matches NOTHING routes the session to awaiting_host_resolution
 *     (host can widen) rather than stranding it `active` with no cards;
 *   * the host accept_top path writes match_history for signed-in present members with ZERO
 *     provider calls, idempotently.
 * Gated on EDGE_ENABLED (start-session + resolve-session served with PROVIDER=fake).
 */
describe.skipIf(!EDGE_ENABLED)(
  "Phase 4 filters + empty deck + accept_top history (integration)",
  () => {
    const createdRoomIds: string[] = [];
    const createdUserIds: string[] = [];

    let admin: SupabaseClient;
    let url: string;
    let anonKey: string;

    async function newClient(): Promise<{
      client: SupabaseClient;
      userId: string;
    }> {
      const client = makeClient(url, anonKey);
      const session = unwrap(await signInAnonymously(client));
      createdUserIds.push(session.user.id);
      return { client, userId: session.user.id };
    }

    async function makeSignedIn(
      userId: string,
      displayName: string,
    ): Promise<void> {
      const { error } = await admin
        .from("profiles")
        .insert({ id: userId, display_name: displayName });
      if (error) throw new Error(`makeSignedIn: ${error.message}`);
    }

    /** Create a room with the given host filters; the FakeProvider applies them at start. */
    async function newHostClient(
      name: string,
      filters: CreateRoomRequest["filters"],
    ): Promise<{ client: SupabaseClient; roomId: string; userId: string }> {
      const { client, userId } = await newClient();
      const { room } = unwrap(
        await createRoom(client, { ...makeCreateReq(name), filters }),
      );
      createdRoomIds.push(room.id);
      return { client, roomId: room.id, userId };
    }

    async function roomCode(roomId: string): Promise<string> {
      const { data, error } = await admin
        .from("rooms")
        .select("code")
        .eq("id", roomId)
        .single()
        .returns<{ code: string }>();
      if (error || !data) throw new Error(`roomCode failed: ${error?.message}`);
      return data.code;
    }

    async function latestSessionId(roomId: string): Promise<string> {
      const { data, error } = await admin
        .from("sessions")
        .select("id")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<{ id: string }[]>();
      const id = data?.[0]?.id;
      if (error || !id) throw new Error(`latestSessionId: ${error?.message}`);
      return id;
    }

    /** The cached deck's restaurants (cuisines + price_level) — to assert filters are honored. */
    async function cachedRestaurantsFor(
      roomId: string,
    ): Promise<{ id: string; name: string; cuisines: string[] }[]> {
      const sessionId = await latestSessionId(roomId);
      const { data, error } = await admin
        .from("cached_decks")
        .select("restaurants!inner(id, name, cuisines)")
        .eq("session_id", sessionId)
        .returns<
          { restaurants: { id: string; name: string; cuisines: string[] } }[]
        >();
      if (error || !data)
        throw new Error(`cachedRestaurantsFor: ${error?.message}`);
      return data.map((r) => r.restaurants);
    }

    async function setAwaiting(sessionId: string): Promise<void> {
      const { error } = await admin
        .from("sessions")
        .update({ status: "awaiting_host_resolution" })
        .eq("id", sessionId);
      if (error) throw new Error(`setAwaiting: ${error.message}`);
    }

    async function historyCountFor(userId: string): Promise<number> {
      const { count, error } = await admin
        .from("match_history")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (error) throw new Error(`historyCountFor: ${error.message}`);
      return count ?? 0;
    }

    beforeAll(() => {
      url = required("SUPABASE_TEST_URL", TEST_URL);
      anonKey = required("SUPABASE_TEST_ANON_KEY", ANON_KEY);
      const serviceKey = required(
        "SUPABASE_TEST_SERVICE_ROLE_KEY",
        SERVICE_KEY,
      );
      admin = makeClient(url, serviceKey);
    });

    afterAll(async () => {
      if (createdRoomIds.length > 0) {
        await admin.from("rooms").delete().in("id", createdRoomIds);
      }
      await admin.from("restaurants").delete().eq("provider", "fake");
      for (const uid of createdUserIds) {
        await admin.auth.admin.deleteUser(uid);
      }
    });

    it("a cuisine filter shapes the deck — a smaller, satisfying subset of the unfiltered pool", async () => {
      // Unfiltered baseline: the whole fixture.
      const plain = await newHostClient("Filter Baseline", {
        open_now: false,
        cuisines: [],
        price_levels: [],
      });
      const baseline = unwrap(
        await startSession(plain.client, { radius_m: 3000 }),
      );
      expect(baseline.deck_size).toBe(FAKE_DECK_SIZE);

      // Filtered: only japanese. The fixture has exactly two japanese rows (fake-002, fake-005).
      const filtered = await newHostClient("Filter Japanese", {
        open_now: false,
        cuisines: ["japanese"],
        price_levels: [],
      });
      const result = unwrap(
        await startSession(filtered.client, { radius_m: 3000 }),
      );

      // Strictly smaller than the unfiltered start — proves it's the filter, not chance.
      expect(result.deck_size).toBeLessThan(baseline.deck_size);
      expect(result.deck_size).toBeGreaterThan(0);

      // And every cached restaurant actually satisfies the filter.
      const cached = await cachedRestaurantsFor(filtered.roomId);
      expect(cached).toHaveLength(result.deck_size);
      for (const r of cached) {
        expect(r.cuisines).toContain("japanese");
      }
    });

    it("an initial deck that matches nothing leaves the session awaiting_host_resolution", async () => {
      // No fixture row is thai → the provider returns zero rows for this filter.
      const { client, roomId } = await newHostClient("Empty Deck", {
        open_now: false,
        cuisines: ["thai"],
        price_levels: [],
      });
      const result = unwrap(await startSession(client, { radius_m: 3000 }));

      expect(result.deck_size).toBe(0);
      expect(result.session.status).toBe("awaiting_host_resolution");
      expect(await cachedRestaurantsFor(roomId)).toHaveLength(0);

      // The single provider fetch already happened; the session is non-terminal
      // (awaiting_host_resolution), so a second start is refused — proving NO second fetch.
      const second = await startSession(client, { radius_m: 3000 });
      expect(second.error?.error.code).toBe("SESSION_INVALID_STATE");
    });

    it("accept_top writes the signed-in host's history row, zero provider calls, idempotent", async () => {
      const { client, roomId, userId } = await newHostClient("Accept Host", {
        open_now: false,
        cuisines: [],
        price_levels: [],
      });
      await makeSignedIn(userId, "Accept Host");
      const code = await roomCode(roomId);
      // A guest (no profile) joins so we also confirm they get NO row on the accept path.
      const guestClient = makeClient(url, anonKey);
      const guestSession = unwrap(await signInAnonymously(guestClient));
      createdUserIds.push(guestSession.user.id);
      unwrap(
        await joinRoom(guestClient, { code, display_name: "Accept Guest" }),
      );

      unwrap(await startSession(client, { radius_m: 3000 }));
      const sessionId = await latestSessionId(roomId);
      // Drive to the resolution surface directly (the exhaustion path has its own tests), then
      // accept the first cached card as the host's pick.
      await setAwaiting(sessionId);
      const cached = await cachedRestaurantsFor(roomId);
      const top = at(cached, 0);
      const deckBefore = cached.length;

      const accept = unwrap(
        await resolveSession(client, {
          session_id: sessionId,
          action: "accept_top",
          restaurant_id: top.id,
        }),
      );
      expect(accept.session.status).toBe("resolved");

      // The signed-in host gets a history row snapshotting the accepted restaurant; the guest none.
      expect(await historyCountFor(userId)).toBe(1);
      expect(await historyCountFor(guestSession.user.id)).toBe(0);
      const hostHistory = unwrap(await getMatchHistory(client));
      expect(at(hostHistory, 0).restaurantName).toBe(top.name);

      // ZERO provider calls on accept (CLAUDE.md §2.1) — observable proxy: the deck is unchanged.
      expect(await cachedRestaurantsFor(roomId)).toHaveLength(deckBefore);

      // Idempotent: a re-fired record_match_history (resolve-session's service-role rpc) adds nothing.
      const { error } = await admin.rpc("record_match_history", {
        p_session_id: sessionId,
      });
      expect(error).toBeNull();
      expect(await historyCountFor(userId)).toBe(1);
    });
  },
);
