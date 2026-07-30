#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUDIT_TMP="$(mktemp -d)"
A2A_PID=""

cleanup() {
  if [[ -n "$A2A_PID" ]] && kill -0 "$A2A_PID" 2>/dev/null; then
    kill "$A2A_PID" 2>/dev/null || true
    wait "$A2A_PID" 2>/dev/null || true
  fi
  rm -rf "$AUDIT_TMP"
}
trap cleanup EXIT INT TERM

cd "$PROJECT_ROOT"

npm run demo >"$AUDIT_TMP/demo.log" 2>&1

node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const latest = JSON.parse(await readFile('examples/.intent-demo/latest.json', 'utf8'));
const manifest = JSON.parse(await readFile(`examples/${latest.runDirectory}/manifest.json`, 'utf8'));
const graph = JSON.parse(await readFile(`examples/${manifest.files.graph}`, 'utf8'));
const communication = JSON.parse(await readFile('examples/.intent-communication/analysis.json', 'utf8'));

assert.equal(manifest.status, 'succeeded');
assert.equal(manifest.configuration.nlMode, 'deterministic');
assert.equal(manifest.configuration.markdownMode, 'deterministic');
assert.equal(manifest.configuration.summaryLlm, false);
assert.equal(manifest.stages.summary.status, 'skipped');
assert.equal(manifest.warnings.length, 0);
assert.ok(graph.records.length > 0);
assert.ok(graph.relations.length > 0);
assert.equal(communication.schemaVersion, 't2c.communication-analysis/v1');
assert.equal(communication.counts.blocking, 3);
assert.equal(communication.counts.warning, 1);

console.log(`demo: ${graph.records.length} records, ${graph.relations.length} relations; communication: 3 blocking, 1 warning`);
NODE

npx tsc -p examples/backend/tsconfig.json --outDir "$AUDIT_TMP/backend"
npx tsc -p examples/frontend/tsconfig.json --outDir "$AUDIT_TMP/frontend"

node --input-type=module - "$AUDIT_TMP" <<'NODE'
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const base = process.argv[2];
const { createBackend } = await import(pathToFileURL(`${base}/backend/server.js`));
const { publishEvent, fetchEvents, ApiError } = await import(pathToFileURL(`${base}/frontend/api.js`));
const { classifyEvent, toRows } = await import(pathToFileURL(`${base}/frontend/render.js`));
const { server } = createBackend();

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

try {
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
  assert.deepEqual(health, { status: 'ok', events: 0 });

  const id = await publishEvent(baseUrl, { agent: 'Codex', action: 'add', object: 'DEMO-101' });
  assert.equal(id, 'EVT-000001');
  const page = await fetchEvents(baseUrl);
  assert.equal(page.total, 1);
  assert.equal(page.events[0]?.object, 'DEMO-101');
  assert.equal(classifyEvent(page.events[0]), 'planned_not_implemented');
  assert.equal(toRows(page.events)[0]?.status, 'planned_not_implemented');

  let rejected = false;
  try {
    await publishEvent(baseUrl, { agent: '', action: 'invalid', object: '' });
  } catch (error) {
    rejected = error instanceof ApiError && error.status === 400;
  }
  assert.equal(rejected, true);
  console.log('backend/frontend: strict compilation and HTTP integration passed');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
NODE

A2A_PORT="$(node --input-type=module <<'NODE'
import { createServer } from 'node:net';
const server = createServer();
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') process.exit(1);
  process.stdout.write(String(address.port));
  server.close();
});
NODE
)"
A2A_URL="http://127.0.0.1:$A2A_PORT"

OPENROUTER_API_KEY= \
T2C_NL_MODE=deterministic \
T2C_MARKDOWN_MODE=deterministic \
T2C_COMMUNICATION_MODE=deterministic \
T2C_A2A_HOST=127.0.0.1 \
T2C_A2A_PORT="$A2A_PORT" \
T2C_A2A_PUBLIC_URL="$A2A_URL/a2a" \
node dist/src/interfaces/a2a.js >"$AUDIT_TMP/a2a.log" 2>&1 &
A2A_PID=$!

node --input-type=module - "$A2A_URL" <<'NODE'
const baseUrl = process.argv[2];
let lastError;
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    const response = await fetch(`${baseUrl}/healthz`);
    if (response.ok) process.exit(0);
    lastError = new Error(`HTTP ${response.status}`);
  } catch (error) {
    lastError = error;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
throw lastError ?? new Error('A2A server did not become ready');
NODE

npm --prefix sdk/typescript run build >"$AUDIT_TMP/sdk-typescript-build.log" 2>&1

record_sdk_log() {
  local language="$1"
  local fingerprint
  local proposal_ids
  local duplicate_ids
  local patch_fingerprint
  fingerprint="$(sed -n 's/^graph fingerprint: //p' "$AUDIT_TMP/sdk-$language.log")"
  proposal_ids="$(sed -n 's/^proposal ids: //p' "$AUDIT_TMP/sdk-$language.log")"
  duplicate_ids="$(sed -n 's/^duplicate ids: //p' "$AUDIT_TMP/sdk-$language.log")"
  patch_fingerprint="$(sed -n 's/^patch fingerprint: //p' "$AUDIT_TMP/sdk-$language.log")"
  if [[ -z "$fingerprint" || -z "$proposal_ids" || -z "$duplicate_ids" || -z "$patch_fingerprint" ]] \
    || ! grep -qx 'OK' "$AUDIT_TMP/sdk-$language.log"; then
    echo "$language SDK example did not produce graph/proposal/duplicate/patch fingerprints and OK" >&2
    return 1
  fi
  printf '%s %s\n' "$language" "$fingerprint" >>"$AUDIT_TMP/fingerprints"
  printf '%s|%s|%s|%s\n' "$language" "$proposal_ids" "$duplicate_ids" "$patch_fingerprint" >>"$AUDIT_TMP/todo-parity"
}

run_sdk() {
  local language="$1"
  shift
  T2C_A2A_URL="$A2A_URL" T2C_EXAMPLE_ROOT=examples/backend "$@" >"$AUDIT_TMP/sdk-$language.log"
  record_sdk_log "$language"
}

run_sdk typescript node sdk/typescript/dist/examples/basic.js

if command -v python3 >/dev/null 2>&1; then
  run_sdk python python3 sdk/python/examples/basic.py
else
  echo 'SKIP Python SDK: python3 unavailable'
fi

if command -v go >/dev/null 2>&1; then
  (cd sdk/go && T2C_A2A_URL="$A2A_URL" T2C_EXAMPLE_ROOT=examples/backend go run ./examples/basic) >"$AUDIT_TMP/sdk-go.log"
  record_sdk_log go
else
  echo 'SKIP Go SDK: go unavailable'
fi

if command -v cargo >/dev/null 2>&1; then
  (cd sdk/rust && T2C_A2A_URL="$A2A_URL" T2C_EXAMPLE_ROOT=examples/backend cargo run --quiet --example basic) >"$AUDIT_TMP/sdk-rust.log"
  record_sdk_log rust
else
  echo 'SKIP Rust SDK: cargo unavailable'
fi

if command -v php >/dev/null 2>&1; then
  run_sdk php php sdk/php/examples/basic.php
else
  echo 'SKIP PHP SDK: php unavailable'
fi

fingerprint_count="$(cut -d' ' -f2 "$AUDIT_TMP/fingerprints" | sed '/^$/d' | sort -u | wc -l)"
if [[ "$fingerprint_count" -ne 1 ]]; then
  echo 'SDK graph fingerprints differ:' >&2
  cat "$AUDIT_TMP/fingerprints" >&2
  exit 1
fi

shared_fingerprint="$(cut -d' ' -f2 "$AUDIT_TMP/fingerprints" | head -n 1)"
echo "SDK examples: $(wc -l <"$AUDIT_TMP/fingerprints") languages, shared fingerprint $shared_fingerprint"
todo_parity_count="$(cut -d'|' -f2- "$AUDIT_TMP/todo-parity" | sort -u | wc -l)"
if [[ "$todo_parity_count" -ne 1 ]]; then
  echo 'SDK TODO proposal/duplicate/patch results differ:' >&2
  cat "$AUDIT_TMP/todo-parity" >&2
  exit 1
fi
shared_patch_fingerprint="$(cut -d'|' -f4 "$AUDIT_TMP/todo-parity" | head -n 1)"
echo "SDK DSL2TODO: shared proposal IDs, duplicates and patch fingerprint $shared_patch_fingerprint"
echo 'examples check: PASS'
