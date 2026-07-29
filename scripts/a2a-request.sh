#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${T2C_A2A_PORT:-18787}"
T2C_A2A_PORT="$PORT" T2C_A2A_PUBLIC_URL="http://127.0.0.1:$PORT/a2a" node "$PROJECT_ROOT/dist/src/interfaces/a2a.js" >/tmp/t2c-a2a.out 2>/tmp/t2c-a2a.err &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
ready=false
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.1
done
if [[ "$ready" != true ]]; then
  cat /tmp/t2c-a2a.err >&2 || true
  exit 1
fi
curl -fsS "http://127.0.0.1:$PORT/a2a" \
  -H 'Content-Type: application/json' \
  -H 'A2A-Version: 1.0' \
  -d '{"jsonrpc":"2.0","id":"1","method":"SendMessage","params":{"message":{"messageId":"m1","role":"ROLE_USER","parts":[{"text":"Dodać testy regresyjne dla T2C-14"}]}}}'
