#!/usr/bin/env bash
# check-no-legacy-auth.sh — fail if any superseded OTP / guest-upgrade auth symbol
# reappears in client-shipped code (apps/* or packages/*).
#
# Phase 4.5 (docs/07 §6.5) replaced the email-OTP account path and the in-place
# guest->account upgrade with email+password + Google OAuth (docs/04 §2). The old
# symbols were deleted; this guard keeps them from creeping back in a later change.
#
# `git grep` scans tracked files only, which excludes node_modules/, .next/, and
# build output automatically (so stale bundles don't trip the check).

set -euo pipefail

# Symbols removed in Phase 4.5 (core schemas, api-client helpers, app hooks).
symbols=(
  'signInWithEmailRequestSchema'
  'verifyEmailOtpRequestSchema'
  'upgradeGuestRequestSchema'
  'confirmGuestUpgradeRequestSchema'
  'emailOtpSchema'
  'verifyEmailOtp'
  'upgradeGuestToAccount'
  'confirmGuestUpgrade'
  'use-upgrade-guest'
)

# A word-boundary regex so `signInWithEmail` matches the removed OTP helper without
# also matching the current `signInWithEmailPassword`.
regex="$(IFS='|'; echo "\\b(${symbols[*]}|signInWithEmail)\\b")"

scope=(apps packages)

# git grep exits 1 when nothing matches — that is the success case here.
if matches="$(git grep -nE "$regex" -- "${scope[@]}")"; then
  echo "✖ Superseded OTP / guest-upgrade auth symbol found in client code:"
  echo "${matches}" | sed 's/^/    /'
  echo ""
  echo "Legacy-auth check FAILED. Phase 4.5 removed the OTP account path and the"
  echo "in-place guest->account upgrade (docs/04 §2, docs/07 §6.5). Use the"
  echo "email+password / Google helpers in @munch/api-client instead."
  exit 1
fi

echo "✓ No superseded OTP / guest-upgrade auth symbols found in apps/ or packages/."
