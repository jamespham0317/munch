import { z } from "zod";

import { displayNameSchema, emailOtpSchema, emailSchema } from "./common";

/**
 * Request/response schemas for the optional-account flows in docs/04-api-specification.md §2:
 * email sign-in (a fresh account) and the guest->account upgrade (linking an email to the
 * current anonymous user, in place). Verification is by 6-digit email OTP — see the api-client
 * auth helpers. Wire shapes are snake_case (docs/06 §5); the api-client maps to camelCase.
 *
 * Phase 1 keeps this lean (a sign-in/upgrade hook, not full account UX — docs/07; that and the
 * history screen are Phase 4). Guest stays the default identity and is never required.
 */

// --- fresh email account ----------------------------------------------------

/** Step 1: request a sign-in OTP for `email` (creates the user if new). */
export const signInWithEmailRequestSchema = z.object({
  email: emailSchema,
});
export type SignInWithEmailRequest = z.infer<
  typeof signInWithEmailRequestSchema
>;

/** Step 2: verify the 6-digit OTP emailed for a fresh sign-in. */
export const verifyEmailOtpRequestSchema = z.object({
  email: emailSchema,
  token: emailOtpSchema,
});
export type VerifyEmailOtpRequest = z.infer<typeof verifyEmailOtpRequestSchema>;

// --- guest -> account upgrade -----------------------------------------------

/**
 * Step 1: link `email` to the CURRENT anonymous user and choose the display name to persist.
 * The user_id is unchanged by the upgrade (CLAUDE.md §3); only a profiles row is added on
 * confirmation. `display_name` is carried through to step 2 so the profile gets it.
 */
export const upgradeGuestRequestSchema = z.object({
  email: emailSchema,
  display_name: displayNameSchema,
});
export type UpgradeGuestRequest = z.infer<typeof upgradeGuestRequestSchema>;

/** Step 2: confirm the email-change OTP and persist the chosen display name to the profile. */
export const confirmGuestUpgradeRequestSchema = z.object({
  email: emailSchema,
  token: emailOtpSchema,
  display_name: displayNameSchema,
});
export type ConfirmGuestUpgradeRequest = z.infer<
  typeof confirmGuestUpgradeRequestSchema
>;

// --- profile response -------------------------------------------------------

/** The profile row created/ensured on confirmation (docs/03 §3.1). Echoed snake_case. */
export const profileResponseSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
