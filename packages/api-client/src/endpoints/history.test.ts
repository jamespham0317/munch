import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeApiError } from "../errors";
import { getMatchHistory } from "./history";

/**
 * Unit tests for the Phase-4 match-history read boundary (docs/04 §3.9; CLAUDE.md §3 guest
 * ephemerality, §3 no leaked DB errors). No Supabase here — the `.from(...).select(...)` chain
 * is stubbed; the contracts under test are:
 *   * getMatchHistory maps a snake_case row onto the camelCase MatchHistory shape, preserving a
 *     null restaurant_photo_url and a multi-name participant_names array;
 *   * an RLS denial (Postgres 42501) maps to a safe FORBIDDEN ApiError, never raw DB text.
 */

/** Minimal PostgrestError shape for the query stub; matches isPostgrestError in errors.ts. */
function postgrestError(code: string, message: string): PostgrestError {
  return {
    code,
    message,
    details: "",
    hint: "",
    name: "PostgrestError",
  } as PostgrestError;
}

/**
 * A SupabaseClient whose `.from(...).select(...).order(...).returns()` chain resolves to a
 * canned `{ data, error }`. getMatchHistory awaits the builder directly (no terminal call), so
 * the stub is a thenable that returns itself from each chained method.
 */
function fromClient(result: {
  data: unknown;
  error: PostgrestError | null;
}): SupabaseClient {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn(() => builder),
    then: (resolve: (r: typeof result) => unknown) => resolve(result),
  };
  return {
    from: vi.fn(() => builder),
  } as unknown as SupabaseClient;
}

describe("getMatchHistory", () => {
  beforeEach(() => {
    // toApiError logs the raw error for diagnostics; silence to keep test output clean.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps a snake_case row onto the camelCase MatchHistory shape", async () => {
    const client = fromClient({
      data: [
        {
          id: "00000000-0000-0000-0000-0000000000a1",
          user_id: "00000000-0000-0000-0000-0000000000b1",
          match_id: "00000000-0000-0000-0000-0000000000c1",
          restaurant_name: "Taco Town",
          restaurant_photo_url: null,
          participant_names: ["Ada", "Grace", "Edsger"],
          decided_at: "2026-06-01T12:00:00.000Z",
          created_at: "2026-06-01T12:00:01.000Z",
        },
      ],
      error: null,
    });

    const result = await getMatchHistory(client);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        id: "00000000-0000-0000-0000-0000000000a1",
        userId: "00000000-0000-0000-0000-0000000000b1",
        matchId: "00000000-0000-0000-0000-0000000000c1",
        restaurantName: "Taco Town",
        restaurantPhotoUrl: null,
        participantNames: ["Ada", "Grace", "Edsger"],
        decidedAt: "2026-06-01T12:00:00.000Z",
        createdAt: "2026-06-01T12:00:01.000Z",
      },
    ]);
  });

  it("returns an empty list when the caller has no rows (e.g. a guest under RLS)", async () => {
    const client = fromClient({ data: [], error: null });
    const result = await getMatchHistory(client);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("maps an RLS denial to a safe FORBIDDEN ApiError, never raw text", async () => {
    const client = fromClient({
      data: null,
      error: postgrestError(
        "42501",
        "permission denied for table match_history",
      ),
    });

    const result = await getMatchHistory(client);

    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("FORBIDDEN");
    expect(result.error?.error.message).toBe(
      makeApiError("FORBIDDEN").error.message,
    );
  });
});
