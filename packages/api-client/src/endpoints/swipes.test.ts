import type { ErrorCode, MatchInfo, SubmitSwipeRequest } from "@munch/core";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeApiError } from "../errors";
import { submitSwipe } from "./swipes";

/**
 * Unit tests for submitSwipe's RPC error mapping and success-response shape (docs/04 §3.7;
 * CLAUDE.md §2.3 server-authoritative match). We don't talk to Supabase here — the rpc call is
 * stubbed and the contract under test is the api-client boundary:
 *   * each RPC exception MESSAGE that 0010 can raise maps onto the matching ErrorCode,
 *   * the safe per-code default message is what's surfaced (raw DB text never is),
 *   * a successful response is returned verbatim (snake_case wire shape matches
 *     SubmitSwipeResponse).
 */

/** Minimal PostgrestError shape for the stub; matches isPostgrestError in errors.ts. */
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
 * Build a stubbed SupabaseClient whose `.rpc()` resolves to a canned `{ data, error }`. We
 * cast to SupabaseClient at the boundary so the api-client function exercises the same path
 * a real client would — no behavior changes.
 */
function stubClient(result: {
  data: unknown;
  error: PostgrestError | null;
}): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue(result),
  } as unknown as SupabaseClient;
}

const REQ: SubmitSwipeRequest = {
  session_id: "00000000-0000-0000-0000-000000000001",
  restaurant_id: "00000000-0000-0000-0000-000000000002",
  decision: "like",
};

describe("submitSwipe", () => {
  beforeEach(() => {
    // toApiError logs the raw error for diagnostics; silence to keep test output clean.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The four codes 0010 raises as exception MESSAGE. The api-client must map each to the
  // matching ErrorCode and never surface the raw text. (FORBIDDEN was added to the rpc set
  // in errors.ts as part of Phase 2 — this test pins that down for the swipe path.)
  const RPC_CODES: ErrorCode[] = [
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "SESSION_INVALID_STATE",
    "VALIDATION_ERROR",
  ];

  it.each(RPC_CODES)(
    "maps a P0001 %s exception onto that ErrorCode with the safe message",
    async (code) => {
      const client = stubClient({
        data: null,
        error: postgrestError("P0001", code),
      });
      const result = await submitSwipe(client, REQ);
      expect(result.data).toBeNull();
      expect(result.error?.error.code).toBe(code);
      expect(result.error?.error.message).toBe(
        makeApiError(code).error.message,
      );
    },
  );

  it("maps a Postgres 42501 (RLS denial) onto FORBIDDEN, not the raw text", async () => {
    const raw = "permission denied for table swipes";
    const client = stubClient({
      data: null,
      error: postgrestError("42501", raw),
    });
    const result = await submitSwipe(client, REQ);
    expect(result.error?.error.code).toBe("FORBIDDEN");
    expect(result.error?.error.message).not.toContain(raw);
  });

  it("returns the swipe response shape verbatim on a no-match like", async () => {
    const client = stubClient({
      data: { recorded: true, match: null },
      error: null,
    });
    const result = await submitSwipe(client, REQ);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ recorded: true, match: null });
  });

  it("surfaces the MatchInfo payload verbatim when the server declared a match", async () => {
    const match: MatchInfo = {
      restaurant_id: REQ.restaurant_id,
      restaurant_name: "Pizzeria Libretto",
      resolution: "unanimous",
    };
    const client = stubClient({
      data: { recorded: true, match },
      error: null,
    });
    const result = await submitSwipe(client, REQ);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ recorded: true, match });
  });

  it("treats a null data payload as a failure (defensive: an RPC must return jsonb)", async () => {
    const client = stubClient({ data: null, error: null });
    const result = await submitSwipe(client, REQ);
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("VALIDATION_ERROR");
  });
});
