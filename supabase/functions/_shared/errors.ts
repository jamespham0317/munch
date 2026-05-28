// _shared/errors.ts
// Edge-side error primitives. The Edge Function catches these (or any thrown Error)
// and serializes to the doc-04 §1 `{ error: { code, message } }` envelope; raw
// provider/DB text is NEVER surfaced (CLAUDE.md §3, docs/06 §8/§9).

/** Doc-04 §1 error codes Phase 2 Edge Functions raise. Kept narrow to what's used here. */
export type EdgeErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_HOST"
  | "SESSION_INVALID_STATE"
  | "VALIDATION_ERROR"
  | "PROVIDER_ERROR";

/** Safe, user-facing default per code; mirrors api-client/src/errors.ts DEFAULT_MESSAGE. */
const DEFAULT_MESSAGE: Record<EdgeErrorCode, string> = {
  UNAUTHENTICATED: "You need to be signed in.",
  FORBIDDEN: "You don't have access to that.",
  NOT_HOST: "Only the host can do that.",
  SESSION_INVALID_STATE: "That action isn't available right now.",
  VALIDATION_ERROR: "That request was invalid.",
  PROVIDER_ERROR: "Couldn't reach the restaurant service.",
};

/**
 * A failure the Edge Function wants to surface as a known doc-04 code. Throw one of
 * these from anywhere in the handler — the top-level try/catch maps to the response
 * envelope and the appropriate HTTP status. The raw `cause` is logged, not surfaced.
 */
export class EdgeError extends Error {
  constructor(
    public readonly code: EdgeErrorCode,
    cause?: unknown,
  ) {
    super(DEFAULT_MESSAGE[code]);
    this.name = "EdgeError";
    if (cause !== undefined) this.cause = cause;
  }
}

/** Convenience: any thrown provider failure is wrapped to PROVIDER_ERROR. */
export class ProviderError extends EdgeError {
  constructor(cause?: unknown) {
    super("PROVIDER_ERROR", cause);
    this.name = "ProviderError";
  }
}

/** HTTP status for each error code. Matches typical REST conventions. */
export function statusForCode(code: EdgeErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
    case "NOT_HOST":
      return 403;
    case "SESSION_INVALID_STATE":
      return 409;
    case "VALIDATION_ERROR":
      return 400;
    case "PROVIDER_ERROR":
      return 502;
  }
}

/** The standard error envelope (docs/04 §1). */
export function errorBody(code: EdgeErrorCode): {
  error: { code: EdgeErrorCode; message: string };
} {
  return { error: { code, message: DEFAULT_MESSAGE[code] } };
}
