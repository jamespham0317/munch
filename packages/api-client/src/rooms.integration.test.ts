import type { ApiError, CreateRoomRequest, ErrorCode } from "@munch/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { signInAnonymously } from "./auth";
import {
  createRoom,
  getRoomMembers,
  heartbeat,
  joinRoom,
  leaveRoom,
  updateRoomFilters,
} from "./endpoints/rooms";
import type { ClientResult } from "./errors";

/**
 * Integration tests for the membership RPCs (docs/04 §3.1–§3.3) against a LOCAL Supabase, run
 * through the real api-client functions so the snake↔camel mapping and error mapping are
 * exercised end-to-end. No provider is involved this phase (CLAUDE.md §7).
 *
 * These need a running stack, so they are GATED on the SUPABASE_TEST_* env vars and skip in CI
 * (which starts no Supabase) — `pnpm test` stays green everywhere; the pure error-mapping unit
 * test in errors.test.ts always runs. To run locally:
 *
 *   supabase start && supabase db reset
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321 \
 *   SUPABASE_TEST_ANON_KEY=<anon key from `supabase start`> \
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=<service_role key from `supabase start`> \
 *     pnpm --filter @munch/api-client test
 *
 * Keys come from the environment, never inlined — the local anon/service-role keys are JWTs and
 * a hardcoded `eyJ…` would trip scripts/check-secrets.sh (a CI gate; CLAUDE.md §3). The
 * service-role client is used ONLY here for deterministic setup/teardown, never shipped.
 */

const TEST_URL = process.env.SUPABASE_TEST_URL;
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const ENABLED = Boolean(TEST_URL && ANON_KEY && SERVICE_KEY);

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required to run the room integration tests.`);
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

/** Assert a ClientResult failed with a specific mapped ErrorCode. */
function expectErrorCode<T>(result: ClientResult<T>, code: ErrorCode): void {
  expect(result.error).not.toBeNull();
  expect(result.error?.error.code).toBe(code);
}

function makeCreateReq(name: string): CreateRoomRequest {
  return {
    host_display_name: name,
    anchor_label: "Test Anchor",
    anchor_lat: 37.7749,
    anchor_lng: -122.4194,
    filters: { open_now: true, cuisines: [], price_levels: [] },
    default_radius_m: 3000,
  };
}

/**
 * Insert a session row for a room via the service-role client so the roster-freeze guard
 * (join_room → ROOM_IN_SESSION, 0019) fires deterministically. The guard keys on a session row
 * EXISTING for the room, so the exact status doesn't matter; we use 'active' as the realistic
 * post-start state. No deck/swipes are needed for the guard.
 */
async function startFakeSession(
  admin: SupabaseClient,
  roomId: string,
): Promise<void> {
  const { error } = await admin.from("sessions").insert({
    room_id: roomId,
    status: "active",
    radius_m: 3000,
    filter_open_now: true,
    filter_cuisines: [],
    filter_price_levels: [],
    started_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`failed to seed session: ${error.message}`);
  }
}

/** Find a 6-digit code not currently in use, so a ROOM_NOT_FOUND case is deterministic. */
async function findUnusedCode(admin: SupabaseClient): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    const { data } = await admin
      .from("rooms")
      .select("code")
      .eq("code", code)
      .maybeSingle()
      .returns<{ code: string }>();
    if (!data) {
      return code;
    }
  }
  throw new Error("could not find an unused room code");
}

describe.skipIf(!ENABLED)("membership RPCs (integration)", () => {
  // Track everything created so reruns stay deterministic. Deleting a room cascades to its
  // room_members (0002 FK on delete cascade); auth users are removed via the admin API.
  const createdRoomIds: string[] = [];
  const createdUserIds: string[] = [];

  let admin: SupabaseClient;
  let url: string;
  let anonKey: string;
  let host: SupabaseClient;

  /** Mint a fresh anonymous guest (its own client + session) and track it for teardown. */
  async function newGuest(): Promise<SupabaseClient> {
    const client = makeClient(url, anonKey);
    const session = unwrap(await signInAnonymously(client));
    createdUserIds.push(session.user.id);
    return client;
  }

  beforeAll(async () => {
    url = required("SUPABASE_TEST_URL", TEST_URL);
    anonKey = required("SUPABASE_TEST_ANON_KEY", ANON_KEY);
    const serviceKey = required("SUPABASE_TEST_SERVICE_ROLE_KEY", SERVICE_KEY);
    admin = makeClient(url, serviceKey);
    // A shared host for the scenarios below; well under the 10-creates/hr limit (0005).
    host = await newGuest();
  });

  afterAll(async () => {
    if (createdRoomIds.length > 0) {
      await admin.from("rooms").delete().in("id", createdRoomIds);
    }
    for (const uid of createdUserIds) {
      await admin.auth.admin.deleteUser(uid);
    }
  });

  it("create_room returns a unique 6-digit code and a host member", async () => {
    const result = unwrap(await createRoom(host, makeCreateReq("Host A")));
    createdRoomIds.push(result.room.id);
    expect(result.room.code).toMatch(/^\d{6}$/);
    expect(result.member.role).toBe("host");
    expect(result.member.displayName).toBe("Host A");
  });

  it("join_room adds a member and returns both co-members", async () => {
    const { room } = unwrap(await createRoom(host, makeCreateReq("Host")));
    createdRoomIds.push(room.id);

    const guest = await newGuest();
    const result = unwrap(
      await joinRoom(guest, { code: room.code, display_name: "Guest" }),
    );
    expect(result.room.code).toBe(room.code);
    expect(result.member.role).toBe("member");
    expect(result.members).toHaveLength(2);
    expect(result.members.map((m) => m.role).sort()).toEqual([
      "host",
      "member",
    ]);
  });

  it("join_room rejects an unknown code with ROOM_NOT_FOUND", async () => {
    const guest = await newGuest();
    const code = await findUnusedCode(admin);
    expectErrorCode(
      await joinRoom(guest, { code, display_name: "Guest" }),
      "ROOM_NOT_FOUND",
    );
  });

  it("join_room rejects a closed room with ROOM_CLOSED", async () => {
    const { room } = unwrap(await createRoom(host, makeCreateReq("Host")));
    createdRoomIds.push(room.id);
    // Soft-close it directly (the host-leave/end_room outcome) so the guard is deterministic.
    await admin.from("rooms").update({ is_active: false }).eq("id", room.id);

    const guest = await newGuest();
    expectErrorCode(
      await joinRoom(guest, { code: room.code, display_name: "Late" }),
      "ROOM_CLOSED",
    );
  });

  it("join_room rejects a duplicate join with ALREADY_JOINED", async () => {
    const { room } = unwrap(await createRoom(host, makeCreateReq("Host")));
    createdRoomIds.push(room.id);

    const guest = await newGuest();
    unwrap(await joinRoom(guest, { code: room.code, display_name: "Guest" }));
    expectErrorCode(
      await joinRoom(guest, { code: room.code, display_name: "Guest" }),
      "ALREADY_JOINED",
    );
  });

  it("join_room raises ROOM_IN_SESSION once a session exists (roster freeze)", async () => {
    // A fresh host per scenario so these added tests don't exhaust the shared host's
    // per-identity create budget (0005: 10 creates/hour).
    const roomHost = await newGuest();
    const { room } = unwrap(await createRoom(roomHost, makeCreateReq("Host")));
    createdRoomIds.push(room.id);
    // A session row means swiping has begun; the cohort can only shrink now (Phase 4.7).
    await startFakeSession(admin, room.id);

    const guest = await newGuest();
    expectErrorCode(
      await joinRoom(guest, { code: room.code, display_name: "Late" }),
      "ROOM_IN_SESSION",
    );
  });

  it("leave_room lets a member re-join the lobby cleanly (no session yet)", async () => {
    const roomHost = await newGuest();
    const { room } = unwrap(await createRoom(roomHost, makeCreateReq("Host")));
    createdRoomIds.push(room.id);

    const guest = await newGuest();
    unwrap(await joinRoom(guest, { code: room.code, display_name: "Guest" }));
    // Non-host lobby leave: removes the member, room stays open (host still active).
    const left = unwrap(await leaveRoom(guest, room.id));
    expect(left.roomEnded).toBe(false);
    expect(left.member.leftAt).not.toBeNull();
    // Re-join reactivates the SAME row instead of tripping ALREADY_JOINED (0019).
    const rejoined = unwrap(
      await joinRoom(guest, { code: room.code, display_name: "Guest" }),
    );
    expect(rejoined.members).toHaveLength(2);
  });

  it("getRoomMembers returns only active members (left members drop out)", async () => {
    const roomHost = await newGuest();
    const { room } = unwrap(await createRoom(roomHost, makeCreateReq("Host")));
    createdRoomIds.push(room.id);

    const guest = await newGuest();
    unwrap(await joinRoom(guest, { code: room.code, display_name: "Guest" }));
    expect(unwrap(await getRoomMembers(roomHost, room.id))).toHaveLength(2);

    unwrap(await leaveRoom(guest, room.id));
    const remaining = unwrap(await getRoomMembers(roomHost, room.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.role).toBe("host");
  });

  it("leave_room closes the room when the host leaves (no transfer)", async () => {
    const roomHost = await newGuest();
    const { room } = unwrap(
      await createRoom(roomHost, makeCreateReq("Solo Host")),
    );
    createdRoomIds.push(room.id);

    const result = unwrap(await leaveRoom(roomHost, room.id));
    expect(result.roomEnded).toBe(true);
    expect(result.member.leftAt).not.toBeNull();
    // The room is soft-closed; a fresh guest can no longer join.
    const guest = await newGuest();
    expectErrorCode(
      await joinRoom(guest, { code: room.code, display_name: "Late" }),
      "ROOM_CLOSED",
    );
  });

  it("heartbeat upserts the caller's liveness row idempotently", async () => {
    const roomHost = await newGuest();
    const { room, member } = unwrap(
      await createRoom(roomHost, makeCreateReq("Host")),
    );
    createdRoomIds.push(room.id);

    unwrap(await heartbeat(roomHost, member.id));
    unwrap(await heartbeat(roomHost, member.id)); // upsert: 2nd beat updates, not duplicates.

    const { data } = await admin
      .from("member_heartbeats")
      .select("member_id")
      .eq("member_id", member.id)
      .returns<{ member_id: string }[]>();
    expect(data).toHaveLength(1);
  });

  it("update_room_filters rejects a non-host with NOT_HOST", async () => {
    const { room } = unwrap(await createRoom(host, makeCreateReq("Host")));
    createdRoomIds.push(room.id);

    const guest = await newGuest();
    unwrap(await joinRoom(guest, { code: room.code, display_name: "Guest" }));
    expectErrorCode(
      await updateRoomFilters(guest, room.id, { default_radius_m: 5000 }),
      "NOT_HOST",
    );
  });

  it("update_room_filters lets the host change filters", async () => {
    const { room } = unwrap(await createRoom(host, makeCreateReq("Host")));
    createdRoomIds.push(room.id);

    const result = unwrap(
      await updateRoomFilters(host, room.id, {
        default_radius_m: 5000,
        filters: { open_now: false },
      }),
    );
    expect(result.room.defaultRadiusM).toBe(5000);
    expect(result.room.filterOpenNow).toBe(false);
  });

  it("rate-limits room creation past the per-identity threshold", async () => {
    // 0005 sets c_max_creates = 10 per rolling hour. A fresh identity starts at 0, so the
    // 11th create within the window is the one that must be refused.
    const CREATE_LIMIT = 10;
    const guest = await newGuest();

    let limited: ApiError | null = null;
    for (let i = 0; i <= CREATE_LIMIT; i++) {
      const result = await createRoom(guest, makeCreateReq(`RL ${i}`));
      if (result.error) {
        limited = result.error;
        break;
      }
      createdRoomIds.push(result.data.room.id);
    }
    expect(limited).not.toBeNull();
    expect(limited?.error.code).toBe("RATE_LIMITED");
  });
});
