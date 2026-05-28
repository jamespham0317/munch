import type { ErrorCode } from "@munch/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeApiError, toApiError } from "./errors";

/**
 * Unit tests for the api-client error boundary (docs/06 §8, §9; CLAUDE.md §3).
 *
 * The contract under test: a Supabase/DB error is mapped to a safe `ApiError` whose code is
 * classified from the error's signals and whose message is the canonical, never-raw text. Raw
 * provider/DB strings (which can carry table names, emails, internals) must never be surfaced.
 *
 * We compare surfaced messages against `makeApiError(code)` rather than hardcoding strings, so
 * the test stays pinned to "uses the same safe message" without duplicating the message table.
 */

/** Minimal PostgrestError shape `isPostgrestError` recognizes (code/details/hint present). */
function postgrestError(code: string, message: string) {
  return { code, message, details: "", hint: "", name: "PostgrestError" };
}

/** Minimal GoTrue auth error shape `isAuthError` recognizes (`__isAuthError` present). */
function authError(status: number, message: string) {
  return { __isAuthError: true, status, message };
}

// The doc-04 codes the RPCs raise as their exception MESSAGE (0005/0010/0011 convention).
// A `raise exception 'X'` arrives as a PostgrestError with code P0001 and message 'X'.
// FORBIDDEN was added in Phase 2 (submit_swipe, 0010, raises it for a non-member of the
// session's room) — included here so the mapping is locked down.
const RPC_CODES: ErrorCode[] = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ROOM_NOT_FOUND",
  "ROOM_CLOSED",
  "NOT_HOST",
  "ALREADY_JOINED",
  "RATE_LIMITED",
  "SESSION_INVALID_STATE",
  "VALIDATION_ERROR",
];

describe("toApiError", () => {
  beforeEach(() => {
    // toApiError logs the raw error for diagnostics; silence it so the suite output stays clean.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(RPC_CODES)(
    "maps an RPC exception message %s onto that ErrorCode with the safe message",
    (code) => {
      const result = toApiError(postgrestError("P0001", code));
      expect(result.error.code).toBe(code);
      expect(result.error.message).toBe(makeApiError(code).error.message);
    },
  );

  it("maps a Postgres 42501 (RLS denial) onto FORBIDDEN, not the raw text", () => {
    const raw = "permission denied for table rooms";
    const result = toApiError(postgrestError("42501", raw));
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe(makeApiError("FORBIDDEN").error.message);
    expect(result.error.message).not.toContain(raw);
  });

  it("falls back to VALIDATION_ERROR for an unrecognized DB message and never surfaces it", () => {
    const raw = "duplicate key value violates unique constraint secret_idx";
    const result = toApiError(postgrestError("23505", raw));
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(result.error.message).toBe(
      makeApiError("VALIDATION_ERROR").error.message,
    );
    expect(result.error.message).not.toContain("secret");
  });

  it("honors the caller-supplied fallback when the error can't be classified", () => {
    const result = toApiError(
      postgrestError("23505", "boom"),
      "UNAUTHENTICATED",
    );
    expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("maps a GoTrue 429 onto RATE_LIMITED without leaking the email in the message", () => {
    const result = toApiError(
      authError(429, "email rate limit exceeded for alice@example.com"),
    );
    expect(result.error.code).toBe("RATE_LIMITED");
    expect(result.error.message).not.toContain("alice@example.com");
  });

  it("uses the fallback for a non-429 auth error and never surfaces its raw text", () => {
    const result = toApiError(
      authError(400, "invalid login for alice@example.com"),
      "UNAUTHENTICATED",
    );
    expect(result.error.code).toBe("UNAUTHENTICATED");
    expect(result.error.message).not.toContain("alice@example.com");
  });

  it("uses the default VALIDATION_ERROR fallback for a non-Supabase value", () => {
    const result = toApiError(new Error("kaboom"));
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(result.error.message).not.toContain("kaboom");
  });

  it("logs the raw error for diagnostics (it is recorded, just never surfaced)", () => {
    const spy = vi.spyOn(console, "error");
    toApiError(postgrestError("P0001", "ROOM_NOT_FOUND"));
    expect(spy).toHaveBeenCalled();
  });
});
