#!/usr/bin/env bash
# check-secrets.sh — fail if a provider API key or Supabase service-role/secret
# key VALUE appears in client-shipped code (apps/* or packages/*).
#
# Per CLAUDE.md §3 and docs/06-coding-standards.md §9/§12: provider keys and the
# Supabase service-role key are server-only and must never reach a client bundle.
#
# We match secret *value* patterns, not the words "service-role", so the
# intentional security-guard comments in supabase.ts files don't trip the check.
# `git grep` scans tracked files only, which excludes node_modules/, .next/, and
# .env automatically.

set -euo pipefail

# "<regex>|<human label>"  (the regexes contain no literal '|')
patterns=(
  'AIza[0-9A-Za-z_-]{35}|Google API key (provider)'
  'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+|hardcoded JWT (Supabase anon / service-role key)'
  'sb_secret_[A-Za-z0-9]|Supabase secret / service-role key'
)

scope=(apps packages)
found=0

for entry in "${patterns[@]}"; do
  regex="${entry%%|*}"
  label="${entry#*|}"
  # git grep exits 1 when nothing matches — that is the success case here.
  if matches="$(git grep -nE "$regex" -- "${scope[@]}")"; then
    echo "✖ Potential secret leaked — ${label}:"
    echo "${matches}" | sed 's/^/    /'
    found=1
  fi
done

if [ "${found}" -ne 0 ]; then
  echo ""
  echo "Secret-leak check FAILED. Provider/service-role keys are server-only (CLAUDE.md §3)."
  echo "Move the value to Supabase Edge Function env; never commit it under apps/ or packages/."
  exit 1
fi

echo "✓ No provider or service-role key patterns found in apps/ or packages/."
