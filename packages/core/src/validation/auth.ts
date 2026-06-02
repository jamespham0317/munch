import { z } from "zod";

import { displayNameSchema, emailSchema, passwordSchema } from "./common";

/**
 * Request/response schemas for the account-auth flows in docs/04-api-specification.md §2:
 * email+password register/sign-in (with email confirmation on register), a password-reset
 * round-trip, and Google OAuth. Google needs no request schema — it is a redirect, not a form
 * post — so only its profile result flows through here. Wire shapes are snake_case (docs/06 §5);
 * the api-client maps to camelCase.
 *
 * Auth lives only outside a room (home + /history); a guest who joined a room stays a guest
 * (CLAUDE.md §3). There is no in-place guest->account upgrade.
 */

// --- email + password account -----------------------------------------------

/** Register a fresh account; `display_name` is carried into user metadata for the profile. */
export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  display_name: displayNameSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/** Sign in to an existing email+password account. */
export const signInRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type SignInRequest = z.infer<typeof signInRequestSchema>;

// --- password reset ---------------------------------------------------------

/** Request a password-reset (recovery) email for `email`. */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

/** Set a new password on the current recovery session. */
export const updatePasswordRequestSchema = z.object({
  password: passwordSchema,
});
export type UpdatePasswordRequest = z.infer<typeof updatePasswordRequestSchema>;

// --- profile response -------------------------------------------------------

/** The profile row created/ensured on first sign-in (docs/03 §3.1). Echoed snake_case. */
export const profileResponseSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
