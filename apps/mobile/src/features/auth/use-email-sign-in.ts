import { signInWithEmail, verifyEmailOtp } from "@munch/api-client";
import type {
  SignInWithEmailRequest,
  VerifyEmailOtpRequest,
} from "@munch/core";
import { useMutation } from "@tanstack/react-query";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * Fresh email-account sign-in (RN parity with apps/web's useEmailSignIn): step 1 emails a
 * 6-digit OTP, step 2 verifies it. Two mutations so the panel can drive an email → code flow.
 * Endpoint shapes live in @munch/api-client (CLAUDE.md §4); the safe ApiError message is
 * rethrown. This signs in as a NEW user — guests upgrading in a room use useUpgradeGuest.
 */
async function sendCodeFlow(req: SignInWithEmailRequest): Promise<void> {
  const result = await signInWithEmail(getSupabaseClient(), req.email);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
}

async function verifyFlow(req: VerifyEmailOtpRequest): Promise<void> {
  const result = await verifyEmailOtp(
    getSupabaseClient(),
    req.email,
    req.token,
  );
  if (result.error) {
    throw new Error(result.error.error.message);
  }
}

export function useEmailSignIn() {
  const sendCode = useMutation<void, Error, SignInWithEmailRequest>({
    mutationFn: sendCodeFlow,
  });
  const verify = useMutation<void, Error, VerifyEmailOtpRequest>({
    mutationFn: verifyFlow,
  });
  return { sendCode, verify };
}
