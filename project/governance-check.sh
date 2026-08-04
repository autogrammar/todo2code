#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node --test "$repo_root/.governance/resolve-approval.test.mjs"
python3 "$repo_root/.governance/governance_check.py" \
  --root "$repo_root" \
  --manifest .governance/manifest.json \
  --lock .governance/manifest.lock.json \
  --stack-profiles .governance/stack-profiles.json \
  "$@"
