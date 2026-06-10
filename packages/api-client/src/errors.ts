import type { ApiError, ErrorCode } from "@munch/core";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Centralized error mapping for the api-client boundary.
 *
 * The data layer keeps Supabase's native `{ data, error }`. At the api-client's
 * public boundary we convert any Supabase/DB error into the safe `ApiError` shape
 * from @munch/core (`{ error: { code, message } }`), so raw provider/DB errors are
 * never leaked to clients (CLAUDE.md §3; docs/06 §8). Diagnostic details are
 * logged, not surfaced.
 */

/**
 * The api-client boundary return shape: Supabase-native `{ data, error }`, but
 * with `error` already mapped to a safe `ApiError` (never a raw provider/DB error).
 */
export type ClientResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

/** Safe, user-facing default message per code; never the raw provider/DB text. */
const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "You need to be signed in.",
  FORBIDDEN: "You don't have access to that.",
  ROOM_NOT_FOUND: "No room for that code.",
  ROOM_CLOSED: "That room is closed.",
  ROOM_IN_SESSION: "This room's session has already started.",
  NOT_HOST: "Only the host can do that.",
  SESSION_INVALID_STATE: "That action isn't available right now.",
  ALREADY_JOINED: "You're already in this room.",
  RATE_LIMITED: "Too many requests — please try again shortly.",
  PROVIDER_ERROR: "Couldn't reach the restaurant service.",
  VALIDATION_ERROR: "That request was invalid.",
};

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "details" in error &&
    "hint" in error
  );
}

/** A GoTrue auth error (`@supabase/auth-js`); carries `__isAuthError` and an HTTP `status`. */
function isAuthError(error: unknown): error is { status?: number } {
  return (
    typeof error === "object" && error !== null && "__isAuthError" in error
  );
}

/**
 * Error codes the RPCs raise as their exception MESSAGE (the convention pinned at the top of
 * supabase/migrations/0005_room_rpcs.sql and reused by 0010/0011/0018/0019). A `raise exception
 * 'X'` reaches us as a PostgrestError with code `P0001` and message `X`, so we map the message
 * onto the matching `ErrorCode`. `FORBIDDEN` lands here because submit_swipe (0010) and leave_room
 * (0018) raise it as a message for a non-member of the room; a Postgres 42501 RLS denial still
 * maps to FORBIDDEN via the code path above. `ROOM_IN_SESSION` is raised by join_room (0019) once
 * a session exists (roster freeze). PROVIDER_ERROR is never raised from an RPC — only the
 * start-session Edge Function surfaces it (see sessions.ts).
 */
const RPC_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ROOM_NOT_FOUND",
  "ROOM_CLOSED",
  "ROOM_IN_SESSION",
  "NOT_HOST",
  "ALREADY_JOINED",
  "RATE_LIMITED",
  "SESSION_INVALID_STATE",
  "VALIDATION_ERROR",
]);

function asRpcErrorCode(message: unknown): ErrorCode | null {
  return typeof message === "string" &&
    (RPC_ERROR_CODES as ReadonlySet<string>).has(message)
    ? (message as ErrorCode)
    : null;
}

/**
 * Convert any Supabase/DB error into a safe `ApiError`. `fallback` is the
 * domain-appropriate code to use when the error can't be classified more
 * specifically (e.g. the auth helper passes "UNAUTHENTICATED").
 *
 * Classification order: an RLS denial (Postgres 42501) → FORBIDDEN; an RPC that raised one
 * of the doc-04 codes as its message → that code; anything else → `fallback`. The raw text is
 * logged, never surfaced (docs/06 §8, §9) — clients only ever see the mapped, safe message.
 */
export function toApiError(
  raw: unknown,
  fallback: ErrorCode = "VALIDATION_ERROR",
): ApiError {
  let code: ErrorCode = fallback;
  if (isPostgrestError(raw)) {
    // Postgres 42501 = insufficient_privilege → an RLS denial.
    code =
      raw.code === "42501"
        ? "FORBIDDEN"
        : (asRpcErrorCode(raw.message) ?? fallback);
  } else if (isAuthError(raw)) {
    // GoTrue auth errors (sign-in / OTP / guest upgrade): surface only a coarse, safe
    // classification — HTTP 429 is the email/OTP rate limit; everything else uses `fallback`.
    // The raw message (which can contain an email) is never surfaced.
    code = raw.status === 429 ? "RATE_LIMITED" : fallback;
  }
  // Log the raw error for diagnostics; never surface it (docs/06 §8 "log the rest").
  console.error("[api-client] supabase error mapped to", code, raw);
  return { error: { code, message: DEFAULT_MESSAGE[code] } };
}

/**
 * Build a safe `ApiError` for a known code with no raw source error — for a client-side guard
 * that fails before any Supabase call (e.g. refusing to create a profile for a still-anonymous
 * user). Uses the same canonical, never-raw message as {@link toApiError}.
 */
export function makeApiError(code: ErrorCode): ApiError {
  return { error: { code, message: DEFAULT_MESSAGE[code] } };
}

/**
 * Throw for not-yet-implemented endpoint stubs. Returns `never`, so it satisfies
 * any declared return type while keeping the contract typed.
 */
export function notImplemented(endpoint: string, phase: string): never {
  throw new Error(`${endpoint} is not implemented yet (lands in ${phase}).`);
}
