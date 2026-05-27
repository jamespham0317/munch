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

/**
 * Error codes the room RPCs raise as their exception MESSAGE (the convention pinned at the
 * top of supabase/migrations/0005_room_rpcs.sql). A `raise exception 'ROOM_NOT_FOUND'` reaches
 * us as a PostgrestError with code `P0001` and message `ROOM_NOT_FOUND`, so we map the message
 * onto the matching `ErrorCode`. Codes not in this set (FORBIDDEN, PROVIDER_ERROR) are never
 * raised this way — they are classified by other signals (42501) or belong to other phases.
 */
const RPC_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  "UNAUTHENTICATED",
  "ROOM_NOT_FOUND",
  "ROOM_CLOSED",
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
  }
  // Log the raw error for diagnostics; never surface it (docs/06 §8 "log the rest").
  console.error("[api-client] supabase error mapped to", code, raw);
  return { error: { code, message: DEFAULT_MESSAGE[code] } };
}

/**
 * Throw for not-yet-implemented endpoint stubs. Returns `never`, so it satisfies
 * any declared return type while keeping the contract typed.
 */
export function notImplemented(endpoint: string, phase: string): never {
  throw new Error(`${endpoint} is not implemented yet (lands in ${phase}).`);
}
