#!/usr/bin/env bash
set -uo pipefail

SUITE="${1:-core}"
ROOT="${T2C_ROOT:-/workspace}"

fail() {
  local code="$1"
  local message="$2"
  local remediation="$3"
  printf '%s: %s\n' "$code" "$message" >&2
  printf '%s: remediation: %s\n' "$code" "$remediation" >&2
  exit 1
}

require_command() {
  local command="$1"
  command -v "$command" >/dev/null 2>&1 || fail \
    "T2C-E2E-010" \
    "required command is unavailable: $command" \
    "build the correct Dockerfile.e2e target or install $command in a derived image"
}

run_step() {
  local code="$1"
  local name="$2"
  local remediation="$3"
  shift 3
  local log="/tmp/t2c-e2e-$name.log"
  printf '[T2C-E2E] START %s\n' "$name"
  "$@" 2>&1 | tee "$log"
  local status="${PIPESTATUS[0]}"
  if [[ "$status" -ne 0 ]]; then
    fail "$code" "$name failed with exit status $status" "$remediation"
  fi
  printf '[T2C-E2E] PASS %s\n' "$name"
}

case "$SUITE" in
  core|full) ;;
  *)
    fail "T2C-E2E-001" "unknown E2E suite: $SUITE" \
      "use 'core' or 'full'"
    ;;
esac

[[ -d "$ROOT" ]] || fail "T2C-E2E-002" \
  "T2C_ROOT does not exist: $ROOT" \
  "set T2C_ROOT to the baked workspace path, normally /workspace"
cd "$ROOT" || fail "T2C-E2E-003" \
  "cannot enter T2C_ROOT: $ROOT" \
  "check container filesystem ownership and the T2C_ROOT value"

for command in node npm git python3; do require_command "$command"; done
if [[ "$SUITE" == full ]]; then
  for command in go java javac cargo php; do require_command "$command"; done
fi

# Docker build contexts deliberately exclude host Git metadata. Create a
# deterministic ten-commit repository so the default Git extraction depth is
# fully exercised without inheriting mutable host history or emitting a
# shallow-history warning in the examples contract.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init -q --initial-branch=main
  git config user.email e2e@todo2code.local
  git config user.name 'todo2code E2E'
  git add -A
  git commit -q -m 'test: synthetic E2E fixture'
  for index in {2..10}; do
    git commit -q --allow-empty -m "test: synthetic E2E history $index"
  done
fi

printf '[T2C-E2E] suite=%s root=%s node=%s\n' "$SUITE" "$ROOT" "$(node --version)"

run_step "T2C-E2E-101" verify \
  "run npm run verify locally and repair the first failing contract or test" \
  npm run verify

if [[ "$SUITE" == full ]] && grep -Eq '^# skipped [1-9][0-9]*$' /tmp/t2c-e2e-verify.log; then
  fail "T2C-E2E-102" "full verification contains skipped tests" \
    "install the missing language runtime or make its required test fail closed"
fi

run_step "T2C-E2E-103" gold-v2 \
  "inspect the v2 precision/recall regression and its failing fixture" \
  npm run evaluate:gold
run_step "T2C-E2E-104" gold-v1 \
  "preserve backward compatibility with the v1 benchmark" \
  npm run evaluate:gold:v1
run_step "T2C-E2E-105" cli-smoke \
  "inspect the first failed deterministic CLI pipeline stage" \
  bash scripts/smoke.sh
run_step "T2C-E2E-106" mcp-smoke \
  "inspect MCP request/response framing and server stderr" \
  bash scripts/mcp-request.sh
run_step "T2C-E2E-107" a2a-smoke \
  "inspect A2A startup, health and task lifecycle output" \
  bash scripts/a2a-request.sh
run_step "T2C-E2E-108" examples \
  "inspect demo, HTTP integration and per-SDK logs" \
  npm run examples:check

if [[ "$SUITE" == full ]] && ! grep -q 'SDK examples: 5 languages' /tmp/t2c-e2e-examples.log; then
  fail "T2C-E2E-109" "full E2E did not execute all five SDK examples" \
    "verify Node, Python, Go, Rust and PHP commands inside the e2e-full image"
fi

printf 'T2C-E2E-000: PASS suite=%s\n' "$SUITE"
