#!/usr/bin/env bash
# Repo-local verify — used by pyqual.yaml and .planfile/.koru/policy.yaml.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
npm run build
npm test
