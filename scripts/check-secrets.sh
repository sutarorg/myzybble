#!/usr/bin/env bash
# Blocks credential-like content from being committed.
#
# Usage:
#   scripts/check-secrets.sh            # scan files staged for commit
#   scripts/check-secrets.sh --all      # scan every tracked file
#
# Add it to a git hook with:
#   ln -s ../../scripts/check-secrets.sh .git/hooks/pre-commit
set -euo pipefail

ALLOWLIST=(
  ".env.example"
  "docs/security.md"
  "README.md"
)

PATTERNS=(
  # private key blocks
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  # provider key material
  'sk_live_[A-Za-z0-9]{16,}'
  'sk_test_[A-Za-z0-9]{16,}'
  'rzp_live_[A-Za-z0-9]{10,}'
  'rzp_test_[A-Za-z0-9]{10,}'
  'whsec_[A-Za-z0-9]{16,}'
  're_[A-Za-z0-9]{20,}'
  'AIza[A-Za-z0-9_-]{30,}'
  # assignments that carry a real value
  '(SUPABASE_SERVICE_ROLE_KEY|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|GEMINI_API_KEY|RESEND_API_KEY|DATABASE_PASSWORD|SMTP_PASSWORD|MAILBOX_ENCRYPTION_KEY|CRON_SECRET)="[^"<$]{12,}"'
  '(SUPABASE_SERVICE_ROLE_KEY|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|GEMINI_API_KEY|RESEND_API_KEY|DATABASE_PASSWORD|SMTP_PASSWORD|MAILBOX_ENCRYPTION_KEY|CRON_SECRET)=[A-Za-z0-9_/+.-]{20,}'
  # service-role / legacy JWTs
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{40,}'
)

if [[ "${1:-}" == "--all" ]]; then
  mapfile -t FILES < <(git ls-files)
else
  mapfile -t FILES < <(git diff --cached --name-only --diff-filter=ACM)
fi

is_allowlisted() {
  local f="$1"
  for a in "${ALLOWLIST[@]}"; do
    [[ "$f" == "$a" ]] && return 0
  done
  return 1
}

FAILED=0
for f in "${FILES[@]:-}"; do
  [[ -z "$f" ]] && continue
  [[ -f "$f" ]] || continue
  is_allowlisted "$f" && continue
  if [[ "$f" == *.env || "$f" == *.env.* ]] && [[ "$f" != ".env.example" ]]; then
    # .env files are gitignored; a tracked one is itself the problem.
    echo "secret-scan: refusing to track environment file: $f" >&2
    FAILED=1
    continue
  fi
  for p in "${PATTERNS[@]}"; do
    if grep -nE "$p" "$f" >/dev/null 2>&1; then
      echo "secret-scan: possible secret in $f (matched: $p)" >&2
      grep -nE "$p" "$f" | head -3 >&2 || true
      FAILED=1
    fi
  done
done

if [[ "$FAILED" -ne 0 ]]; then
  cat >&2 <<'MSG'

A possible credential was detected. Do not commit it.
  - Move the value to an environment variable.
  - If this is a false positive, document it in the ALLOWLIST array in
    scripts/check-secrets.sh with a comment explaining why.
MSG
  exit 1
fi

echo "secret-scan: clean"
