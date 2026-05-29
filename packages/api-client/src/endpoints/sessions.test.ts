import type {
  GetResolutionRankingRequest,
  ResolveSessionRequest,
} from "@munch/core";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeApiError } from "../errors";
import { getResolutionRanking, resolveSession } from "./sessions";

/**
 * Unit tests for the Phase-3 session endpoints' boundary behavior (docs/04 §3.8/§3.9;
 * CLAUDE.md §2.4 closest-to-unanimous, §3 no leaked DB errors). No Supabase here — the
 * rpc / functions.invoke calls are stubbed; the contracts under test are:
 *   * getResolutionRanking maps the security-definer RPC's NOT_HOST exception MESSAGE onto
 *     the NOT_HOST ErrorCode (never raw text), and coerces PostgREST string-typed numerics
 *     (rating, distance_m, the counts) back to numbers like mapDeckRow does;
 *   * resolveSession returns each discriminated arm of the resolve-session Edge body verbatim,
 *     maps an envelope code through, and falls a transport error back to PROVIDER_ERROR (the
 *     code widen's retry copy keys off).
 */

/** Minimal PostgrestError shape for the rpc stub; matches isPostgrestError in errors.ts. */
function postgrestError(code: string, message: string): PostgrestError {
  return {
    code,
    message,
    details: "",
    hint: "",
    name: "PostgrestError",
  } as PostgrestError;
}

/** A SupabaseClient whose `.rpc()` resolves to a canned `{ data, error }`. */
function rpcClient(result: {
  data: unknown;
  error: PostgrestError | null;
}): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue(result),
  } as unknown as SupabaseClient;
}

/** A SupabaseClient whose `.functions.invoke()` resolves to a canned `{ data, error }`. */
function invokeClient(result: {
  data: unknown;
  error: unknown;
}): SupabaseClient {
  return {
    functions: { invoke: vi.fn().mockResolvedValue(result) },
  } as unknown as SupabaseClient;
}

/**
 * An Edge-Function error carrying the `{ error: { code } }` envelope on its `context`
 * (a Response-like with `.json()`) — the shape readEnvelopeCode duck-types in sessions.ts.
 */
function envelopeError(code: string): unknown {
  return { context: { json: () => Promise.resolve({ error: { code } }) } };
}

const RANKING_REQ: GetResolutionRankingRequest = {
  session_id: "00000000-0000-0000-0000-000000000001",
};

describe("getResolutionRanking", () => {
  beforeEach(() => {
    // toApiError logs the raw error for diagnostics; silence to keep test output clean.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps a non-host NOT_HOST RPC exception onto NOT_HOST with the safe message", async () => {
    const client = rpcClient({
      data: null,
      error: postgrestError("P0001", "NOT_HOST"),
    });
    const result = await getResolutionRanking(client, RANKING_REQ);
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("NOT_HOST");
    expect(result.error?.error.message).toBe(
      makeApiError("NOT_HOST").error.message,
    );
  });

  it("coerces PostgREST string-typed numerics to numbers", async () => {
    const client = rpcClient({
      data: [
        {
          restaurant_id: "00000000-0000-0000-0000-0000000000aa",
          name: "Pizzeria Libretto",
          pass_count: "1",
          like_count: "2",
          member_count: "3",
          rating: "4.5",
          distance_m: "850",
        },
      ],
      error: null,
    });
    const result = await getResolutionRanking(client, RANKING_REQ);
    expect(result.error).toBeNull();
    expect(result.data?.ranking).toEqual([
      {
        restaurant_id: "00000000-0000-0000-0000-0000000000aa",
        name: "Pizzeria Libretto",
        pass_count: 1,
        like_count: 2,
        member_count: 3,
        rating: 4.5,
        distance_m: 850,
      },
    ]);
  });

  it("preserves a null rating (no numeric coercion)", async () => {
    const client = rpcClient({
      data: [
        {
          restaurant_id: "00000000-0000-0000-0000-0000000000bb",
          name: "No Rating Diner",
          pass_count: 0,
          like_count: 0,
          member_count: 2,
          rating: null,
          distance_m: 120,
        },
      ],
      error: null,
    });
    const result = await getResolutionRanking(client, RANKING_REQ);
    expect(result.error).toBeNull();
    expect(result.data?.ranking[0]?.rating).toBeNull();
  });
});

describe("resolveSession", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const ACCEPT_REQ: ResolveSessionRequest = {
    session_id: "00000000-0000-0000-0000-000000000001",
    action: "accept_top",
    restaurant_id: "00000000-0000-0000-0000-0000000000aa",
  };
  const WIDEN_REQ: ResolveSessionRequest = {
    session_id: "00000000-0000-0000-0000-000000000001",
    action: "widen",
    radius_m: 5000,
  };

  it("returns the accept_top body (resolved + host_accepted_top match) verbatim", async () => {
    const body = {
      session: { status: "resolved" as const },
      match: {
        restaurant_id: ACCEPT_REQ.restaurant_id,
        restaurant_name: "Pizzeria Libretto",
        resolution: "host_accepted_top" as const,
      },
    };
    const client = invokeClient({ data: body, error: null });
    const result = await resolveSession(client, ACCEPT_REQ);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(body);
  });

  it("returns the widen body (active + new_restaurants) verbatim", async () => {
    const body = {
      session: { status: "active" as const },
      new_restaurants: 7,
    };
    const client = invokeClient({ data: body, error: null });
    const result = await resolveSession(client, WIDEN_REQ);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(body);
  });

  it("maps an envelope NOT_HOST onto NOT_HOST with the safe message", async () => {
    const client = invokeClient({
      data: null,
      error: envelopeError("NOT_HOST"),
    });
    const result = await resolveSession(client, ACCEPT_REQ);
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("NOT_HOST");
    expect(result.error?.error.message).toBe(
      makeApiError("NOT_HOST").error.message,
    );
  });

  it("falls a transport error (no envelope) back to PROVIDER_ERROR for widen retry", async () => {
    const client = invokeClient({
      data: null,
      error: new Error("network down"),
    });
    const result = await resolveSession(client, WIDEN_REQ);
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("PROVIDER_ERROR");
  });
});
