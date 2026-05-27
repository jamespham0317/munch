import { z } from "zod";

import { JOIN_CODE_LENGTH, RADIUS_MAX_M, RADIUS_MIN_M } from "../constants";

/**
 * Shared primitive schemas and the standard error envelope. Wire shapes are
 * snake_case to match docs/04-api-specification.md; the api-client maps to/from
 * camelCase domain types at its boundary (docs/06 §5).
 */

/** Latitude in decimal degrees. */
export const latSchema = z.number().min(-90).max(90);
/** Longitude in decimal degrees. */
export const lngSchema = z.number().min(-180).max(180);
/** Search radius in metres, clamped to sane bounds (docs/04 §7). */
export const radiusMSchema = z
  .number()
  .int()
  .min(RADIUS_MIN_M)
  .max(RADIUS_MAX_M);
/** 6-digit numeric room join code. */
export const joinCodeSchema = z
  .string()
  .length(JOIN_CODE_LENGTH)
  .regex(/^\d+$/, "Join code must be digits only.");
/** A member's chosen display name (guest or account); length-limited (docs/04 §6). */
export const displayNameSchema = z.string().min(1).max(50);
/** An account email for optional sign-in / guest upgrade (docs/04 §2). */
export const emailSchema = z.email();
/**
 * The 6-digit email OTP used for email sign-in and the guest->account upgrade. Length is
 * pinned to `otp_length = 6` in supabase/config.toml; keep the two in sync if that changes.
 */
export const emailOtpSchema = z
  .string()
  .length(6)
  .regex(/^\d+$/, "Code must be 6 digits.");

/** Common error codes shared by all endpoints (docs/04 §1). */
export const errorCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ROOM_NOT_FOUND",
  "ROOM_CLOSED",
  "NOT_HOST",
  "SESSION_INVALID_STATE",
  "ALREADY_JOINED",
  "RATE_LIMITED",
  "PROVIDER_ERROR",
  "VALIDATION_ERROR",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** The standard error envelope every endpoint returns (CLAUDE.md §5, docs/04 §1). */
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
