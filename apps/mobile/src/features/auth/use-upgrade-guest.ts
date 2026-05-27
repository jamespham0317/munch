import { confirmGuestUpgrade, upgradeGuestToAccount } from "@munch/api-client";
import type {
  ConfirmGuestUpgradeRequest,
  UpgradeGuestRequest,
} from "@munch/core";
import { useMutation } from "@tanstack/react-query";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * Guest → account upgrade (RN parity with apps/web's useUpgradeGuest): step 1 links an email
 * to the current anonymous user and emails a 6-digit OTP; step 2 confirms it and writes the
 * profile. The user_id is unchanged, so the guest keeps their room membership (CLAUDE.md §3).
 * Endpoint shapes live in @munch/api-client (CLAUDE.md §4); the safe ApiError message is
 * rethrown. OTP code entry (not a magic link) keeps the in-memory anonymous session alive on
 * mobile, so the same auth.uid() carries through the upgrade.
 */
async function sendCodeFlow(req: UpgradeGuestRequest): Promise<void> {
  const result = await upgradeGuestToAccount(getSupabaseClient(), req.email);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
}

async function confirmFlow(req: ConfirmGuestUpgradeRequest): Promise<void> {
  const result = await confirmGuestUpgrade(
    getSupabaseClient(),
    req.email,
    req.token,
    req.display_name,
  );
  if (result.error) {
    throw new Error(result.error.error.message);
  }
}

export function useUpgradeGuest() {
  const sendCode = useMutation<void, Error, UpgradeGuestRequest>({
    mutationFn: sendCodeFlow,
  });
  const confirm = useMutation<void, Error, ConfirmGuestUpgradeRequest>({
    mutationFn: confirmFlow,
  });
  return { sendCode, confirm };
}
