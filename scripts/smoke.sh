#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R "$PROJECT_ROOT/examples/." "$TMP/"
(
  cd "$TMP"
  git init -q
  git config user.email smoke@todo2code.local
  git config user.name "t2c smoke"
  git add .
  git commit -q -m "feat(runtime): add contract validation T2C-14"
  printf '\nexport const version = "0.2.0";\n' >> src/runtime.ts
  git add src/runtime.ts
  git commit -q -m "chore: expose runtime version"
)

T2C_ROOT="$TMP" \
T2C_ENABLE_TF=false \
OPENROUTER_API_KEY= \
node "$PROJECT_ROOT/dist/src/cli.js" pipeline "$TMP" \
  --task task.md \
  --todo TODO.md \
  --changelog CHANGELOG.md \
  --docs 'docs/**/*.md' \
  --no-docs-llm \
  --out .intent-test >/tmp/t2c-smoke-result.json

node - "$TMP" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const latest = JSON.parse(fs.readFileSync(path.join(root, '.intent-test/latest.json'), 'utf8'));
const run = path.join(root, latest.runDirectory);
for (const file of ['intent.graph.json', 'diagnostics.json', 'team-summary.md', 'manifest.json']) {
  if (!fs.existsSync(path.join(run, file))) throw new Error(`missing ${file}`);
}
const graph = JSON.parse(fs.readFileSync(path.join(run, 'intent.graph.json'), 'utf8'));
if (!graph.records.some((r) => r.source.kind === 'git')) throw new Error('missing Git records');
if (!graph.records.some((r) => r.source.kind === 'ast')) throw new Error('missing AST records');
if (!graph.records.some((r) => r.source.kind === 'todo')) throw new Error('missing TODO records');
console.log(`smoke ok: ${graph.records.length} records, ${graph.relations.length} relations`);
NODE
