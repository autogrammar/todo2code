# todo2code (`t2c`)

Dependency-free Python SDK for todo2code A2A and the local TypeScript runtime

## Contents

- [Metadata](#metadata)
- [Architecture](#architecture)
- [Interfaces](#interfaces)
- [Workflows](#workflows)
- [Configuration](#configuration)
- [Dependencies](#dependencies)
- [Deployment](#deployment)
- [Environment Variables (`.env.example`)](#environment-variables-envexample)
- [Release Management (`goal.yaml`)](#release-management-goalyaml)
- [Makefile Targets](#makefile-targets)
- [Node.js Scripts (`package.json`)](#nodejs-scripts-packagejson)
- [Code Analysis](#code-analysis)
- [Call Graph](#call-graph)
- [Test Contracts](#test-contracts)
- [Intent](#intent)

## Metadata

- **name**: `todo2code`
- **version**: `0.5.1`
- **python_requires**: `>=3.10`
- **license**: Apache-2.0
- **ecosystem**: SUMD + DOQL + testql + taskfile
- **generated_from**: pyproject.toml, Makefile, testql(1), app.doql.less, goal.yaml, .env.example, Dockerfile, docker-compose.yml, package.json, project/(3 analysis files)

## Architecture

```
SUMD (description) → DOQL/source (code) → taskfile (automation) → testql (verification)
```

### DOQL Application Declaration (`app.doql.less`)

```less markpact:doql path=app.doql.less
// LESS format — define @variables here as needed

app {
  name: todo2code;
  version: 0.5.1;
}

workflow[name="setup"] {
  trigger: manual;
  step-1: run cmd=test -f .env || cp .env.example .env;
  step-2: run cmd=$(NPM) install --omit=optional;
}

workflow[name="install"] {
  trigger: manual;
  step-1: run cmd=$(NPM) install --omit=optional;
}

workflow[name="install-tf"] {
  trigger: manual;
  step-1: run cmd=$(NPM) --prefix adapters/tensorflow install;
}

workflow[name="build"] {
  trigger: manual;
  step-1: run cmd=$(NPM) run build;
}

workflow[name="check"] {
  trigger: manual;
  step-1: run cmd=$(NPM) run check;
}

workflow[name="test"] {
  trigger: manual;
  step-1: run cmd=$(NPM) test;
}

workflow[name="verify-no-llm"] {
  trigger: manual;
  step-1: run cmd=$(NPM) run verify:no-llm;
}

workflow[name="verify-modules"] {
  trigger: manual;
  step-1: run cmd=$(NPM) run verify:modules;
}

workflow[name="verify-env"] {
  trigger: manual;
  step-1: run cmd=$(NPM) run verify:env;
}

workflow[name="verify"] {
  trigger: manual;
  step-1: run cmd=$(NPM) run verify;
}

workflow[name="governance"] {
  trigger: manual;
  step-1: run cmd=bash project/governance-check.sh --actor agent;
}

workflow[name="smoke"] {
  trigger: manual;
  step-1: run cmd=bash scripts/smoke.sh;
}

workflow[name="doctor"] {
  trigger: manual;
  step-1: run cmd=$(NODE) dist/src/cli.js doctor;
}

workflow[name="mcp-probe"] {
  trigger: manual;
  step-1: run cmd=bash scripts/mcp-request.sh;
}

workflow[name="a2a-probe"] {
  trigger: manual;
  step-1: run cmd=bash scripts/a2a-request.sh;
}

workflow[name="protocol-smoke"] {
  trigger: manual;
  step-1: depend target=mcp-probe;
  step-2: depend target=a2a-probe;
}

workflow[name="validate"] {
  trigger: manual;
  step-1: depend target=verify;
  step-2: depend target=smoke;
  step-3: depend target=protocol-smoke;
  step-4: depend target=doctor;
  step-5: depend target=docker-smoke;
}

workflow[name="live-contract-check"] {
  trigger: manual;
  step-1: run cmd=$(NPM) run live:check;
}

workflow[name="live-model-comparison"] {
  trigger: manual;
  step-1: run cmd=$(NPM) run live:models;
}

workflow[name="demo"] {
  trigger: manual;
  step-1: run cmd=OPENROUTER_API_KEY= T2C_NL_MODE=deterministic T2C_MARKDOWN_MODE=deterministic T2C_COMMUNICATION_MODE=deterministic $(NODE) dist/src/cli.js pipeline examples --task task.md --todo TODO.md --changelog CHANGELOG.md --docs 'docs/**/*.md' --no-docs-llm --no-summary-llm --out .intent-demo;
  step-2: run cmd=T2C_COMMUNICATION_MODE=deterministic $(NODE) dist/src/cli.js communication examples --project-dir project --ticket DEMO-101 --out examples/.intent-communication/analysis.json --md examples/.intent-communication/analysis.md --graph examples/.intent-communication/graph.json;
}

workflow[name="demollm"] {
  trigger: manual;
  step-1: run cmd=OPENROUTER_TIMEOUT_MS=300000 T2C_DOC_TIMEOUT_MS=300000 $(NODE) dist/src/cli.js pipeline examples --task task.md --todo TODO.md --changelog CHANGELOG.md --docs 'docs/**/*.md' --nl-mode require-llm --markdown-mode require-llm --communication-mode require-llm --summary-fallback false --task-mode require-llm --out .intent-demo-llm;
  step-2: run cmd=$(NODE) scripts/assert-demollm-run.mjs examples .intent-demo-llm;
}

workflow[name="examples-check"] {
  trigger: manual;
  step-1: run cmd=bash scripts/examples-check.sh;
}

workflow[name="pipeline"] {
  trigger: manual;
  step-1: run cmd=$(NODE) dist/src/cli.js pipeline "$(ROOT)" --task "$(TASK)" --todo "$(TODO)" --changelog "$(CHANGELOG)" --docs "$(DOCS)" --out "$(OUT)";
}

workflow[name="compare-workspace"] {
  trigger: manual;
  step-1: run cmd=$(NODE) dist/src/cli.js compare-workspace "$(ROOT)" --base "$${BASE_REF:-origin/main}" --out "$(OUT)";
}

workflow[name="preflight"] {
  trigger: manual;
  step-1: run cmd=$(NPM) run build >&2;
  step-2: run cmd=$(NODE) scripts/workspace-preflight.mjs \;
  step-3: run cmd=--root $(call shell_quote,PREFLIGHT_ROOT) \;
  step-4: run cmd=--baseline $(call shell_quote,PREFLIGHT_BASELINE) \;
  step-5: run cmd=--expected-branch $(call shell_quote,PREFLIGHT_EXPECTED_BRANCH) \;
  step-6: run cmd=--actor $(call shell_quote,PREFLIGHT_ACTOR);
}

workflow[name="mcp"] {
  trigger: manual;
  step-1: run cmd=$(NODE) dist/src/interfaces/mcp.js;
}

workflow[name="a2a"] {
  trigger: manual;
  step-1: run cmd=$(NODE) dist/src/interfaces/a2a.js;
}

workflow[name="docker-build"] {
  trigger: manual;
  step-1: run cmd=docker build -t todo2code:local .;
}

workflow[name="docker-smoke"] {
  trigger: manual;
  step-1: run cmd=bash scripts/docker-smoke.sh;
}

workflow[name="docker-up"] {
  trigger: manual;
  step-1: run cmd=docker compose -f docker-compose.yml up --build -d;
}

workflow[name="docker-down"] {
  trigger: manual;
  step-1: run cmd=docker compose -f docker-compose.yml down;
}

workflow[name="e2e-core"] {
  trigger: manual;
  step-1: run cmd=docker compose -f $(E2E_COMPOSE) build e2e-core;
  step-2: run cmd=docker compose -f $(E2E_COMPOSE) run --rm --no-deps e2e-core;
}

workflow[name="e2e-full"] {
  trigger: manual;
  step-1: run cmd=docker compose -f $(E2E_COMPOSE) build e2e-full;
  step-2: run cmd=docker compose -f $(E2E_COMPOSE) run --rm --no-deps e2e-full;
}

workflow[name="e2e-clean"] {
  trigger: manual;
  step-1: run cmd=docker compose -f $(E2E_COMPOSE) down --remove-orphans --rmi all;
}

workflow[name="python-wheel"] {
  trigger: manual;
  step-1: run cmd=mkdir -p "$(PYTHON_WHEEL_DIR)";
  step-2: run cmd=$(PYTHON) -m pip wheel . --no-deps --wheel-dir "$(PYTHON_WHEEL_DIR)";
}

workflow[name="package"] {
  trigger: manual;
  step-1: run cmd=$(PYTHON) scripts/package.py "$(PACKAGE)";
}

workflow[name="clean"] {
  trigger: manual;
  step-1: run cmd=rm -rf dist coverage .intent-demo .intent-test *.zip;
}

env_vars {
  keys: T2C_ENV_FILE, T2C_ROOT, T2C_OUTPUT_DIR, T2C_GIT_COMMIT_COUNT, T2C_MAX_FILE_BYTES, T2C_DOC_CONCURRENCY, T2C_DOC_CHUNK_CHARS, T2C_DOC_MAX_CHUNKS, T2C_DOC_MAX_RECORDS_PER_CHUNK, T2C_DOC_TIMEOUT_MS, T2C_PYTHON, T2C_ENABLE_PYTHON_AST, T2C_GO, T2C_ENABLE_GO_AST, T2C_JAVA, T2C_ENABLE_JAVA_AST, T2C_CARGO, T2C_ENABLE_RUST_AST, T2C_PHP, T2C_ENABLE_PHP_AST, T2C_ALLOW_OUTSIDE_ROOT, T2C_ENABLE_TF, T2C_TF_MODEL_PATH, T2C_TF_MODULE_PATH, T2C_TF_LABELS, T2C_NL_MODE, T2C_MARKDOWN_MODE, T2C_COMMUNICATION_MODE, OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENROUTER_MODEL, OPENROUTER_NL_MODEL, OPENROUTER_MARKDOWN_MODEL, OPENROUTER_COMMUNICATION_MODEL, OPENROUTER_DOC_MODEL, OPENROUTER_SUMMARY_MODEL, OPENROUTER_TASK_MODEL, OPENROUTER_SITE_URL, OPENROUTER_APP_NAME, OPENROUTER_TIMEOUT_MS, OPENROUTER_MAX_TOKENS, OPENROUTER_TEMPERATURE, OPENROUTER_REQUIRE_STRUCTURED_OUTPUT, OPENROUTER_RESPONSE_HEALING, T2C_REQUIRE_LIVE_CHECK, T2C_LIVE_AUDIT_PATH, T2C_LIVE_HISTORY_PATH, T2C_LIVE_RUN_OUTPUT, T2C_LIVE_MAX_STAGE_LATENCY_MS, T2C_LIVE_MAX_LATENCY_MS, T2C_LIVE_MAX_TOTAL_LATENCY_MS, T2C_LIVE_MAX_COST_USD, T2C_LIVE_COMPARE_MODELS, T2C_LIVE_COMPARE_ROOT, T2C_LIVE_COMPARE_TIMEOUT_MS, T2C_LIVE_COMPARE_PATH, T2C_LIVE_COMPARE_MD_PATH, T2C_DOC_PATTERNS, T2C_MARKDOWN_CONCURRENCY, T2C_DOC_EXCLUDES, T2C_MCP_SERVER_NAME, T2C_MCP_SERVER_VERSION, T2C_A2A_HOST, T2C_A2A_PORT, T2C_A2A_PUBLIC_URL, T2C_A2A_TOKEN, T2C_A2A_MAX_BODY_BYTES, T2C_A2A_TASK_STORE, T2C_WORKSPACE, T2C_DOCKER_HOST_PORT, T2C_A2A_URL, T2C_EXAMPLE_ROOT, T2C_COMPARE_WORKSPACE, T2C_COMPARE_BASE, T2C_TYPESCRIPT_CLI;
}

deploy {
  target: docker-compose;
  compose_file: docker-compose.yml;
}

environment[name="local"] {
  runtime: docker-compose;
  env_file: .env.example;
  template_file: .env.example;
  python_version: >=3.10;
  vars: OPENROUTER_API_KEY, OPENROUTER_APP_NAME, OPENROUTER_BASE_URL, OPENROUTER_COMMUNICATION_MODEL, OPENROUTER_DOC_MODEL, OPENROUTER_MARKDOWN_MODEL, OPENROUTER_MAX_TOKENS, OPENROUTER_MODEL, OPENROUTER_NL_MODEL, OPENROUTER_REQUIRE_STRUCTURED_OUTPUT, OPENROUTER_RESPONSE_HEALING, OPENROUTER_SITE_URL, OPENROUTER_SUMMARY_MODEL, OPENROUTER_TASK_MODEL, OPENROUTER_TEMPERATURE, OPENROUTER_TIMEOUT_MS, T2C_A2A_HOST, T2C_A2A_MAX_BODY_BYTES, T2C_A2A_PORT, T2C_A2A_PUBLIC_URL, T2C_A2A_TASK_STORE, T2C_A2A_TOKEN, T2C_A2A_URL, T2C_ALLOW_OUTSIDE_ROOT, T2C_CARGO, T2C_COMMUNICATION_MODE, T2C_COMPARE_BASE, T2C_COMPARE_WORKSPACE, T2C_DOCKER_HOST_PORT, T2C_DOC_CHUNK_CHARS, T2C_DOC_CONCURRENCY, T2C_DOC_EXCLUDES, T2C_DOC_MAX_CHUNKS, T2C_DOC_MAX_RECORDS_PER_CHUNK, T2C_DOC_PATTERNS, T2C_DOC_TIMEOUT_MS, T2C_ENABLE_GO_AST, T2C_ENABLE_JAVA_AST, T2C_ENABLE_PHP_AST, T2C_ENABLE_PYTHON_AST, T2C_ENABLE_RUST_AST, T2C_ENABLE_TF, T2C_ENV_FILE, T2C_EXAMPLE_ROOT, T2C_GIT_COMMIT_COUNT, T2C_GO, T2C_JAVA, T2C_LIVE_AUDIT_PATH, T2C_LIVE_COMPARE_MD_PATH, T2C_LIVE_COMPARE_MODELS, T2C_LIVE_COMPARE_PATH, T2C_LIVE_COMPARE_ROOT, T2C_LIVE_COMPARE_TIMEOUT_MS, T2C_LIVE_HISTORY_PATH, T2C_LIVE_MAX_COST_USD, T2C_LIVE_MAX_LATENCY_MS, T2C_LIVE_MAX_STAGE_LATENCY_MS, T2C_LIVE_MAX_TOTAL_LATENCY_MS, T2C_LIVE_RUN_OUTPUT, T2C_MARKDOWN_CONCURRENCY, T2C_MARKDOWN_MODE, T2C_MAX_FILE_BYTES, T2C_MCP_SERVER_NAME, T2C_MCP_SERVER_VERSION, T2C_NL_MODE, T2C_OUTPUT_DIR, T2C_PHP, T2C_PYTHON, T2C_REQUIRE_LIVE_CHECK, T2C_ROOT, T2C_TF_LABELS, T2C_TF_MODEL_PATH, T2C_TF_MODULE_PATH, T2C_TYPESCRIPT_CLI, T2C_WORKSPACE;
  runtime_llm: OPENROUTER_API_KEY, OPENROUTER_APP_NAME, OPENROUTER_BASE_URL, OPENROUTER_COMMUNICATION_MODEL, OPENROUTER_DOC_MODEL, OPENROUTER_MARKDOWN_MODEL, OPENROUTER_MAX_TOKENS, OPENROUTER_MODEL, OPENROUTER_NL_MODEL, OPENROUTER_REQUIRE_STRUCTURED_OUTPUT, OPENROUTER_RESPONSE_HEALING, OPENROUTER_SITE_URL, OPENROUTER_SUMMARY_MODEL, OPENROUTER_TASK_MODEL, OPENROUTER_TEMPERATURE, OPENROUTER_TIMEOUT_MS;
}
```

## Interfaces

### testql Scenarios

#### `testql-scenarios/generated-cli-tests.testql.toon.yaml`

```toon markpact:testql path=testql-scenarios/generated-cli-tests.testql.toon.yaml
# SCENARIO: CLI Command Tests
# TYPE: cli
# GENERATED: true

CONFIG[2]{key, value}:
  cli_command, python -m todo2code
  timeout_ms, 10000

# Test 1: CLI help command
SHELL "python -m todo2code --help" 5000
ASSERT_EXIT_CODE 0
ASSERT_STDOUT_CONTAINS "usage"

# Test 2: CLI version command
SHELL "python -m todo2code --version" 5000
ASSERT_EXIT_CODE 0

# Test 3: CLI main workflow (dry-run)
SHELL "python -m todo2code --help" 10000
ASSERT_EXIT_CODE 0
```

## Workflows

## Configuration

```yaml
project:
  name: todo2code
  version: 0.5.1
  env: local
```

## Dependencies

### Runtime (Node.js)

```text markpact:deps node
typescript
```

## Deployment

```bash markpact:run
npm install todo2code
```

### Docker

- **base image**: `node:22-bookworm-slim AS build`
- **expose**: `8787`
- **entrypoint**: `["node", "dist/src/interfaces/a2a.js"]`

### Docker Compose (`docker-compose.yml`)

- **t2c-a2a** image=`todo2code:local` ports: `${T2C_DOCKER_HOST_PORT:-8787}:8787`

## Environment Variables (`.env.example`)

| Variable | Default | Description |
|----------|---------|-------------|
| `T2C_ENV_FILE` | `*(not set)*` | Bootstrap-only override used before this file is loaded. Usually leave empty. |
| `T2C_ROOT` | `.` |  |
| `T2C_OUTPUT_DIR` | `.intent` |  |
| `T2C_GIT_COMMIT_COUNT` | `10` |  |
| `T2C_MAX_FILE_BYTES` | `524288` |  |
| `T2C_DOC_CONCURRENCY` | `3` |  |
| `T2C_DOC_CHUNK_CHARS` | `8000` |  |
| `T2C_DOC_MAX_CHUNKS` | `12` |  |
| `T2C_DOC_MAX_RECORDS_PER_CHUNK` | `24` |  |
| `T2C_DOC_TIMEOUT_MS` | `45000` |  |
| `T2C_PYTHON` | `python3` |  |
| `T2C_ENABLE_PYTHON_AST` | `true` |  |
| `T2C_GO` | `go` |  |
| `T2C_ENABLE_GO_AST` | `true` |  |
| `T2C_JAVA` | `java` |  |
| `T2C_ENABLE_JAVA_AST` | `true` |  |
| `T2C_CARGO` | `cargo` |  |
| `T2C_ENABLE_RUST_AST` | `true` |  |
| `T2C_PHP` | `php` |  |
| `T2C_ENABLE_PHP_AST` | `true` |  |
| `T2C_ALLOW_OUTSIDE_ROOT` | `false` |  |
| `T2C_ENABLE_TF` | `false` | Optional TensorFlow action classifier. Heuristics remain the deterministic fallback. |
| `T2C_TF_MODEL_PATH` | `*(not set)*` |  |
| `T2C_TF_MODULE_PATH` | `adapters/tensorflow/node_modules/@tensorflow/tfjs-node/dist/index.js` |  |
| `T2C_TF_LABELS` | `add,fix,remove,refactor,test,document,configure,analyze,unknown` |  |
| `T2C_NL_MODE` | `require-llm` | NL/TODO/CHANGELOG -> Intent DSL, documentation -> Intent DSL, Intent DSL -> NL/tasks |
| `T2C_MARKDOWN_MODE` | `require-llm` |  |
| `T2C_COMMUNICATION_MODE` | `require-llm` |  |
| `OPENROUTER_API_KEY` | `*(not set)*` |  |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |  |
| `OPENROUTER_MODEL` | `mistralai/codestral-2508` |  |
| `OPENROUTER_NL_MODEL` | `*(not set)*` |  |
| `OPENROUTER_MARKDOWN_MODEL` | `*(not set)*` |  |
| `OPENROUTER_COMMUNICATION_MODEL` | `*(not set)*` |  |
| `OPENROUTER_DOC_MODEL` | `*(not set)*` |  |
| `OPENROUTER_SUMMARY_MODEL` | `*(not set)*` |  |
| `OPENROUTER_TASK_MODEL` | `*(not set)*` |  |
| `OPENROUTER_SITE_URL` | `http://localhost:8787` |  |
| `OPENROUTER_APP_NAME` | `todo2code` |  |
| `OPENROUTER_TIMEOUT_MS` | `120000` |  |
| `OPENROUTER_MAX_TOKENS` | `6000` |  |
| `OPENROUTER_TEMPERATURE` | `0` |  |
| `OPENROUTER_REQUIRE_STRUCTURED_OUTPUT` | `true` |  |
| `OPENROUTER_RESPONSE_HEALING` | `true` |  |
| `T2C_REQUIRE_LIVE_CHECK` | `false` | The check runs all six semantic stages through the pipeline in require-llm. |
| `T2C_LIVE_AUDIT_PATH` | `.intent-live/contract-check.json` |  |
| `T2C_LIVE_HISTORY_PATH` | `.intent-live/contract-check-history.json` | Recorded trend of past runs. Reported, never a pass/fail threshold. |
| `T2C_LIVE_RUN_OUTPUT` | `.intent-live-run` |  |
| `T2C_LIVE_MAX_STAGE_LATENCY_MS` | `300000` | Per-stage ceiling; one slow stage is a signal an average would hide. |
| `T2C_LIVE_MAX_LATENCY_MS` | `120000` | Legacy alias for the per-stage ceiling, still honoured when it is set alone. |
| `T2C_LIVE_MAX_TOTAL_LATENCY_MS` | `900000` |  |
| `T2C_LIVE_MAX_COST_USD` | `0.5` |  |
| `T2C_LIVE_COMPARE_MODELS` | `mistralai/codestral-2508,google/gemini-3-flash-preview` | Opt-in batched TODO/CHANGELOG model comparison. Never part of offline CI. |
| `T2C_LIVE_COMPARE_ROOT` | `.` |  |
| `T2C_LIVE_COMPARE_TIMEOUT_MS` | `300000` |  |
| `T2C_LIVE_COMPARE_PATH` | `.intent-live/model-comparison.json` |  |
| `T2C_LIVE_COMPARE_MD_PATH` | `.intent-live/model-comparison.md` |  |
| `T2C_DOC_PATTERNS` | `README.md,docs/**/*.md,project/**/*.md,packages/**/MODULE.md` | Default document selection. TODO and CHANGELOG have a dedicated structural + LLM stage. |
| `T2C_MARKDOWN_CONCURRENCY` | `3` |  |
| `T2C_DOC_EXCLUDES` | `node_modules/**,.git/**,dist/**,.intent/**,TODO.md,CHANGELOG.md` |  |
| `T2C_MCP_SERVER_NAME` | `todo2code` | MCP stdio server |
| `T2C_MCP_SERVER_VERSION` | `0.5.0` |  |
| `T2C_A2A_HOST` | `127.0.0.1` | token whenever you widen the host. Docker Compose sets 0.0.0.0 itself. |
| `T2C_A2A_PORT` | `8787` |  |
| `T2C_A2A_PUBLIC_URL` | `http://localhost:8787/a2a` |  |
| `T2C_A2A_TOKEN` | `*(not set)*` |  |
| `T2C_A2A_MAX_BODY_BYTES` | `1048576` |  |
| `T2C_A2A_TASK_STORE` | `*(not set)*` | Optional shared snapshot for restart persistence and multi-replica deployments. |
| `T2C_WORKSPACE` | `.` | Docker Compose host settings. Container port remains 8787. |
| `T2C_DOCKER_HOST_PORT` | `8787` |  |
| `T2C_A2A_URL` | `http://localhost:8787` | SDK/example clients. T2C_A2A_TOKEN above is shared with the server. |
| `T2C_EXAMPLE_ROOT` | `examples/backend` |  |
| `T2C_COMPARE_WORKSPACE` | `false` |  |
| `T2C_COMPARE_BASE` | `origin/main` |  |
| `T2C_TYPESCRIPT_CLI` | `*(not set)*` |  |

## Release Management (`goal.yaml`)

- **versioning**: `semver`
- **commits**: `conventional` scope=`todo2code`
- **changelog**: `keep-a-changelog`
- **build strategies**: `python`, `nodejs`, `rust`
- **version files**: `VERSION`, `pyproject.toml:version`, `package.json:version`, `rust-ast/Cargo.toml:version`, `sdk/python/todo2code/__init__.py:__version__`

## Makefile Targets

- `SHELL`
- `help`
- `setup`
- `install`
- `install-tf`
- `build`
- `check`
- `test`
- `verify-no-llm`
- `verify-modules`
- `verify-env`
- `verify`
- `governance`
- `smoke`
- `doctor`
- `mcp-probe`
- `a2a-probe`
- `protocol-smoke`
- `validate`
- `live-contract-check`
- `live-model-comparison`
- `demo`
- `demollm`
- `examples-check`
- `pipeline`
- `compare-workspace`
- `preflight`
- `mcp`
- `a2a`
- `docker-build`
- `docker-smoke`
- `docker-up`
- `docker-down`
- `e2e-core`
- `e2e-full`
- `e2e-clean`
- `python-wheel`
- `package`
- `clean`

## Node.js Scripts (`package.json`)

todo2code (t2c): audited intent and team-communication extraction, evidence graphs, origin-to-workspace comparison and grounded summaries through CLI, MCP and A2A.

- `npm run build` — `tsc -p tsconfig.json`
- `npm run check` — `tsc -p tsconfig.json --noEmit`
- `npm run test` — `node --test --test-concurrency=4 dist/test/*.test.js`
- `npm run verify:no-llm` — `node scripts/verify-no-llm-imports.mjs`
- `npm run verify:modules` — `node scripts/verify-module-boundaries.mjs`
- `npm run verify:env` — `node scripts/verify-env-contract.mjs`
- `npm run verify:workflows` — `node scripts/verify-workflow-yaml.mjs`
- `npm run verify:generated-analysis` — `node scripts/verify-generated-analysis.mjs`
- `npm run verify:schemas` — `node scripts/generate-response-schemas.mjs --check`
- `npm run verify:structured-responses` — `node scripts/verify-structured-responses.mjs`
- `npm run schemas:generate` — `npm run build && node scripts/generate-response-schemas.mjs`
- `npm run verify` — `npm run check && npm run verify:no-llm && npm run verify:modules && npm run verify:env && npm run verify:workflows && npm run verify:generated-analysis && npm run verify:structured-responses && npm run build && npm run verify:schemas && npm test`
- `npm run start` — `node dist/src/cli.js`
- `npm run mcp` — `node dist/src/interfaces/mcp.js`
- `npm run a2a` — `node dist/src/interfaces/a2a.js`
- `npm run diff` — `node dist/src/cli.js diff`
- `npm run demo` — `node dist/src/cli.js pipeline examples --task task.md --todo TODO.md --changelog CHANGELOG.md --docs 'docs/**/*.md' --nl-mode deterministic --markdown-mode deterministic --communication-mode deterministic --no-docs-llm --no-summary-llm --out .intent-demo && node dist/src/cli.js communication examples --project-dir project --ticket DEMO-101 --communication-mode deterministic --out examples/.intent-communication/analysis.json --md examples/.intent-communication/analysis.md --graph examples/.intent-communication/graph.json`
- `npm run examples:check` — `npm run build && bash scripts/examples-check.sh`
- `npm run evaluate:gold` — `npm run build && node dist/src/evaluation/gold-cli.js evaluation/gold/v2/dataset.json --require-perfect`
- `npm run evaluate:gold:v1` — `npm run build && node dist/src/evaluation/gold-cli.js evaluation/gold/v1/dataset.json --require-perfect`
- `npm run live:check` — `npm run build && node scripts/live-contract-check.mjs`
- `npm run live:models` — `npm run build && node scripts/live-model-comparison.mjs`

**Runtime deps**: `typescript`

- **node**: `>=20`

## Code Analysis

### `project/map.toon.yaml`

```toon markpact:analysis path=project/map.toon.yaml
# todo2code | 306f 58934L | md:61,yaml:2,yml:2,json:41,toml:3,shell:9,typescript:133,rust:7,java:1,javascript:17,proto:1,php:4,go:6,txt:1,python:16 | 2026-08-16
# generated in 0.05s
# producer: code2llm | artifact: map.toon.yaml | schema: 1
# stats: 4221 func | 0 cls | 306 mod | CC̄=3.8 | critical:128 | cycles:0
# alerts[5]: CC WorkspacePreflightError.validateBaselineOption=116; CC validateRef=110; CC main=96; CC assertOperationPlan=84; CC executeAction=83
# hotspots[5]: WorkspacePreflightError.validateBaselineOption fan=70; executeAction fan=65; root fan=64; validateRef fan=61; compareWorkspaceIntent fan=48
# evolution: CC̄ 4.0→3.8 (improved -0.2)
# Keys: M=modules, D=details, i=imports, e=exports, c=classes, f=functions, m=methods
M[306]:
  AGENTS.md,48
  CHANGELOG.md,733
  CONTRIBUTION.md,37
  Dockerfile,45
  Makefile,147
  README.md,927
  TASK.md,10
  TODO.md,551
  adapters/tensorflow/package.json,14
  compose.e2e.yml,27
  docker-compose.yml,18
  docs/ARCHITECTURE.md,200
  docs/CLI_GUIDE.md,328
  docs/CODE_CHANGE_PLANS.md,173
  docs/DEMOLLM.md,175
  docs/DSL.md,457
  docs/E2E.md,52
  docs/EVENT_LOG_DSL.md,300
  docs/GROK-PLAN.md,269
  docs/OPTIMIZATION.md,249
  docs/PIPELINE_DSL_NL.md,464
  docs/PROJECT_STATUS.md,177
  docs/PROTOCOLS.md,124
  docs/READINESS.md,442
  docs/README.md,3919
  docs/REQUIREMENTS.md,39
  docs/SECURITY.md,50
  docs/SUBACTOR_OPERATION_DSL.md,33
  docs/SYSTEM_MONITOROWANIA_INTENCJI_I_PRACY_AGENTOW.md,872
  docs/TEAM_COMMUNICATION.md,268
  docs/TEST_REPORT.md,587
  docs/VALIDATION.md,198
  docs/intent-guard-diagrams/ALL_DIAGRAMS.md,410
  docs/intent-guard-diagrams/README.md,22
  docs/reference/original-monitoring-design.md,872
  dsl-manifest.json,152
  evaluation/gold/README.md,87
  evaluation/gold/v1/dataset.json,761
  evaluation/gold/v2/dataset.json,2410
  examples/CHANGELOG.md,11
  examples/TODO.md,7
  examples/backend/CHANGELOG.md,11
  examples/backend/README.md,46
  examples/backend/TODO.md,8
  examples/backend/src/server.ts,99
  examples/backend/src/store.ts,48
  examples/backend/src/validation.ts,31
  examples/backend/task.md,18
  examples/backend/tsconfig.json,14
  examples/docs/ARCHITECTURE.md,9
  examples/frontend/CHANGELOG.md,11
  examples/frontend/README.md,35
  examples/frontend/TODO.md,7
  examples/frontend/src/api.ts,50
  examples/frontend/src/app.ts,43
  examples/frontend/src/render.ts,64
  examples/frontend/task.md,17
  examples/frontend/tsconfig.json,15
  examples/project/DEMO-101/agent.codex.plan.001.md,11
  examples/project/DEMO-101/agent.codex.report.002.md,10
  examples/project/DEMO-101/agent.rogue.plan.001.md,8
  examples/project/DEMO-101/human.product-owner.request.001.md,10
  examples/project/DEMO-101/human.security.decision.001.md,10
  examples/project/participants.json,37
  examples/sdk/python.py,23
  examples/sdk/typescript.mjs,16
  examples/src/helper.py,9
  examples/src/runtime.ts,13
  examples/task.md,9
  goal.yaml,531
  golang/ast_extract.go,368
  java/JavaAstExtract.java,260
  nlp2uri.yaml,8
  package.json,52
  php/ast_extract.php,233
  project.sh,38
  project2.sh,55
  prompts/communication-to-intent.system.md,7
  prompts/docs-to-intent.system.md,23
  prompts/markdown-to-intent.system.md,5
  prompts/nl-to-intent.system.md,15
  prompts/summarize.system.md,51
  prompts/tasks-from-dsl.system.md,52
  pyproject.toml,18
  python/ast_extract.py,221
  python/requirements.txt,1
  rust-ast/Cargo.toml,12
  rust-ast/src/main.rs,322
  schemas/code-change-acceptance.schema.json,53
  schemas/code-change-close-result.schema.json,26
  schemas/code-change-plan-set.schema.json,22
  schemas/code-change-plan.schema.json,98
  schemas/code-change-review.schema.json,27
  schemas/code-change-source-apply-receipt.schema.json,31
  schemas/code-change-source-patch-set.schema.json,18
  schemas/code-change-source-patch.schema.json,63
  schemas/conclusion.schema.json,51
  schemas/document-extraction-response.schema.json,186
  schemas/gold-dataset.schema.json,585
  schemas/intent-graph-diff.schema.json,80
  schemas/intent-graph.schema.json,40
  schemas/intent-record.schema.json,132
  schemas/operation-plan.schema.json,94
  schemas/participant-registry.schema.json,27
  schemas/participant-synthesis.schema.json,39
  schemas/semantic-candidate-set.schema.json,54
  schemas/semantic-rerank.schema.json,113
  schemas/todo-patch.schema.json,59
  schemas/todo-proposal.schema.json,61
  schemas/variable-contract.schema.json,38
  scripts/a2a-request.sh,23
  scripts/assert-demollm-run.mjs,45
  scripts/docker-smoke.sh,36
  scripts/e2e.sh,109
  scripts/examples-check.sh,210
  scripts/generate-response-schemas.mjs,27
  scripts/github-event-log.mjs,577
  scripts/live-contract-check.mjs,200
  scripts/live-model-comparison.mjs,125
  scripts/mcp-request.sh,11
  scripts/normalize-generated-analysis-roots.mjs,38
  scripts/package.py,25
  scripts/research/README.md,27
  scripts/research/audit-changelog-sample.mjs,226
  scripts/research/evaluate-embedding-pairs.py,101
  scripts/research/rank-intent-graph-embeddings.py,174
  scripts/research/rerank-embedding-shortlist.mjs,191
  scripts/runtime.sh,858
  scripts/smoke.sh,57
  scripts/sync-generated-readme-metadata.mjs,66
  scripts/vallm-compatible.py,25
  scripts/verify-env-contract.mjs,103
  scripts/verify-generated-analysis.mjs,88
  scripts/verify-module-boundaries.mjs,87
  scripts/verify-no-llm-imports.mjs,78
  scripts/verify-structured-responses.mjs,35
  scripts/verify-workflow-yaml.mjs,43
  scripts/workspace-preflight.mjs,84
  sdk/__init__.py,1
  sdk/README.md,107
  sdk/go/README.md,20
  sdk/go/actions.go,136
  sdk/go/client.go,197
  sdk/go/examples/basic/main.go,163
  sdk/go/todo2code.go,30
  sdk/go/types.go,215
  sdk/php/README.md,21
  sdk/php/composer.json,18
  sdk/php/examples/basic.php,112
  sdk/php/src/Client.php,401
  sdk/php/src/Error.php,25
  sdk/python/__init__.py,13
  sdk/python/README.md,80
  sdk/python/examples/basic.py,95
  sdk/python/examples/local_runtime.py,36
  sdk/python/todo2code/__init__.py,33
  sdk/python/todo2code/client.py,469
  sdk/python/todo2code/runtime.py,225
  sdk/python/todo2code_sdk.py,171
  sdk/rust/Cargo.toml,17
  sdk/rust/README.md,24
  sdk/rust/examples/basic.rs,108
  sdk/rust/src/lib.rs,49
  sdk/rust/src/actions.rs,100
  sdk/rust/src/client.rs,221
  sdk/rust/src/error.rs,37
  sdk/rust/src/types.rs,140
  sdk/typescript/README.md,23
  sdk/typescript/examples/basic.ts,84
  sdk/typescript/package.json,32
  sdk/typescript/src/index.ts,420
  sdk/typescript/tsconfig.json,20
  src/index.ts,53
  src/cli.ts,874
  src/communication/analyzer.ts,542
  src/communication/identity.ts,146
  src/communication/intake-contract.ts,273
  src/communication/intake-protobuf.ts,125
  src/communication/intake-service.ts,291
  src/communication/intake-store.ts,161
  src/communication/llm.ts,514
  src/comparison/workspace.ts,485
  src/config/env.ts,232
  src/core/branch-portfolio.ts,499
  src/core/content-cache.ts,139
  src/core/grounding.ts,24
  src/core/id.ts,167
  src/core/ignore.ts,200
  src/core/io.ts,177
  src/core/record.ts,172
  src/core/schema.ts,922
  src/core/security.ts,55
  src/core/target.ts,57
  src/core/text.ts,491
  src/core/truth-map.ts,467
  src/core/types.ts,676
  src/core/version.ts,2
  src/diff/git.ts,161
  src/diff/reality.ts,619
  src/diff/svg.ts,104
  src/diff/text.ts,239
  src/diff/text-render.ts,251
  src/diff/text-types.ts,39
  src/evaluation/analysis-policy.ts,437
  src/evaluation/gold.ts,329
  src/evaluation/gold-cases.ts,366
  src/evaluation/gold-cli.ts,44
  src/evaluation/gold-extraction.ts,127
  src/evaluation/gold-metrics.ts,50
  src/evaluation/gold-types.ts,378
  src/extractors/ast.ts,193
  src/extractors/ast/external.ts,48
  src/extractors/ast/go.ts,20
  src/extractors/ast/java.ts,20
  src/extractors/ast/php.ts,34
  src/extractors/ast/python.ts,39
  src/extractors/ast/records.ts,97
  src/extractors/ast/rust.ts,20
  src/extractors/ast/types.ts,20
  src/extractors/ast/typescript.ts,166
  src/extractors/ast/unsupported.ts,30
  src/extractors/changelog.ts,99
  src/extractors/communication.ts,685
  src/extractors/configuration.ts,231
  src/extractors/docs-chunks.ts,147
  src/extractors/docs-deterministic.ts,364
  src/extractors/docs-llm.ts,269
  src/extractors/docs-record.ts,193
  src/extractors/docs-schema.ts,43
  src/extractors/docs-types.ts,68
  src/extractors/git.ts,180
  src/extractors/markdown.ts,35
  src/extractors/markdown-block.ts,67
  src/extractors/markdown-llm.ts,458
  src/extractors/markdown-paths.ts,122
  src/extractors/nl.ts,107
  src/extractors/nl-llm.ts,316
  src/extractors/runtime-cycle.ts,306
  src/extractors/todo.ts,93
  src/graph/capability-evidence.ts,62
  src/graph/changelog-signal.ts,89
  src/graph/diagnostics.ts,361
  src/graph/diff.ts,235
  src/graph/linker.ts,489
  src/graph/symbol-resolution.ts,120
  src/interfaces/a2a.ts,332
  src/interfaces/a2a-card.ts,181
  src/interfaces/a2a-history.ts,226
  src/interfaces/a2a-message.ts,197
  src/interfaces/a2a-task-store.ts,560
  src/interfaces/a2a-types.ts,164
  src/interfaces/governed-intake.proto,78
  src/interfaces/intake-actions.ts,38
  src/interfaces/intake-schemas/command-v1.schema.json,17
  src/interfaces/intake-schemas/diagnostic-v1.schema.json,11
  src/interfaces/intake-schemas/envelope-v1.schema.json,20
  src/interfaces/intake-schemas/event-v1.schema.json,20
  src/interfaces/intake-schemas/participant-registry-v2.schema.json,36
  src/interfaces/intake-schemas/query-v1.schema.json,11
  src/interfaces/intake-schemas/result-v1.schema.json,9
  src/interfaces/intake_cli.py,156
  src/interfaces/mcp.ts,261
  src/interfaces/mcp-errors.ts,10
  src/interfaces/mcp-resources.ts,88
  src/interfaces/mcp-tools.ts,323
  src/live/contract-check.ts,317
  src/live/model-comparison.ts,218
  src/llm/audit.ts,64
  src/llm/failure.ts,25
  src/llm/openrouter.ts,561
  src/llm/openrouter-timeout.ts,135
  src/llm/structured-schema.ts,218
  src/llm/subllm.ts,259
  src/operations/artifact.ts,66
  src/operations/compile-cli.ts,34
  src/operations/contract.ts,84
  src/operations/subactor.ts,122
  src/operations/types.ts,155
  src/operations/validation.ts,281
  src/pipeline/event-log.ts,415
  src/pipeline/event-log-persistence.ts,190
  src/pipeline/run.ts,795
  src/sdk/typescript.ts,172
  src/semantic/reranker.ts,509
  src/semantic/reranker-llm.ts,210
  src/semantic/reranker-response.ts,42
  src/services/actions.ts,700
  src/services/branch-portfolio-assembler.ts,357
  src/services/branch-snapshot.ts,583
  src/services/workspace-preflight.ts,498
  src/summary/payload.ts,65
  src/summary/render.ts,61
  src/summary/summarizer.ts,333
  src/synthesis/code-change-path.ts,204
  src/synthesis/code-change-plan.ts,1310
  src/synthesis/task-synthesis-contract.ts,66
  src/synthesis/task-synthesis-materialize.ts,172
  src/synthesis/task-synthesis-payload.ts,70
  src/synthesis/tasks-llm.ts,266
  src/synthesis/todo-patch.ts,372
  src/synthesis/validation.ts,113
  src/tf/classifier.ts,96
  src/version.ts,2
  src/watch/watcher.ts,243
  src/web/diff-ui.ts,48
  tsconfig.json,23
D:
  src/services/workspace-preflight.ts:
    i: ../core/id.js,node:child_process,node:fs,node:os,node:path
    e: WorkspacePreflightOptions,WorkspaceDirtyEntry,WorkspaceDiagnostic,WorkspaceGovernanceReport,WorkspacePreflightReport,CommandResult,GovernanceResult,GovernanceInvocation,WorkspaceDiagnosticFacts,WorkspacePreflightError,GovernanceArguments,GovernanceExecution,MAX_OUTPUT,MAX_DIRTY_PATHS,MAX_CHANGED_ARGUMENT_BYTES
    WorkspacePreflightOptions:
    WorkspaceDirtyEntry:
    WorkspaceDiagnostic:
    WorkspaceGovernanceReport:
    WorkspacePreflightReport:
    CommandResult:
    GovernanceResult:
    GovernanceInvocation:
    WorkspaceDiagnosticFacts:
    WorkspacePreflightError: super(-1),inspectWorkspace(-1),validateOptions(-1),root(-1),baselineSha(-1),headSha(-1),branch(-1),dirtyEntries(-1),changedPaths(-1),governance(-1),diagnostics(-1),safeActions(-1),validateOptions(-1),validateRootOption(-1),validateBaselineOption(-1),validateBranchOption(-1),validateRuntimeOptions(-1),validateRootOption(-1),validateBaselineOption(-1),invalidRef(-1),validateBranchOption(-1),validateRuntimeOptions(-1),repositoryRoot(-1),result(-1),discovered(-1),resolveBaseline(-1),symbolic(-1),requiredSha(-1),result(-1),value(-1),currentBranch(-1),result(-1),aheadBehind(-1),result(-1),behindBy(-1),aheadBy(-1),parsePorcelainV2(-1),records(-1),record(-1),tag(-1),original(-1),splitFixed(-1),remainder(-1),separator(-1),status(-1),pair(-1),entry(-1),safePath(-1),normalized(-1),governanceChangedPaths(-1),committed(-1),paths(-1),runGovernance(-1),checker(-1),temporary(-1),ticketOutput(-1),report(-1),requiredGovernanceChecker(-1),checker(-1),governanceArguments(-1),executeGovernance(-1),result(-1),report(-1),parseGovernanceReport(-1),readActiveTicket(-1),digestEvidence(-1),validateGovernanceReport(-1),schema(-1),runtimeVersion(-1),status(-1),summary(-1),findings(-1),requiredGovernanceString(-1),governanceStatus(-1),governanceSummary(-1),governanceFindings(-1),governanceContractViolation(-1),buildDiagnostics(-1),actionsFor(-1),codes(-1),actions(-1),isObject(-1),isCount(-1),requiredGit(-1),result(-1),runGit(-1),run(-1),run(-1),child(-1),size(-1),overflowed(-1),reject(-1),resolve(-1)
    GovernanceArguments:
    GovernanceExecution:
    MAX_OUTPUT()
    MAX_DIRTY_PATHS()
    MAX_CHANGED_ARGUMENT_BYTES()
  src/services/branch-snapshot.ts:
    i: ../core/id.js,node:child_process,node:fs,node:os,node:path
    e: BranchGitSnapshotOptions,BranchGitBaseSnapshot,BranchGitCandidateSnapshot,BranchGitInteractionSnapshot,BranchGitMaterialization,BranchSnapshotHooks,RefSnapshot,GitCommandOptions,GitCommandResult,MAX_CANDIDATES,MAX_CHANGED_PATHS,MAX_GIT_OUTPUT,assertBranchGitMaterialization,materialization,candidates,materializeBranchGitSnapshot,root,captured,base,temporaryRoot,mergeEnvironment,inspect,interactions,result,validateOptions,validateSnapshotIdentity,validateCandidateRefs,seen,validateRef,invalid,repositoryRoot,inside,result,captureRef,symbolic,resolved,treeSha,captureCandidate,mergeBaseSha,counts,changedPaths,captureInteractions,left,right,textualMerge,readChangedPaths,output,values,stablePatchId,diff,result,patchId,isolatedObjectEnvironment,gitCommonDir,commonDirectory,sourceObjects,temporaryObjects,inspectTextualMerge,result,classifyMergeTreeResult,assertRefsUnchanged,fingerprintMaterialization,validateMaterializationIdentity,base,validateMaterializationCandidates,candidates,validateMaterializationCandidate,value,validateMaterializedPaths,validateMaterializationInteractions,expected,value,materializationPairKeys,materializationObject,requireMaterializationKeys,requireMaterializationSha,requireMaterializationCount,requireMaterializationMerge,requiredSnapshot,value,parseCounts,parts,left,right,pathsOverlap,rightPaths,startsWithSha,requireSha,requiredGit,result,requiredGitBuffer,result,gitFailure,detail,runGit,child,maxBuffer,bytes,overflow,collect,stdoutBuffer
    BranchGitSnapshotOptions:
    BranchGitBaseSnapshot:
    BranchGitCandidateSnapshot:
    BranchGitInteractionSnapshot:
    BranchGitMaterialization:
    BranchSnapshotHooks:
    RefSnapshot:
    GitCommandOptions:
    GitCommandResult:
    MAX_CANDIDATES()
    MAX_CHANGED_PATHS()
    MAX_GIT_OUTPUT()
    assertBranchGitMaterialization()
    materialization()
    candidates()
    materializeBranchGitSnapshot()
    root()
    captured()
    base()
    temporaryRoot()
    mergeEnvironment()
    inspect()
    interactions()
    result()
    validateOptions()
    validateSnapshotIdentity()
    validateCandidateRefs()
    seen()
    validateRef()
    invalid()
    repositoryRoot()
    inside()
    result()
    captureRef()
    symbolic()
    resolved()
    treeSha()
    captureCandidate()
    mergeBaseSha()
    counts()
    changedPaths()
    captureInteractions()
    left()
    right()
    textualMerge()
    readChangedPaths()
    output()
    values()
    stablePatchId()
    diff()
    result()
    patchId()
    isolatedObjectEnvironment()
    gitCommonDir()
    commonDirectory()
    sourceObjects()
    temporaryObjects()
    inspectTextualMerge()
    result()
    classifyMergeTreeResult()
    assertRefsUnchanged()
    fingerprintMaterialization()
    validateMaterializationIdentity()
    base()
    validateMaterializationCandidates()
    candidates()
    validateMaterializationCandidate()
    value()
    validateMaterializedPaths()
    validateMaterializationInteractions()
    expected()
    value()
    materializationPairKeys()
    materializationObject()
    requireMaterializationKeys()
    requireMaterializationSha()
    requireMaterializationCount()
    requireMaterializationMerge()
    requiredSnapshot()
    value()
    parseCounts()
    parts()
    left()
    right()
    pathsOverlap()
    rightPaths()
    startsWithSha()
    requireSha()
    requiredGit()
    result()
    requiredGitBuffer()
    result()
    gitFailure()
    detail()
    runGit()
    child()
    maxBuffer()
    bytes()
    overflow()
    collect()
    stdoutBuffer()
  src/cli.ts:
    i: ./communication/analyzer.js,./communication/llm.js,./comparison/workspace.js,./config/env.js,./core/io.js,./core/types.js,./diff/git.js,./diff/reality.js,./extractors/ast.js,./extractors/configuration.js,./extractors/docs-llm.js,./extractors/git.js,./extractors/markdown-llm.js,./extractors/nl-llm.js,./extractors/runtime-cycle.js,./graph/diagnostics.js,./graph/diff.js,./graph/linker.js,./interfaces/a2a.js,./interfaces/intake-actions.js,./interfaces/mcp.js,./pipeline/run.js,./services/actions.js,./summary/summarizer.js,./version.js,./watch/watcher.js,node:child_process,node:fs,node:path,node:url,node:util
    e: ParsedArgs,execFileAsync,main,parsed,command,config,files,records,graph,graphFile,graph,graphFile,graph,diagnosticsPath,diagnostics,result,out,graphPath,diagnosticsPath,output,result,synthesisPath,graphPath,diagnosticsPath,patch,audit,result,patch,audit,receipt,actor,approvalHash,result,graphPath,diagnosticsPath,output,result,plansPath,patch,audit,result,inputPath,output,isPlanSet,result,patchPath,actor,approvalHash,receipt,result,planPath,beforeGraphPath,afterGraphPath,output,result,inputPath,beforeGraphPath,afterGraphPath,output,result,root,result,root,result,handleWatch,root,taskFile,controller,stop,formatWatchEvent,stamp,handleDiff,mode,out,svg,html,beforeFile,afterFile,diff,context,maxRows,beforeFile,afterFile,root,result,handleReality,graphFile,graph,diagnosticsPath,diagnostics,view,out,svg,markdown,handleExtract,extractor,root,out,file,inline,result,result,result,result,cycle,result,result,result,result,handleCommunication,root,graph,analysis,out,markdown,graphOut,emitExtraction,emitJson,handleIntake,operation,inputPath,absolute,result,intakeExitCode,initProject,moduleRoot,sourceEnv,targetEnv,task,sourceIgnore,targetIgnore,doctor,result,parseArgs,options,value,next,name,next,optionString,value,optionNullableString,value,optionBoolean,value,optionNumber,value,number,optionList,value,optionNlMode,optionLlmMode,value,optionTaskMode,value,optionSummaryMode,optionPipelineTaskMode,value,reportPipelineDegradation,printHelp,invokedPath
    ParsedArgs:
    execFileAsync()
    main()
    parsed()
    command()
    config()
    files()
    records()
    graph()
    graphFile()
    graph()
    graphFile()
    graph()
    diagnosticsPath()
    diagnostics()
    result()
    out()
    graphPath()
    diagnosticsPath()
    output()
    result()
    synthesisPath()
    graphPath()
    diagnosticsPath()
    patch()
    audit()
    result()
    patch()
    audit()
    receipt()
    actor()
    approvalHash()
    result()
    graphPath()
    diagnosticsPath()
    output()
    result()
    plansPath()
    patch()
    audit()
    result()
    inputPath()
    output()
    isPlanSet()
    result()
    patchPath()
    actor()
    approvalHash()
    receipt()
    result()
    planPath()
    beforeGraphPath()
    afterGraphPath()
    output()
    result()
    inputPath()
    beforeGraphPath()
    afterGraphPath()
    output()
    result()
    root()
    result()
    root()
    result()
    handleWatch()
    root()
    taskFile()
    controller()
    stop()
    formatWatchEvent()
    stamp()
    handleDiff()
    mode()
    out()
    svg()
    html()
    beforeFile()
    afterFile()
    diff()
    context()
    maxRows()
    beforeFile()
    afterFile()
    root()
    result()
    handleReality()
    graphFile()
    graph()
    diagnosticsPath()
    diagnostics()
    view()
    out()
    svg()
    markdown()
    handleExtract()
    extractor()
    root()
    out()
    file()
    inline()
    result()
    result()
    result()
    result()
    cycle()
    result()
    result()
    result()
    result()
    handleCommunication()
    root()
    graph()
    analysis()
    out()
    markdown()
    graphOut()
    emitExtraction()
    emitJson()
    handleIntake()
    operation()
    inputPath()
    absolute()
    result()
    intakeExitCode()
    initProject()
    moduleRoot()
    sourceEnv()
    targetEnv()
    task()
    sourceIgnore()
    targetIgnore()
    doctor()
    result()
    parseArgs()
    options()
    value()
    next()
    name()
    next()
    optionString()
    value()
    optionNullableString()
    value()
    optionBoolean()
    value()
    optionNumber()
    value()
    number()
    optionList()
    value()
    optionNlMode()
    optionLlmMode()
    value()
    optionTaskMode()
    value()
    optionSummaryMode()
    optionPipelineTaskMode()
    value()
    reportPipelineDegradation()
    printHelp()
    invokedPath()
  src/operations/validation.ts:
    i: ../core/id.js,../core/types.js,./types.js
    e: VALUE_TYPES,CLASSIFICATIONS,SOURCE_KINDS,RISK_CLASSES,objectValue,exactKeys,actual,nonBlank,dateString,uniqueStrings,assertPrincipalList,principals,isJsonValue,assertVariableContract,contract,source,access,readers,writers,assertGeneration,generation,assertAcyclic,ids,visiting,visited,byId,visit,assertOperationPlan,plan,evidence,variables,variableById,steps,stepIds,founderDecisionRequired,step,parameters,reference,variable,rollback,coveredSteps,expectationIds,expectation,verifiedBy,decision,verification,expectedHash
    VALUE_TYPES()
    CLASSIFICATIONS()
    SOURCE_KINDS()
    RISK_CLASSES()
    objectValue()
    exactKeys()
    actual()
    nonBlank()
    dateString()
    uniqueStrings()
    assertPrincipalList()
    principals()
    isJsonValue()
    assertVariableContract()
    contract()
    source()
    access()
    readers()
    writers()
    assertGeneration()
    generation()
    assertAcyclic()
    ids()
    visiting()
    visited()
    byId()
    visit()
    assertOperationPlan()
    plan()
    evidence()
    variables()
    variableById()
    steps()
    stepIds()
    founderDecisionRequired()
    step()
    parameters()
    reference()
    variable()
    rollback()
    coveredSteps()
    expectationIds()
    expectation()
    verifiedBy()
    decision()
    verification()
    expectedHash()
  src/services/actions.ts:
    i: ../communication/analyzer.js,../communication/llm.js,../comparison/workspace.js,../config/env.js,../core/io.js,../core/security.js,../core/types.js,../core/types.js,../diff/git.js,../diff/reality.js,../extractors/ast.js,../extractors/configuration.js,../extractors/docs-llm.js,../extractors/git.js,../extractors/markdown-llm.js,../extractors/nl-llm.js,../graph/diagnostics.js,../graph/diff.js,../graph/linker.js,../pipeline/run.js,../summary/summarizer.js,../synthesis/tasks-llm.js,../synthesis/todo-patch.js,node:path
    e: executeAction,root,file,text,analysis,records,graph,graph,diagnostics,graph,diagnostics,result,output,graph,diagnostics,synthesis,todoPath,patchPath,auditPath,todoContent,rendered,todoPath,patchPath,auditPath,receiptPath,result,graph,diagnostics,conclusions,proposals,result,output,planSet,review,patchPath,auditPath,plan,unifiedDiffs,patch,output,planSet,result,output,patch,receiptPath,result,plan,beforeGraph,beforeDiagnostics,afterGraph,afterDiagnostics,result,output,beforeGraph,beforeDiagnostics,afterGraph,afterDiagnostics,value,planSet,result,output,beforeInput,afterInput,before,after,diff,svg,beforePath,afterPath,diff,result,graph,diagnostics,view,filterCommunicationGraph,participant,role,ticket,communicationOnly,records,isCommunication,nlModeValue,llmModeValue,taskSynthesisMode,summaryModeValue,pipelineTaskMode,withTextDiffViews,title,readGraphInput,safePath,readActionObject,safePath,resolveRoot,requested,scopedPath,selected,nullableScopedPath,selected,readRecords,files,safeFile,stringValue,nullableString,stringList,numberValue,number,hasInputValue,objectMapOfStrings,booleanValue,objectValue,registerRunArtifacts,manifestPath,manifest
    executeAction()
    root()
    file()
    text()
    analysis()
    records()
    graph()
    graph()
    diagnostics()
    graph()
    diagnostics()
    result()
    output()
    graph()
    diagnostics()
    synthesis()
    todoPath()
    patchPath()
    auditPath()
    todoContent()
    rendered()
    todoPath()
    patchPath()
    auditPath()
    receiptPath()
    result()
    graph()
    diagnostics()
    conclusions()
    proposals()
    result()
    output()
    planSet()
    review()
    patchPath()
    auditPath()
    plan()
    unifiedDiffs()
    patch()
    output()
    planSet()
    result()
    output()
    patch()
    receiptPath()
    result()
    plan()
    beforeGraph()
    beforeDiagnostics()
    afterGraph()
    afterDiagnostics()
    result()
    output()
    beforeGraph()
    beforeDiagnostics()
    afterGraph()
    afterDiagnostics()
    value()
    planSet()
    result()
    output()
    beforeInput()
    afterInput()
    before()
    after()
    diff()
    svg()
    beforePath()
    afterPath()
    diff()
    result()
    graph()
    diagnostics()
    view()
    filterCommunicationGraph()
    participant()
    role()
    ticket()
    communicationOnly()
    records()
    isCommunication()
    nlModeValue()
    llmModeValue()
    taskSynthesisMode()
    summaryModeValue()
    pipelineTaskMode()
    withTextDiffViews()
    title()
    readGraphInput()
    safePath()
    readActionObject()
    safePath()
    resolveRoot()
    requested()
    scopedPath()
    selected()
    nullableScopedPath()
    selected()
    readRecords()
    files()
    safeFile()
    stringValue()
    nullableString()
    stringList()
    numberValue()
    number()
    hasInputValue()
    objectMapOfStrings()
    booleanValue()
    objectValue()
    registerRunArtifacts()
    manifestPath()
    manifest()
  src/interfaces/a2a-message.ts:
    i: ../communication/intake-protobuf.js
    e: parseSendConfiguration,validateOutputModes,supported,parseCommand,protobuf,bytes,objectData,text,first,commandFromData,action,nested,parseKeyValues,key,raw,stringValue,parseScalar,parseMessage,messageId,contextId,taskId,referenceTaskIds,extensions,metadata,parsePart,output,parsePartContent,content,qualifier,ensureSupportedMessageContent,supported,normalizeAction,normalized,action,cloneMessage,clonePart,normalizeUserMessage
    parseSendConfiguration()
    validateOutputModes()
    supported()
    parseCommand()
    protobuf()
    bytes()
    objectData()
    text()
    first()
    commandFromData()
    action()
    nested()
    parseKeyValues()
    key()
    raw()
    stringValue()
    parseScalar()
    parseMessage()
    messageId()
    contextId()
    taskId()
    referenceTaskIds()
    extensions()
    metadata()
    parsePart()
    output()
    parsePartContent()
    content()
    qualifier()
    ensureSupportedMessageContent()
    supported()
    normalizeAction()
    normalized()
    action()
    cloneMessage()
    clonePart()
    normalizeUserMessage()
  src/web/diff-ui.ts:
    e: diffUiHtml,byId,requestHeaders,formatBytes,selectedRun,updateMeta,fillSelect,loadRuns,compareGraphs
    diffUiHtml()
    byId()
    requestHeaders()
    formatBytes()
    selectedRun()
    updateMeta()
    fillSelect()
    loadRuns()
    compareGraphs()
  src/communication/analyzer.ts:
    i: ../core/id.js,../core/schema.js,../core/text.js,../core/types.js,../extractors/communication.js,./llm.js
    e: CommunicationIssue,ParticipantCommunicationAnalysis,CommunicationAnalysis,analyzeCommunication,communication,evidenceByRecord,participants,participant,values,left,right,leftRole,rightRole,code,responseRequiredFrom,humanRequests,agentMessages,response,type,participantGit,linked,matchedRequest,aliases,matchedGit,evidence,validateSyntheses,byId,ids,record,renderCommunicationMarkdown,addCommunicationIssuesToDiagnostics,hasSerious,communicationIssueTitle,evidenceNeighbors,records,output,left,right,isEvidenceRecord,matchedGitRecords,aliases,semanticMatch,conflictSemanticMatch,leftHasExplicitTarget,rightHasExplicitTarget,agentResponseCoversRequest,candidates,bySource,values,aggregateTopicMatch,requested,response,shared,agentWorkCoveredByHumanScope,requests,sourceRecords,plans,agentSourceRecords,isBroadRequest,isActionableAgentWork,isPositiveImplementationClaim,isHumanDecisionClaim,hasImplementationVerb,withoutTickets,value,intersects,values,participantOf,participantsForRole,roleOf,typeOf,ticketOf,gitAliases,normalizeIdentity,append,values,issue,sortedRespondents,explicitResponseRoute,severityRank,escapeCell,escapeRegex
    CommunicationIssue:
    ParticipantCommunicationAnalysis:
    CommunicationAnalysis:
    analyzeCommunication()
    communication()
    evidenceByRecord()
    participants()
    participant()
    values()
    left()
    right()
    leftRole()
    rightRole()
    code()
    responseRequiredFrom()
    humanRequests()
    agentMessages()
    response()
    type()
    participantGit()
    linked()
    matchedRequest()
    aliases()
    matchedGit()
    evidence()
    validateSyntheses()
    byId()
    ids()
    record()
    renderCommunicationMarkdown()
    addCommunicationIssuesToDiagnostics()
    hasSerious()
    communicationIssueTitle()
    evidenceNeighbors()
    records()
    output()
    left()
    right()
    isEvidenceRecord()
    matchedGitRecords()
    aliases()
    semanticMatch()
    conflictSemanticMatch()
    leftHasExplicitTarget()
    rightHasExplicitTarget()
    agentResponseCoversRequest()
    candidates()
    bySource()
    values()
    aggregateTopicMatch()
    requested()
    response()
    shared()
    agentWorkCoveredByHumanScope()
    requests()
    sourceRecords()
    plans()
    agentSourceRecords()
    isBroadRequest()
    isActionableAgentWork()
    isPositiveImplementationClaim()
    isHumanDecisionClaim()
    hasImplementationVerb()
    withoutTickets()
    value()
    intersects()
    values()
    participantOf()
    participantsForRole()
    roleOf()
    typeOf()
    ticketOf()
    gitAliases()
    normalizeIdentity()
    append()
    values()
    issue()
    sortedRespondents()
    explicitResponseRoute()
    severityRank()
    escapeCell()
    escapeRegex()
  src/synthesis/code-change-plan.ts:
    i: ../core/io.js,../core/security.js,../core/target.js,../graph/diagnostics.js,../version.js,./code-change-path.js,node:crypto,node:fs,node:path
    e: ProposeCodeChangePlansOptions,ProposeCodeChangePlansResult,EvaluateCodeChangeAcceptanceOptions,CloseCodeChangesOptions,CreateCodeChangeReviewOptions,CreatedCodeChangeReview,CreateCodeChangeSourcePatchOptions,ApplyCodeChangeSourcePatchOptions,ApplyCodeChangeSourcePatchResult,PreparedSourceEdit,IMPLEMENTATION_DIAGNOSTIC_CODES,proposeCodeChangePlans,generatedAt,maxPlans,conclusions,proposals,recordsById,proposalsByDiagnostic,conclusionsByDiagnostic,candidates,relatedRecords,matchingProposals,matchingConclusions,target,changes,generation,planHash,createRepositoryPathProbe,base,absolute,implementationDiagnosticRank,evaluateCodeChangeAcceptance,afterDiagnostics,beforeIds,afterById,targeted,clearedDiagnosticIds,remainingDiagnosticIds,newBlockingDiagnosticIds,accepted,evaluatedAt,closeCodeChanges,evaluatedAt,afterDiagnostics,planIds,acceptances,acceptedCount,indexProposalsByDiagnostic,index,list,indexConclusionsByDiagnostic,index,list,collectTarget,paths,symbols,tickets,versions,buildChanges,symbols,sourceIntents,rationale,normalized,exists,titleFor,record,object,startsWithImperative,descriptionFor,acceptanceCriteriaFor,priorityFor,confidenceFor,riskFor,level,rollbackFor,deterministicGeneration,uniqueSorted,createCodeChangeReviewPatch,createdAt,markdown,renderCodeChangeReviewMarkdown,symbols,assertCodeChangeReviewPatch,artifact,generation,priorityRank,inline,renderIds,createCodeChangeSourcePatch,plan,graphFingerprint,createdAt,allowed,diffs,normalized,path,rawDiff,unifiedDiff,patchHash,createCodeChangeSourcePatchSet,generatedAt,assertCodeChangeSourcePatch,patch,paths,path,expectedHash,allowed,expectedChanges,editPath,assertCodeChangeSourcePatchSet,set,plansById,patchIds,exactSourcePatchKeys,actual,assertSourcePatchIds,assertSourcePatchStrings,exactSourcePatchSet,instructionFor,symbols,criteria,normalizeUnifiedDiff,normalized,path,bare,stripped,applyCodeChangeSourcePatch,root,receiptPath,existing,relative,absolute,exists,before,after,now,fileHashesAfter,assertExistingSourceReceipt,relative,absolute,exists,current,assertSourceApplyReceipt,expectedPaths,hashPaths,atomicWriteRaw,applyUnifiedDiffToText,normalizedDiff,baseLines,diffLines,cursor,oldIndex,oldCount,newCount,mark,body,splitKeep,lines
    ProposeCodeChangePlansOptions:
    ProposeCodeChangePlansResult:
    EvaluateCodeChangeAcceptanceOptions:
    CloseCodeChangesOptions:
    CreateCodeChangeReviewOptions:
    CreatedCodeChangeReview:
    CreateCodeChangeSourcePatchOptions:
    ApplyCodeChangeSourcePatchOptions:
    ApplyCodeChangeSourcePatchResult:
    PreparedSourceEdit:
    IMPLEMENTATION_DIAGNOSTIC_CODES()
    proposeCodeChangePlans()
    generatedAt()
    maxPlans()
    conclusions()
    proposals()
    recordsById()
    proposalsByDiagnostic()
    conclusionsByDiagnostic()
    candidates()
    relatedRecords()
    matchingProposals()
    matchingConclusions()
    target()
    changes()
    generation()
    planHash()
    createRepositoryPathProbe()
    base()
    absolute()
    implementationDiagnosticRank()
    evaluateCodeChangeAcceptance()
    afterDiagnostics()
    beforeIds()
    afterById()
    targeted()
    clearedDiagnosticIds()
    remainingDiagnosticIds()
    newBlockingDiagnosticIds()
    accepted()
    evaluatedAt()
    closeCodeChanges()
    evaluatedAt()
    afterDiagnostics()
    planIds()
    acceptances()
    acceptedCount()
    indexProposalsByDiagnostic()
    index()
    list()
    indexConclusionsByDiagnostic()
    index()
    list()
    collectTarget()
    paths()
    symbols()
    tickets()
    versions()
    buildChanges()
    symbols()
    sourceIntents()
    rationale()
    normalized()
    exists()
    titleFor()
    record()
    object()
    startsWithImperative()
    descriptionFor()
    acceptanceCriteriaFor()
    priorityFor()
    confidenceFor()
    riskFor()
    level()
    rollbackFor()
    deterministicGeneration()
    uniqueSorted()
    createCodeChangeReviewPatch()
    createdAt()
    markdown()
    renderCodeChangeReviewMarkdown()
    symbols()
    assertCodeChangeReviewPatch()
    artifact()
    generation()
    priorityRank()
    inline()
    renderIds()
    createCodeChangeSourcePatch()
    plan()
    graphFingerprint()
    createdAt()
    allowed()
    diffs()
    normalized()
    path()
    rawDiff()
    unifiedDiff()
    patchHash()
    createCodeChangeSourcePatchSet()
    generatedAt()
    assertCodeChangeSourcePatch()
    patch()
    paths()
    path()
    expectedHash()
    allowed()
    expectedChanges()
    editPath()
    assertCodeChangeSourcePatchSet()
    set()
    plansById()
    patchIds()
    exactSourcePatchKeys()
    actual()
    assertSourcePatchIds()
    assertSourcePatchStrings()
    exactSourcePatchSet()
    instructionFor()
    symbols()
    criteria()
    normalizeUnifiedDiff()
    normalized()
    path()
    bare()
    stripped()
    applyCodeChangeSourcePatch()
    root()
    receiptPath()
    existing()
    relative()
    absolute()
    exists()
    before()
    after()
    now()
    fileHashesAfter()
    assertExistingSourceReceipt()
    relative()
    absolute()
    exists()
    current()
    assertSourceApplyReceipt()
    expectedPaths()
    hashPaths()
    atomicWriteRaw()
    applyUnifiedDiffToText()
    normalizedDiff()
    baseLines()
    diffLines()
    cursor()
    oldIndex()
    oldCount()
    newCount()
    mark()
    body()
    splitKeep()
    lines()
  src/extractors/ast/typescript.ts:
    i: ../../core/io.js,../../core/record.js,../../core/types.js,./records.js,node:path,typescript
    e: extractTypeScriptFile,relative,sourceFile,moduleCapabilities,lineRange,excerpt,add,symbol,nameOf,modifiers,visit,symbol,symbolModifiers,declarationIsCallable,callee,capabilities,isTopLevel,scriptKind,extension,languageName,extension
    extractTypeScriptFile()
    relative()
    sourceFile()
    moduleCapabilities()
    lineRange()
    excerpt()
    add()
    symbol()
    nameOf()
    modifiers()
    visit()
    symbol()
    symbolModifiers()
    declarationIsCallable()
    callee()
    capabilities()
    isTopLevel()
    scriptKind()
    extension()
    languageName()
    extension()
  src/graph/diagnostics.ts:
    i: ../core/id.js,../core/schema.js,../core/target.js,./capability-evidence.js,./changelog-signal.js,./symbol-resolution.js
    e: diagnoseGraph,neighbors,recordsById,groundedImplementation,implementedPaths,documentedPaths,symbolResolutionIndex,related,evidenced,hasLocationOnlyEvidence,missingFields,symbolIssues,detail,indexGroundedImplementationEvidence,grounded,left,right,relationSupportsImplementation,basis,score,ambiguityDetail,paths,ambiguityAction,actions,buildNeighbors,map,appendNeighbor,values,indexImplementedPaths,paths,indexDocumentedPaths,paths,hasImplementedTarget,hasDocumentedTarget,isPlan,isImplementationEvidence,isPublicImplementation,symbol,isReleaseCandidate,isImportantRecord,makeDiagnostic,severityRank
    diagnoseGraph()
    neighbors()
    recordsById()
    groundedImplementation()
    implementedPaths()
    documentedPaths()
    symbolResolutionIndex()
    related()
    evidenced()
    hasLocationOnlyEvidence()
    missingFields()
    symbolIssues()
    detail()
    indexGroundedImplementationEvidence()
    grounded()
    left()
    right()
    relationSupportsImplementation()
    basis()
    score()
    ambiguityDetail()
    paths()
    ambiguityAction()
    actions()
    buildNeighbors()
    map()
    appendNeighbor()
    values()
    indexImplementedPaths()
    paths()
    indexDocumentedPaths()
    paths()
    hasImplementedTarget()
    hasDocumentedTarget()
    isPlan()
    isImplementationEvidence()
    isPublicImplementation()
    symbol()
    isReleaseCandidate()
    isImportantRecord()
    makeDiagnostic()
    severityRank()
  src/synthesis/code-change-path.ts:
    e: NON_SOURCE_DIR_SEGMENTS,BINARY_EXTENSIONS,GENERATED_ANALYSIS_BASENAMES,T2C_ARTIFACT_BASENAMES,EXTENSIONLESS_SOURCE_BASENAMES,isPlannablePath,normalized,segments,lowerSegments,basename,lowerBasename,dot,ext,isUsefulCodeChangePath
    NON_SOURCE_DIR_SEGMENTS()
    BINARY_EXTENSIONS()
    GENERATED_ANALYSIS_BASENAMES()
    T2C_ARTIFACT_BASENAMES()
    EXTENSIONLESS_SOURCE_BASENAMES()
    isPlannablePath()
    normalized()
    segments()
    lowerSegments()
    basename()
    lowerBasename()
    dot()
    ext()
    isUsefulCodeChangePath()
  php/ast_extract.php:
    e: argumentValue,normalizedToken,significant,qualifiedName,sourceExcerpt,addFact,parseFile
    argumentValue()
    normalizedToken()
    significant()
    qualifiedName()
    sourceExcerpt()
    addFact()
    parseFile()
  src/core/text.ts:
    i: ./types.js
    e: STOP_WORDS,classifyActionHeuristically,conventional,prose,searchable,detectModality,prose,searchable,matches,detectPolarity,prose,stripped,normalized,normalizeToken,keywords,GENERIC_TOPICS,topicKeywords,separated,foldTopicToken,aliased,singular,similarity,left,right,intersection,extractBacktickValues,value,extractPaths,FILE_EXTENSIONS,hasFileExtension,last,dot,PATH_ROOTS,isPathLike,segments,HOST_TLDS,isHostname,parts,tld,extractSymbols,repositoryPaths,backticks,camel,ticketPrefixes,extractTickets,values,extractVersions,inferObject,normalized,result,splitIntentLines,lines,raw,cleaned,pieces,value
    STOP_WORDS()
    classifyActionHeuristically()
    conventional()
    prose()
    searchable()
    detectModality()
    prose()
    searchable()
    matches()
    detectPolarity()
    prose()
    stripped()
    normalized()
    normalizeToken()
    keywords()
    GENERIC_TOPICS()
    topicKeywords()
    separated()
    foldTopicToken()
    aliased()
    singular()
    similarity()
    left()
    right()
    intersection()
    extractBacktickValues()
    value()
    extractPaths()
    FILE_EXTENSIONS()
    hasFileExtension()
    last()
    dot()
    PATH_ROOTS()
    isPathLike()
    segments()
    HOST_TLDS()
    isHostname()
    parts()
    tld()
    extractSymbols()
    repositoryPaths()
    backticks()
    camel()
    ticketPrefixes()
    extractTickets()
    values()
    extractVersions()
    inferObject()
    normalized()
    result()
    splitIntentLines()
    lines()
    raw()
    cleaned()
    pieces()
    value()
  scripts/github-event-log.mjs:
    i: ../dist/src/core/id.js,node:fs,node:path
    e: EVENT_NAMES,parser,values,option,value,asRecord,asText,asString,text,fail,asSha,text,asTimestamp,text,asRepository,text,asTicket,text,asActor,text,pickActor,value,pickTimestamp,value,canonicalEvidence,pickRepository,repositoryObject,repository,makeCommonEvent,createPushEvents,ref,before,after,deleted,eventTime,occurredAt,actor,commits,sha,commitActor,commitActorId,commitAt,createPullRequestEvents,action,pullRequest,number,baseSha,headSha,actor,createdAt,updatedAt,mergedAt,mapping,occurredAt,createPullRequestReviewEvents,action,review,pullRequest,reviewId,number,actor,baseSha,headSha,state,outcome,occurredAt,createWorkflowRunEvents,action,workflowRun,id,actor,concluded,outcome,occurredAt,headSha,toEventSet,builder,main,eventPath,raw,repository,ticket,recordedAt,correlationFallback,correlationId,streamId,output,events,generatedAt,document
    EVENT_NAMES()
    parser()
    values()
    option()
    value()
    asRecord()
    asText()
    asString()
    text()
    fail()
    asSha()
    text()
    asTimestamp()
    text()
    asRepository()
    text()
    asTicket()
    text()
    asActor()
    text()
    pickActor()
    value()
    pickTimestamp()
    value()
    canonicalEvidence()
    pickRepository()
    repositoryObject()
    repository()
    makeCommonEvent()
    createPushEvents()
    ref()
    before()
    after()
    deleted()
    eventTime()
    occurredAt()
    actor()
    commits()
    sha()
    commitActor()
    commitActorId()
    commitAt()
    createPullRequestEvents()
    action()
    pullRequest()
    number()
    baseSha()
    headSha()
    actor()
    createdAt()
    updatedAt()
    mergedAt()
    mapping()
    occurredAt()
    createPullRequestReviewEvents()
    action()
    review()
    pullRequest()
    reviewId()
    number()
    actor()
    baseSha()
    headSha()
    state()
    outcome()
    occurredAt()
    createWorkflowRunEvents()
    action()
    workflowRun()
    id()
    actor()
    concluded()
    outcome()
    occurredAt()
    headSha()
    toEventSet()
    builder()
    main()
    eventPath()
    raw()
    repository()
    ticket()
    recordedAt()
    correlationFallback()
    correlationId()
    streamId()
    output()
    events()
    generatedAt()
    document()
  src/evaluation/gold-types.ts:
    e: GoldRecordProjection,GoldDocumentModelRecord,GoldExtractionCase,GoldFixtureRecord,GoldExpectedRelation,GoldRerankerDecisionFixture,GoldRerankerFixture,GoldLinkingCase,GoldProposalFixture,GoldDsl2TodoCase,GoldExpectedDiagnostic,GoldDiagnosticsCase,GoldDataset,BinaryMetric,GoldEvaluationReport,assertGoldDataset,dataset,assertDatasetObject,assertDatasetMetadata,assertDatasetCollections,assertUniqueCaseIds,assertExtractionCoverage,channels,assertLinkingCohorts,labels,modules
    GoldRecordProjection:
    GoldDocumentModelRecord:
    GoldExtractionCase:
    GoldFixtureRecord:
    GoldExpectedRelation:
    GoldRerankerDecisionFixture:
    GoldRerankerFixture:
    GoldLinkingCase:
    GoldProposalFixture:
    GoldDsl2TodoCase:
    GoldExpectedDiagnostic:
    GoldDiagnosticsCase:
    GoldDataset:
    BinaryMetric:
    GoldEvaluationReport:
    assertGoldDataset()
    dataset()
    assertDatasetObject()
    assertDatasetMetadata()
    assertDatasetCollections()
    assertUniqueCaseIds()
    assertExtractionCoverage()
    channels()
    assertLinkingCohorts()
    labels()
    modules()
  src/communication/identity.ts:
    i: ../core/io.js,../core/security.js,./intake-contract.js,node:path
    e: ParticipantIdentityEntry,ParticipantIdentityRegistry,LoadedParticipantIdentityRegistry,loadParticipantIdentityRegistry,v2Path,v1Path,registryPath,normalized,normalizeParticipantIdentityRegistry,registry,participants,ids,principals,key,normalizeV2Entry,principals,kind,assertParticipantIdentityRegistry,registry,ids,external,entry,values,normalized,owner,exactKeys,allowed,missing,extra
    ParticipantIdentityEntry:
    ParticipantIdentityRegistry:
    LoadedParticipantIdentityRegistry:
    loadParticipantIdentityRegistry()
    v2Path()
    v1Path()
    registryPath()
    normalized()
    normalizeParticipantIdentityRegistry()
    registry()
    participants()
    ids()
    principals()
    key()
    normalizeV2Entry()
    principals()
    kind()
    assertParticipantIdentityRegistry()
    registry()
    ids()
    external()
    entry()
    values()
    normalized()
    owner()
    exactKeys()
    allowed()
    missing()
    extra()
  scripts/verify-env-contract.mjs:
    i: node:fs,node:path
    e: root,examplePath,example,declared,match,expected,configBody,body,makefile,body,local,auditLocalKeys,body,keys,collectExisting,absolute,collect,absolute
    root()
    examplePath()
    example()
    declared()
    match()
    expected()
    configBody()
    body()
    makefile()
    body()
    local()
    auditLocalKeys()
    body()
    keys()
    collectExisting()
    absolute()
    collect()
    absolute()
  src/semantic/reranker.ts:
    i: ../core/id.js,../core/schema.js,../core/types.js,../version.js
    e: SemanticRetrievalIdentity,SemanticCandidate,SemanticCandidateSet,SemanticCandidateInput,SemanticRetrievalInput,SemanticEvidenceCitation,SemanticRerankDecisionInput,SemanticRerankDecision,SemanticRerankGeneration,SemanticRerankResult,SemanticRerankGenerationInput,createSemanticCandidateSet,grouped,values,assertSemanticCandidateSet,records,seenIds,seenPairs,byDeclaration,declaration,module,values,expectedHash,createSemanticRerankResult,decisions,assertSemanticRerankResult,candidates,records,seenDecisions,acceptedDeclarations,candidate,citations,record,expectedHash,applyAcceptedSemanticRelations,candidates,added,candidate,validateRetrieval,validateGeneration,validateVerdictReason,assertSemanticVerdictReason,allowed,reasons,assertGroundedQuote,quote,boundedScore,roundedConfidence,requiredText,validDate,comparePair
    SemanticRetrievalIdentity:
    SemanticCandidate:
    SemanticCandidateSet:
    SemanticCandidateInput:
    SemanticRetrievalInput:
    SemanticEvidenceCitation:
    SemanticRerankDecisionInput:
    SemanticRerankDecision:
    SemanticRerankGeneration:
    SemanticRerankResult:
    SemanticRerankGenerationInput:
    createSemanticCandidateSet()
    grouped()
    values()
    assertSemanticCandidateSet()
    records()
    seenIds()
    seenPairs()
    byDeclaration()
    declaration()
    module()
    values()
    expectedHash()
    createSemanticRerankResult()
    decisions()
    assertSemanticRerankResult()
    candidates()
    records()
    seenDecisions()
    acceptedDeclarations()
    candidate()
    citations()
    record()
    expectedHash()
    applyAcceptedSemanticRelations()
    candidates()
    added()
    candidate()
    validateRetrieval()
    validateGeneration()
    validateVerdictReason()
    assertSemanticVerdictReason()
    allowed()
    reasons()
    assertGroundedQuote()
    quote()
    boundedScore()
    roundedConfidence()
    requiredText()
    validDate()
    comparePair()
  scripts/research/rank-intent-graph-embeddings.py:
    e: parse_args,projection_text,main
    parse_args()
    projection_text(record;prefix)
    main()
  src/diff/reality.ts:
    i: ../core/id.js,../core/schema.js,../core/target.js
    e: RealityRow,IntentRealityView,RealitySvgOptions,buildRealityView,components,diagnosticsByRecord,codes,status,bySeverity,alignment,bySize,declaredRecords,observedRecords,aligned,declaredTopics,observedTopics,implementationAlignedTopics,documentedObservedTopics,ratio,documentedCoverageLabel,LABEL_CHAR,BADGE_CHAR,widestLabel,groupIntoTopics,symbolPaths,anchors,groups,key,bucket,indexModuleAnchors,modulePaths,targetless,candidates,path,values,resolvesToFile,resolved,indexUnambiguousSymbolPaths,candidates,paths,values,primaryTargetKey,anchor,indexDiagnostics,index,bucket,resolveEvidence,resolveStatus,declared,observed,changelog,topicLabel,separator,raw,value,declared,object,renderRealitySvg,theme,maxRows,title,rows,visible,laneX,laneStep,statusX,statusWidth,width,rowHeight,headerY,y,isDeclared,color,count,cx,fill,label,pillWidth,renderRealityMarkdown,lanes,escapeMarkdown
    RealityRow:
    IntentRealityView:
    RealitySvgOptions:
    buildRealityView()
    components()
    diagnosticsByRecord()
    codes()
    status()
    bySeverity()
    alignment()
    bySize()
    declaredRecords()
    observedRecords()
    aligned()
    declaredTopics()
    observedTopics()
    implementationAlignedTopics()
    documentedObservedTopics()
    ratio()
    documentedCoverageLabel()
    LABEL_CHAR()
    BADGE_CHAR()
    widestLabel()
    groupIntoTopics()
    symbolPaths()
    anchors()
    groups()
    key()
    bucket()
    indexModuleAnchors()
    modulePaths()
    targetless()
    candidates()
    path()
    values()
    resolvesToFile()
    resolved()
    indexUnambiguousSymbolPaths()
    candidates()
    paths()
    values()
    primaryTargetKey()
    anchor()
    indexDiagnostics()
    index()
    bucket()
    resolveEvidence()
    resolveStatus()
    declared()
    observed()
    changelog()
    topicLabel()
    separator()
    raw()
    value()
    declared()
    object()
    renderRealitySvg()
    theme()
    maxRows()
    title()
    rows()
    visible()
    laneX()
    laneStep()
    statusX()
    statusWidth()
    width()
    rowHeight()
    headerY()
    y()
    isDeclared()
    color()
    count()
    cx()
    fill()
    label()
    pillWidth()
    renderRealityMarkdown()
    lanes()
    escapeMarkdown()
  sdk/go/examples/basic/main.go:
    e: main,run,envOr,truncate,joinedIDs
    main()
    run()
    envOr()
    truncate()
    joinedIDs()
  src/semantic/reranker-llm.ts:
    i: ../config/env.js,../core/id.js,../core/types.js,../llm/openrouter.js,../llm/structured-schema.js,node:child_process,node:path,node:util
    e: SemanticRerankerOptions,SemanticRerankerRequiredError
    SemanticRerankerOptions:
    SemanticRerankerRequiredError: super(-1),rerankSemanticCandidates(-1),assertSemanticCandidateSet(-1),model(-1),modelRevision(-1),assertSemanticRerankResult(-1),client(-1),records(-1),payload(-1),response(-1),metadata(-1),assertSemanticRerankerResponse(-1),execFileAsync(-1),assertTrackedSnapshot(-1),root(-1),revision(-1),execFileAsync(-1),execFileAsync(-1),execFileAsync(-1),execFileAsync(-1),head(-1),resolvedRevision(-1),tracked(-1),records(-1),recordIds(-1),record(-1),sourcePath(-1),semanticRerankCacheKey(-1),projectRecord(-1)
  src/core/schema.ts:
    e: GroundedValidationContext,TodoProposalValidationContext,CodeChangePlanValidationContext,CodeChangeAcceptanceValidationContext,ACTIONS,MODALITIES,POLARITIES,LIFECYCLES,SOURCE_KINDS,EPISTEMIC_CLASSES,RELATION_TYPES,CONCLUSION_KINDS,DIAGNOSTIC_SEVERITIES,TODO_PRIORITIES,GENERATION_REQUESTED_MODES,GENERATION_EFFECTIVE_MODES,CODE_CHANGE_ACTIONS,CODE_CHANGE_RISK_LEVELS,assertIntentRecord,record,statement,target,lifecycle,source,lines,epistemic,metadata,assertGenerationMatchesExtractor,generation,separator,expectedGenerator,assertIntentGenerationMetadata,generation,assertIntentRecords,assertIntentGraph,graph,recordIds,relationIds,stats,records,expectedFingerprint,assertIntentGraphDiff,diff,records,change,relations,summary,assertConclusion,known,assertConclusions,known,ids,id,assertTodoProposal,known,assertTodoProposals,known,proposalIds,id,assertCodeChangePlan,known,assertCodeChangePlans,known,ids,id,assertCodeChangePlansForReview,ids,plan,evidence,id,assertCodeChangePlanForAcceptance,known,plan,evidence,assertPlanGraphFingerprint,assertCodeChangeAcceptance,beforeKnown,afterKnown,acceptance,expectedCleared,expectedRemaining,expectedBlocking,expectedAccepted,assertConclusionValue,conclusion,expectedId,assertTodoProposalValue,proposal,target,expectedId,assertGroundedGenerationMetadata,generation,validateGroundedContext,report,diagnosticIds,diagnostic,validateTodoProposalContext,known,validateCodeChangePlanContext,known,conclusions,proposals,referencedConclusionIds,proposal,proposalIds,assertCodeChangePlanValue,plan,target,targetPaths,changePaths,change,normalizedPath,risk,evidence,semantic,expectedHash,expectedId,assertRelation,relation,objectValue,exactKeys,expectedSet,missing,extra,nonEmptyString,nonBlankString,nullableString,enumValue,stringArray,nonEmptyUniqueStringArray,repositoryPath,normalized,exactStringSet,uniqueIdArray,nonEmptyUniqueIdArray,knownReferences,unknown,confidence,assertAcyclicProposalDependencies,byId,visiting,visited,visit,start,dateString,nullableDate,fingerprint,nonNegativeInteger,countMap,map,countRecords,key,exactCounts,actual,isJsonValue
    GroundedValidationContext:
    TodoProposalValidationContext:
    CodeChangePlanValidationContext:
    CodeChangeAcceptanceValidationContext:
    ACTIONS()
    MODALITIES()
    POLARITIES()
    LIFECYCLES()
    SOURCE_KINDS()
    EPISTEMIC_CLASSES()
    RELATION_TYPES()
    CONCLUSION_KINDS()
    DIAGNOSTIC_SEVERITIES()
    TODO_PRIORITIES()
    GENERATION_REQUESTED_MODES()
    GENERATION_EFFECTIVE_MODES()
    CODE_CHANGE_ACTIONS()
    CODE_CHANGE_RISK_LEVELS()
    assertIntentRecord()
    record()
    statement()
    target()
    lifecycle()
    source()
    lines()
    epistemic()
    metadata()
    assertGenerationMatchesExtractor()
    generation()
    separator()
    expectedGenerator()
    assertIntentGenerationMetadata()
    generation()
    assertIntentRecords()
    assertIntentGraph()
    graph()
    recordIds()
    relationIds()
    stats()
    records()
    expectedFingerprint()
    assertIntentGraphDiff()
    diff()
    records()
    change()
    relations()
    summary()
    assertConclusion()
    known()
    assertConclusions()
    known()
    ids()
    id()
    assertTodoProposal()
    known()
    assertTodoProposals()
    known()
    proposalIds()
    id()
    assertCodeChangePlan()
    known()
    assertCodeChangePlans()
    known()
    ids()
    id()
    assertCodeChangePlansForReview()
    ids()
    plan()
    evidence()
    id()
    assertCodeChangePlanForAcceptance()
    known()
    plan()
    evidence()
    assertPlanGraphFingerprint()
    assertCodeChangeAcceptance()
    beforeKnown()
    afterKnown()
    acceptance()
    expectedCleared()
    expectedRemaining()
    expectedBlocking()
    expectedAccepted()
    assertConclusionValue()
    conclusion()
    expectedId()
    assertTodoProposalValue()
    proposal()
    target()
    expectedId()
    assertGroundedGenerationMetadata()
    generation()
    validateGroundedContext()
    report()
    diagnosticIds()
    diagnostic()
    validateTodoProposalContext()
    known()
    validateCodeChangePlanContext()
    known()
    conclusions()
    proposals()
    referencedConclusionIds()
    proposal()
    proposalIds()
    assertCodeChangePlanValue()
    plan()
    target()
    targetPaths()
    changePaths()
    change()
    normalizedPath()
    risk()
    evidence()
    semantic()
    expectedHash()
    expectedId()
    assertRelation()
    relation()
    objectValue()
    exactKeys()
    expectedSet()
    missing()
    extra()
    nonEmptyString()
    nonBlankString()
    nullableString()
    enumValue()
    stringArray()
    nonEmptyUniqueStringArray()
    repositoryPath()
    normalized()
    exactStringSet()
    uniqueIdArray()
    nonEmptyUniqueIdArray()
    knownReferences()
    unknown()
    confidence()
    assertAcyclicProposalDependencies()
    byId()
    visiting()
    visited()
    visit()
    start()
    dateString()
    nullableDate()
    fingerprint()
    nonNegativeInteger()
    countMap()
    map()
    countRecords()
    key()
    exactCounts()
    actual()
    isJsonValue()
  src/diff/git.ts:
    i: ./text.js,node:child_process,node:fs,node:path,node:util
    e: GitDiffOptions,GitDiffResult,ChangedEntry,execFileAsync,BINARY_EXTENSIONS,collectGitDiff,root,revision,staged,maxFiles,inside,beforePath,before,after,diff,parseNameStatus,parts,status,isProbablyBinary,readBlob,readStagedBlob,readWorkingFile,runGit,result
    GitDiffOptions:
    GitDiffResult:
    ChangedEntry:
    execFileAsync()
    BINARY_EXTENSIONS()
    collectGitDiff()
    root()
    revision()
    staged()
    maxFiles()
    inside()
    beforePath()
    before()
    after()
    diff()
    parseNameStatus()
    parts()
    status()
    isProbablyBinary()
    readBlob()
    readStagedBlob()
    readWorkingFile()
    runGit()
    result()
  src/comparison/workspace.ts:
    i: ../config/env.js,../core/id.js,../core/io.js,../core/security.js,../core/types.js,../diff/reality.js,../graph/diff.js,../llm/openrouter-timeout.js,../pipeline/run.js,node:child_process,node:fs,node:os,node:path,node:util
    e: WorkspaceComparisonDeadlineLoad,WorkspaceComparisonDeadlineDecision,WorkspaceComparisonOptions,CoverageSnapshot,WorkspaceComparison,execFileAsync,WORKSPACE_COMPARISON_DEADLINE_POLICY,calculateWorkspaceComparisonDeadline,baseDeadlineMs,pressure,steps,multiplier,scaledDeadlineMs,effectiveDeadlineMs,capped,compareWorkspaceIntent,root,repositoryRoot,relativeAnalysisRoot,outputDir,baseRef,baseCommit,headCommit,status,changedFiles,deadlineDecision,deadlineController,inheritedSignal,abortFromInheritedSignal,deadlineExpired,deadlineTimer,temporaryParent,baseWorktree,baseRoot,pipelineOptions,baseOptions,currentOptions,baseReality,currentReality,diff,baseCoverage,currentCoverage,alignmentRateDelta,implementationCoverageDelta,plannedCodeCoverageDelta,documentedCodeCoverageDelta,gapsDelta,diagnosticsDelta,comparisonId,comparisonDirectory,artifacts,workspaceComparisonDeadlineLoad,files,addIfPresent,absolute,relative,documentFiles,documentFileSet,inputBytes,documentChunks,size,markdownMode,communicationMode,semanticUnitsPerPipeline,assertNonNegativeInteger,scopedOutputDirectory,absolute,relative,commonPipelineOptions,defaulted,optionsForRoot,existingFile,relative,coverage,diagnosticDelta,classifyWorkspaceTrend,severeDelta,improved,regressed,parseAheadBehind,defaultBaseRef,rounded,artifactPaths,relative,renderTrendMarkdown,percent,documentationLine,git,result
    WorkspaceComparisonDeadlineLoad:
    WorkspaceComparisonDeadlineDecision:
    WorkspaceComparisonOptions:
    CoverageSnapshot:
    WorkspaceComparison:
    execFileAsync()
    WORKSPACE_COMPARISON_DEADLINE_POLICY()
    calculateWorkspaceComparisonDeadline()
    baseDeadlineMs()
    pressure()
    steps()
    multiplier()
    scaledDeadlineMs()
    effectiveDeadlineMs()
    capped()
    compareWorkspaceIntent()
    root()
    repositoryRoot()
    relativeAnalysisRoot()
    outputDir()
    baseRef()
    baseCommit()
    headCommit()
    status()
    changedFiles()
    deadlineDecision()
    deadlineController()
    inheritedSignal()
    abortFromInheritedSignal()
    deadlineExpired()
    deadlineTimer()
    temporaryParent()
    baseWorktree()
    baseRoot()
    pipelineOptions()
    baseOptions()
    currentOptions()
    baseReality()
    currentReality()
    diff()
    baseCoverage()
    currentCoverage()
    alignmentRateDelta()
    implementationCoverageDelta()
    plannedCodeCoverageDelta()
    documentedCodeCoverageDelta()
    gapsDelta()
    diagnosticsDelta()
    comparisonId()
    comparisonDirectory()
    artifacts()
    workspaceComparisonDeadlineLoad()
    files()
    addIfPresent()
    absolute()
    relative()
    documentFiles()
    documentFileSet()
    inputBytes()
    documentChunks()
    size()
    markdownMode()
    communicationMode()
    semanticUnitsPerPipeline()
    assertNonNegativeInteger()
    scopedOutputDirectory()
    absolute()
    relative()
    commonPipelineOptions()
    defaulted()
    optionsForRoot()
    existingFile()
    relative()
    coverage()
    diagnosticDelta()
    classifyWorkspaceTrend()
    severeDelta()
    improved()
    regressed()
    parseAheadBehind()
    defaultBaseRef()
    rounded()
    artifactPaths()
    relative()
    renderTrendMarkdown()
    percent()
    documentationLine()
    git()
    result()
  sdk/rust/examples/basic.rs:
    i: serde_json::json,std::env,todo2code::Client
    e: main,run,joined_ids
    main()
    run()
    joined_ids()
  src/extractors/markdown-llm.ts:
    i: ../config/env.js,../core/io.js,../core/record.js,../llm/audit.js,../llm/failure.js,../llm/openrouter.js,../llm/structured-schema.js,../version.js,./docs-chunks.js,./markdown.js,node:fs,node:path,node:url
    e: MarkdownEnrichment,MarkdownResponse,AuditedMarkdownExtractionResult,MarkdownLlmRequiredError,MarkdownAttemptError,CoveredBatch,MARKDOWN_LLM_BATCH_RECORDS
    MarkdownEnrichment:
    MarkdownResponse:
    AuditedMarkdownExtractionResult:
    MarkdownLlmRequiredError: super(-1),extractMarkdownIntentAudited(-1),startedAt(-1),deterministic(-1),client(-1),prompt(-1),enrichments(-1),responseByRecord(-1),outcomes(-1),corrected(-1),failed(-1),failure(-1),failedResponses(-1)
    MarkdownAttemptError: super(-1),enrichBatchCovering(-1),metadataByRecord(-1),uncovered(-1),enrichSplitBatch(-1),half(-1),emptyCoverage(-1),enrichMarkdownBatchWithCorrection(-1),completion(-1),fallbackOrThrow(-1),failed(-1),promptRecord(-1),validateEnrichments(-1),expected(-1),output(-1),enrichRecord(-1),markDeterministic(-1),marked(-1),stageAudit(-1),readPrompt(-1),promptPath(-1),markdownResponseContract(-1),strings(-1),enrichment(-1)
    CoveredBatch:
    MARKDOWN_LLM_BATCH_RECORDS()
  src/diff/text.ts:
    i: ./text-types.js
    e: RawOp,DEFAULT_CONTEXT,DEFAULT_MAX_COMPARE_LINES,splitLines,normalized,lines,diffText,diffLineArrays,context,maxCompareLines,beforePath,afterPath,summarizeLines,computeLineDiff,prefix,suffix,lines,middleBefore,middleAfter,truncated,middleOps,sharedPrefixLength,prefix,sharedSuffixLength,suffix,prefixLines,suffixLines,beforeIndex,afterIndex,blockReplace,myers,n,m,max,offset,v,y,backtrack,x,y,v,k,previousK,previousX,previousY,buildHunks,changeIndexes,start,end,last,hunkFromRange,slice,beforeNumbers,afterNumbers
    RawOp:
    DEFAULT_CONTEXT()
    DEFAULT_MAX_COMPARE_LINES()
    splitLines()
    normalized()
    lines()
    diffText()
    diffLineArrays()
    context()
    maxCompareLines()
    beforePath()
    afterPath()
    summarizeLines()
    computeLineDiff()
    prefix()
    suffix()
    lines()
    middleBefore()
    middleAfter()
    truncated()
    middleOps()
    sharedPrefixLength()
    prefix()
    sharedSuffixLength()
    suffix()
    prefixLines()
    suffixLines()
    beforeIndex()
    afterIndex()
    blockReplace()
    myers()
    n()
    m()
    max()
    offset()
    v()
    y()
    backtrack()
    x()
    y()
    v()
    k()
    previousK()
    previousX()
    previousY()
    buildHunks()
    changeIndexes()
    start()
    end()
    last()
    hunkFromRange()
    slice()
    beforeNumbers()
    afterNumbers()
  src/watch/watcher.ts:
    i: ../config/env.js,../core/ignore.js,../core/types.js,../pipeline/run.js,node:fs,node:path
    e: SnapshotDelta,ScanOptions,ReportResult,WatchOptions,scanTree,maxFiles,absoluteRoot,visit,absolute,relative,stat,diffSnapshots,previous,describeDelta,shown,rest,DEFAULT_MIN_INTERVAL_MS,DEFAULT_SCAN_INTERVAL_MS,watchRepository,root,minIntervalMs,scanIntervalMs,emit,now,sleep,signal,matcher,runReport,result,snapshot,lastReportStartedAt,pending,current,delta,waitMs,generate,startedAt,result,defaultSleep,timer,onAbort,finish
    SnapshotDelta:
    ScanOptions:
    ReportResult:
    WatchOptions:
    scanTree()
    maxFiles()
    absoluteRoot()
    visit()
    absolute()
    relative()
    stat()
    diffSnapshots()
    previous()
    describeDelta()
    shown()
    rest()
    DEFAULT_MIN_INTERVAL_MS()
    DEFAULT_SCAN_INTERVAL_MS()
    watchRepository()
    root()
    minIntervalMs()
    scanIntervalMs()
    emit()
    now()
    sleep()
    signal()
    matcher()
    runReport()
    result()
    snapshot()
    lastReportStartedAt()
    pending()
    current()
    delta()
    waitMs()
    generate()
    startedAt()
    result()
    defaultSleep()
    timer()
    onAbort()
    finish()
  src/pipeline/run.ts:
    i: ../communication/analyzer.js,../communication/llm.js,../config/env.js,../config/env.js,../core/id.js,../core/io.js,../extractors/ast.js,../extractors/configuration.js,../extractors/docs-deterministic.js,../extractors/docs-llm.js,../extractors/git.js,../extractors/markdown-llm.js,../extractors/nl-llm.js,../extractors/runtime-cycle.js,../graph/diagnostics.js,../graph/linker.js,../llm/audit.js,../summary/summarizer.js,../synthesis/tasks-llm.js,../synthesis/todo-patch.js,../version.js,./event-log-persistence.js,node:path
    e: PipelineResult,ExtractionResult,AnalysisResult,SynthesisResult,PlanningResult,PipelineSummaryResult,OutputPaths,PipelineRun,runPipeline
    PipelineResult:
    ExtractionResult:
    AnalysisResult:
    SynthesisResult:
    PlanningResult:
    PipelineSummaryResult:
    OutputPaths:
    PipelineRun: run(-1),execute(-1),extraction(-1),analysis(-1),synthesis(-1),planning(-1),summary(-1),extractSources(-1),naturalLanguageAudit(-1),git(-1),ast(-1),markdownAudit(-1),documentationAudit(-1),communication(-1),extractNaturalLanguage(-1),audit(-1),result(-1),extractMarkdown(-1),markdown(-1),extractDocumentation(-1),files(-1),startedAt(-1),deterministic(-1),audit(-1),enrichDocumentation(-1),docs(-1),missingDocumentationLlmAudit(-1),extractConfigurationAndRuntime(-1),configuration(-1),runtime(-1),extractCommunication(-1),communicationAudit(-1),startedAt(-1),communication(-1),missing(-1),analyze(-1),generatedAt(-1),graph(-1),communicationAnalysis(-1),diagnostics(-1),synthesizeTasks(-1),mode(-1),audit(-1),todoPath(-1),todoContent(-1),planChanges(-1),plans(-1),review(-1),sourcePatches(-1),summarize(-1),startedAt(-1),includeLlm(-1),summary(-1),disabledSummaryAudit(-1),successfulSummaryAudit(-1),fallbackSummaryAudit(-1),paths(-1),manifest(-1),writeIntentFiles(-1),filePath(-1),run(-1),writeJson(-1),writeText(-1),writeJson(-1),writeJson(-1),writeText(-1),writeJson(-1),pipelineResult(-1),relative(-1),manifestConfiguration(-1),collectTargetHints(-1),persistFailedRun(-1),aborted(-1),message(-1),knownAudit(-1),failedAudit(-1),stageValue(-1),reason(-1),failureCode(-1),skippedAudit(-1),appendLlmNotConfigured(-1)
    runPipeline()
  src/extractors/nl-llm.ts:
    i: ../config/env.js,../core/io.js,../core/record.js,../llm/audit.js,../llm/failure.js,../llm/openrouter.js,../llm/structured-schema.js,../version.js,./nl.js,node:fs,node:path,node:url
    e: RawNlRecord,NlResponse,AuditedNlExtractionResult,NlLlmRequiredError,NlAttemptError
    RawNlRecord:
    NlResponse:
    AuditedNlExtractionResult:
    NlLlmRequiredError: super(-1),extractNlIntentAudited(-1),assertNlExtractionOptions(-1),startedAt(-1),result(-1),client(-1),absolute(-1),body(-1),sourcePath(-1),maxLine(-1),prompt(-1),response(-1),records(-1),failure(-1),responses(-1)
    NlAttemptError: super(-1),extractNlWithCorrection(-1),completion(-1),fallbackOrThrow(-1),failedAudit(-1),deterministic(-1),markDeterministic(-1),toIntentRecord(-1),start(-1),end(-1),lines(-1),excerpt(-1),action(-1),normalizedText(-1),statementText(-1),OBJECT_PLACEHOLDERS(-1),nonEmptyText(-1),isPlaceholder(-1),text(-1),resolveObject(-1),fallback(-1),audit(-1),clampLine(-1),allowedAction(-1),allowedModality(-1),readPrompt(-1),promptPath(-1),nlStrings(-1),NL_RECORD_CONTRACT(-1),NL_RESPONSE_CONTRACT(-1)
  src/extractors/docs-deterministic.ts:
    i: ../config/env.js,../core/io.js,../core/record.js,../core/schema.js,../core/types.js,./markdown-block.js,./markdown-paths.js,node:path
    e: DeterministicDocumentationOptions,Docs2DslOptions,MAX_HEADING_LEVEL,MIN_STATEMENT_CHARS,docs2dsl,root,files,result,extractDocumentationBaseline,root,resolver,body,primePathMapper,resolved,mapped,convertDocument,relative,lines,raw,fenceMatch,marker,language,record,heading,level,title,bullet,block,record,paragraph,record,readParagraph,cursor,line,qualifyingStatement,target,hasCodeSpanIdentifier,statementRecord,action,codeBlockRecord,targetsOf,requireStandaloneRoot,requireStringList,resolveOwnedFiles,absolute,relative
    DeterministicDocumentationOptions:
    Docs2DslOptions:
    MAX_HEADING_LEVEL()
    MIN_STATEMENT_CHARS()
    docs2dsl()
    root()
    files()
    result()
    extractDocumentationBaseline()
    root()
    resolver()
    body()
    primePathMapper()
    resolved()
    mapped()
    convertDocument()
    relative()
    lines()
    raw()
    fenceMatch()
    marker()
    language()
    record()
    heading()
    level()
    title()
    bullet()
    block()
    record()
    paragraph()
    record()
    readParagraph()
    cursor()
    line()
    qualifyingStatement()
    target()
    hasCodeSpanIdentifier()
    statementRecord()
    action()
    codeBlockRecord()
    targetsOf()
    requireStandaloneRoot()
    requireStringList()
    resolveOwnedFiles()
    absolute()
    relative()
  src/core/record.ts:
    i: ./id.js,./target.js,./version.js
    e: BuildRecordGenerationInput,BuildRecordInput,buildRecord,rawExcerpt,withRecordGeneration,generationMetadata,used,extractorIdentity,separator,clamp,sourcePrefix
    BuildRecordGenerationInput:
    BuildRecordInput:
    buildRecord()
    rawExcerpt()
    withRecordGeneration()
    generationMetadata()
    used()
    extractorIdentity()
    separator()
    clamp()
    sourcePrefix()
  src/graph/linker.ts:
    i: ../core/id.js,../core/schema.js,../core/target.js,../core/text.js,../core/types.js,./capability-evidence.js,./symbol-resolution.js
    e: PairEvidence,RecordKeywords,DirectedRelation,SourceRelationRule,indexKeywords,jaccard,intersection,linkIntentRecords,records,byId,keywordIndex,symbolResolutionIndex,candidatePairs,resolvableBasenames,left,right,evidence,directed,deduplicateRecords,byId,existing,collectCandidatePairs,buckets,astIds,moduleAstIds,declarationAstIds,configurationIds,isModuleTopicSource,indexTargetBuckets,indexAliases,indexKeywordBuckets,indexTopicBuckets,addToBucket,values,isSuppressedConfigurationPair,pairsFromBuckets,output,leftId,rightId,isSuppressedAstPair,leftAst,rightAst,astId,indexResolvableBasenames,owners,normalized,basename,paths,pathsIntersect,expand,output,aliases,full,leftSet,scorePair,score,leftKeywords,rightKeywords,resolvedNlAstSymbol,capabilityOverlap,objectSimilarity,sharedTopics,intersectionSize,size,isFileAggregateEvidencePair,isModuleTopicEvidencePair,determineRelation,textScore,sourceRelation,relationForSourceKinds,relation,matchSourceRule,orientRelation,intersects,set,intersectsAliases,set,countBy,key
    PairEvidence:
    RecordKeywords:
    DirectedRelation:
    SourceRelationRule:
    indexKeywords()
    jaccard()
    intersection()
    linkIntentRecords()
    records()
    byId()
    keywordIndex()
    symbolResolutionIndex()
    candidatePairs()
    resolvableBasenames()
    left()
    right()
    evidence()
    directed()
    deduplicateRecords()
    byId()
    existing()
    collectCandidatePairs()
    buckets()
    astIds()
    moduleAstIds()
    declarationAstIds()
    configurationIds()
    isModuleTopicSource()
    indexTargetBuckets()
    indexAliases()
    indexKeywordBuckets()
    indexTopicBuckets()
    addToBucket()
    values()
    isSuppressedConfigurationPair()
    pairsFromBuckets()
    output()
    leftId()
    rightId()
    isSuppressedAstPair()
    leftAst()
    rightAst()
    astId()
    indexResolvableBasenames()
    owners()
    normalized()
    basename()
    paths()
    pathsIntersect()
    expand()
    output()
    aliases()
    full()
    leftSet()
    scorePair()
    score()
    leftKeywords()
    rightKeywords()
    resolvedNlAstSymbol()
    capabilityOverlap()
    objectSimilarity()
    sharedTopics()
    intersectionSize()
    size()
    isFileAggregateEvidencePair()
    isModuleTopicEvidencePair()
    determineRelation()
    textScore()
    sourceRelation()
    relationForSourceKinds()
    relation()
    matchSourceRule()
    orientRelation()
    intersects()
    set()
    intersectsAliases()
    set()
    countBy()
    key()
  src/interfaces/a2a-history.ts:
    i: ../config/env.js,../core/security.js,./a2a-types.js,node:fs,node:path
    e: IntentRunListItem,CommunicationRunSummary,RunHistoryFilters,listIntentRuns,runsDirectory,entries,items,readRunEntries,readRun,runDirectory,graphPath,manifestPath,manifest,safeRunPath,runListItem,files,llm,runtime,warnings,validTimestamp,validStatus,llmSummary,readCommunicationSummary,relative,filePath,stat,value,participants,issues,participantSummary,matchesRunFilters,participant,role,ticket,severity,normalized,stringArray,safeManifestFiles,absolute,relative,relativeApiPath
    IntentRunListItem:
    CommunicationRunSummary:
    RunHistoryFilters:
    listIntentRuns()
    runsDirectory()
    entries()
    items()
    readRunEntries()
    readRun()
    runDirectory()
    graphPath()
    manifestPath()
    manifest()
    safeRunPath()
    runListItem()
    files()
    llm()
    runtime()
    warnings()
    validTimestamp()
    validStatus()
    llmSummary()
    readCommunicationSummary()
    relative()
    filePath()
    stat()
    value()
    participants()
    issues()
    participantSummary()
    matchesRunFilters()
    participant()
    role()
    ticket()
    severity()
    normalized()
    stringArray()
    safeManifestFiles()
    absolute()
    relative()
    relativeApiPath()
  src/evaluation/gold-cases.ts:
    i: ../core/id.js,../core/record.js,../core/types.js,../graph/diagnostics.js,../graph/linker.js,../synthesis/validation.js,../version.js,./gold-metrics.js
    e: LinkingCaseResult,RerankingCaseResult,DiagnosticsCaseResult,Dsl2TodoCaseResult,evaluateLinkingCase,idToLabel,graph,observed,actual,expected,byClass,forbidden,forbiddenViolations,evaluateRerankingCase,idToLabel,declarationRecordId,graph,candidates,moduleRecordId,candidateByModule,decisions,moduleRecordId,candidate,rerank,augmented,observed,expected,forbidden,forbiddenViolations,classifyRelation,exact,evaluateDiagnosticsCase,idToLabel,graph,report,observed,forbidden,forbiddenViolations,evaluateDsl2TodoCase,graph,diagnostics,diagnosticIds,conclusion,proposals,validation,duplicateIds,actual,expected,citations,buildConclusion,buildProposal,recordIds,id,countCitations,citationRequired,citationCited,buildFixtureRecords,labels,records,record,deterministicGeneration
    LinkingCaseResult:
    RerankingCaseResult:
    DiagnosticsCaseResult:
    Dsl2TodoCaseResult:
    evaluateLinkingCase()
    idToLabel()
    graph()
    observed()
    actual()
    expected()
    byClass()
    forbidden()
    forbiddenViolations()
    evaluateRerankingCase()
    idToLabel()
    declarationRecordId()
    graph()
    candidates()
    moduleRecordId()
    candidateByModule()
    decisions()
    moduleRecordId()
    candidate()
    rerank()
    augmented()
    observed()
    expected()
    forbidden()
    forbiddenViolations()
    classifyRelation()
    exact()
    evaluateDiagnosticsCase()
    idToLabel()
    graph()
    report()
    observed()
    forbidden()
    forbiddenViolations()
    evaluateDsl2TodoCase()
    graph()
    diagnostics()
    diagnosticIds()
    conclusion()
    proposals()
    validation()
    duplicateIds()
    actual()
    expected()
    citations()
    buildConclusion()
    buildProposal()
    recordIds()
    id()
    countCitations()
    citationRequired()
    citationCited()
    buildFixtureRecords()
    labels()
    records()
    record()
    deterministicGeneration()
  src/communication/intake-protobuf.ts:
    i: ./intake-contract.js
    e: encodeIntakeEnvelope,operation,decodeIntakeEnvelope,values,offset,fieldStart,number,wire,raw,payload,encodeIntakeResult,decodeIntakeResult,strings,numbers,offset,field,bytesField,data,varintField,writeVarint,remaining,readVarint,value,byte
    encodeIntakeEnvelope()
    operation()
    decodeIntakeEnvelope()
    values()
    offset()
    fieldStart()
    number()
    wire()
    raw()
    payload()
    encodeIntakeResult()
    decodeIntakeResult()
    strings()
    numbers()
    offset()
    field()
    bytesField()
    data()
    varintField()
    writeVarint()
    remaining()
    readVarint()
    value()
    byte()
  src/communication/intake-contract.ts:
    i: node:crypto
    e: VerifiedPrincipal,ParticipantV2,ParticipantRegistryV2,IntakeEnvelope,IntakeDiagnostic,IntakeResult,IntakeError
    VerifiedPrincipal:
    ParticipantV2:
    ParticipantRegistryV2:
    IntakeEnvelope:
    IntakeDiagnostic:
    IntakeResult:
    IntakeError: super(-1),payloadHash(-1),canonicalJson(-1),record(-1),assertIntakeEnvelope(-1),envelope(-1),invalid(-1),invalid(-1),assertCommand(-1),base(-1),participantId(-1),participantId(-1),assertQuery(-1),base(-1),assertParticipant(-1),entry(-1),participantId(-1),nonBlank(-1),capabilities(-1),stringArray(-1),principalKey(-1),assertPrincipal(-1),principal(-1),nonBlank(-1),nonBlank(-1),commandFields(-1),type(-1),queryFields(-1),type(-1),strictObject(-1),record(-1),allowed(-1),extra(-1),missing(-1),participantId(-1),ticketId(-1),role(-1),nonBlank(-1),stringArray(-1),capabilities(-1),allowed(-1),invalid(-1),diagnostic(-1),known(-1)
  sdk/rust/src/client.rs:
    i: crate::,serde_json::,std::io::,std::net::,std::sync::atomic::,std::time::,super::
    e: Client
    Client:
  src/extractors/markdown-paths.ts:
    i: ../core/io.js,node:fs,node:fs,node:path
    e: MarkdownPathResolver,PATH_SEARCH_EXCLUDES,MAX_INDEXED_FILES,createMarkdownPathResolver,repositoryRoot,basenames,headingDirectories,normalized,candidate,matches,isRepositoryPath,absolute,headingScopes,buildBasenameIndex,index,base,seen,directory,absolute,matches
    MarkdownPathResolver:
    PATH_SEARCH_EXCLUDES()
    MAX_INDEXED_FILES()
    createMarkdownPathResolver()
    repositoryRoot()
    basenames()
    headingDirectories()
    normalized()
    candidate()
    matches()
    isRepositoryPath()
    absolute()
    headingScopes()
    buildBasenameIndex()
    index()
    base()
    seen()
    directory()
    absolute()
    matches()
  src/tf/classifier.ts:
    i: ../config/env.js,../core/text.js,../core/types.js,node:fs,node:path,node:url
    e: TfTensor,TfModel,TfModule,ModelAssets,dynamicImport,importer,loadAssets,directory,vocabularyPath,labels,loadClassifier,modelPath,modulePath,moduleValue,absolute,model,assets,vectorize,values,index,classifyAction,fallback,loaded,vector,input,predictionValue,prediction,probabilities,bestIndex,action,confidence
    TfTensor:
    TfModel:
    TfModule:
    ModelAssets:
    dynamicImport()
    importer()
    loadAssets()
    directory()
    vocabularyPath()
    labels()
    loadClassifier()
    modelPath()
    modulePath()
    moduleValue()
    absolute()
    model()
    assets()
    vectorize()
    values()
    index()
    classifyAction()
    fallback()
    loaded()
    vector()
    input()
    predictionValue()
    prediction()
    probabilities()
    bestIndex()
    action()
    confidence()
  sdk/typescript/examples/basic.ts:
    i: ../src/index.js
    e: baseUrl,token,root,main,client,health,card,nl,ast,markdown,graph,diagnostics,synthesis,validation,rendered,artifact,reality,gitDiff,comparison
    baseUrl()
    token()
    root()
    main()
    client()
    health()
    card()
    nl()
    ast()
    markdown()
    graph()
    diagnostics()
    synthesis()
    validation()
    rendered()
    artifact()
    reality()
    gitDiff()
    comparison()
  examples/backend/src/server.ts:
    i: ./store.js,./validation.js,node:http
    e: BackendOptions,MAX_BODY_BYTES,createBackend,store,server,handleRequest,url,body,validation,event,offset,limit,readBody,size,buffer,sendJson,body,startBackend,port,host
    BackendOptions:
    MAX_BODY_BYTES()
    createBackend()
    store()
    server()
    handleRequest()
    url()
    body()
    validation()
    event()
    offset()
    limit()
    readBody()
    size()
    buffer()
    sendJson()
    body()
    startBackend()
    port()
    host()
  src/llm/openrouter-timeout.ts:
    e: OpenRouterTimeoutLoad,OpenRouterTimeoutDecision,OPENROUTER_TIMEOUT_POLICY,calculateOpenRouterTimeout,complexityPoints,pressure,steps,multiplier,scaledTimeoutMs,effectiveTimeoutMs,capped,openRouterRequestTimeout,messages,plugins,responseFormat,jsonSchema,maxTokens,optionalArray,optionalObject,assertPositiveFinite,assertNonNegativeInteger
    OpenRouterTimeoutLoad:
    OpenRouterTimeoutDecision:
    OPENROUTER_TIMEOUT_POLICY()
    calculateOpenRouterTimeout()
    complexityPoints()
    pressure()
    steps()
    multiplier()
    scaledTimeoutMs()
    effectiveTimeoutMs()
    capped()
    openRouterRequestTimeout()
    messages()
    plugins()
    responseFormat()
    jsonSchema()
    maxTokens()
    optionalArray()
    optionalObject()
    assertPositiveFinite()
    assertNonNegativeInteger()
  python/ast_extract.py:
    e: FactVisitor,source_hash,dotted_name,is_module_entrypoint,iter_python_files,main
    FactVisitor(ast.NodeVisitor): __init__(2),excerpt(1),add(6),visit_Import(1),visit_ImportFrom(1),visit_FunctionDef(1),visit_AsyncFunctionDef(1),visit_ClassDef(1),add_named_constant(3),visit_Assign(1),visit_AnnAssign(1),visit_If(1),visit_Call(1)
    source_hash(value)
    dotted_name(node)
    is_module_entrypoint(node)
    iter_python_files(root;files_from)
    main()
  src/graph/symbol-resolution.ts:
    i: ../core/target.js,../core/types.js
    e: AstSymbolCandidate,NlSymbolResolution,SymbolResolutionIndex,buildSymbolResolutionIndex,byAlias,values,byNlRecord,hasResolvedNlAstSymbolPair,nl,ast,resolveSymbol,matched,selected,paths,pathSelects,normalized,candidatePath,uniquePaths,isAstDeclaration
    AstSymbolCandidate:
    NlSymbolResolution:
    SymbolResolutionIndex:
    buildSymbolResolutionIndex()
    byAlias()
    values()
    byNlRecord()
    hasResolvedNlAstSymbolPair()
    nl()
    ast()
    resolveSymbol()
    matched()
    selected()
    paths()
    pathSelects()
    normalized()
    candidatePath()
    uniquePaths()
    isAstDeclaration()
  src/core/io.ts:
    i: ./types.js,node:fs,node:path
    e: WalkOptions,DEFAULT_IGNORED_DIRS,ensureDir,readText,stat,pathExists,writeJson,writeText,writeJsonl,readJsonl,body,readJson,walkFiles,ignored,extensions,maxFiles,matcher,base,visit,entries,absolute,relative,extension,escapeRegex,globToRegExp,normalized,char,next,after,matchesAnyGlob,normalized,resolveGlobs,files,absolute,relative,relative,relativePosix
    WalkOptions:
    DEFAULT_IGNORED_DIRS()
    ensureDir()
    readText()
    stat()
    pathExists()
    writeJson()
    writeText()
    writeJsonl()
    readJsonl()
    body()
    readJson()
    walkFiles()
    ignored()
    extensions()
    maxFiles()
    matcher()
    base()
    visit()
    entries()
    absolute()
    relative()
    extension()
    escapeRegex()
    globToRegExp()
    normalized()
    char()
    next()
    after()
    matchesAnyGlob()
    normalized()
    resolveGlobs()
    files()
    absolute()
    relative()
    relative()
    relativePosix()
  src/extractors/communication.ts:
    i: ../config/env.js,../core/io.js,../core/record.js,../core/security.js,../core/types.js,../tf/classifier.js,node:path
    e: CommunicationExtractionOptions,CommunicationEnvelope,InferredCommunicationIdentity,CommunicationSegment,CommunicationCandidate,CommunicationAttribution,extractCommunicationIntent,root,projectRoot,files,identityRegistry,communicationFiles,loaded,extracted,loadCommunicationCandidate,relativeToProject,parts,pathTicket,loaded,envelope,inferred,explicitEnvelope,matchesRequestedTicket,readCommunicationFile,detail,shouldIgnoreCommunicationCandidate,hasExplicitCommunicationEnvelope,convertCommunicationCandidate,attribution,warnings,governanceRole,segments,records,resolveAttribution,resolveParticipantAttribution,declaredParticipant,declaredRole,declaredParticipantId,entry,participant,declaredGitAuthors,resolvedParticipant,resolvedDisplayName,resolveMessageAttribution,explicitMessageType,rawTimestamp,resolveTargetAttribution,attributionWarnings,basicAttributionWarnings,registryAttributionWarnings,source,declaredRole,timestampAttributionWarnings,buildCommunicationIntentRecord,semantics,classified,action,line,communicationMetadata,resolveIdentity,sameStrings,normalize,normalizedLeft,normalizedRight,parseEnvelope,lines,end,match,inferIdentity,parts,basename,governance,fileParts,nestedRoleIndex,nestedRole,nestedParticipant,isTicketEvidenceFile,basename,communicationSegments,lines,flush,item,raw,heading,cleaned,isCommunicationNoise,normalized,governanceSectionType,normalized,looksLikeTicket,normalizeRole,normalizeType,normalized,isCommunicationType,semanticsFor,first,listValue,jsonValues,stripped,jsonStringList,unquote,validTimestamp,parsed
    CommunicationExtractionOptions:
    CommunicationEnvelope:
    InferredCommunicationIdentity:
    CommunicationSegment:
    CommunicationCandidate:
    CommunicationAttribution:
    extractCommunicationIntent()
    root()
    projectRoot()
    files()
    identityRegistry()
    communicationFiles()
    loaded()
    extracted()
    loadCommunicationCandidate()
    relativeToProject()
    parts()
    pathTicket()
    loaded()
    envelope()
    inferred()
    explicitEnvelope()
    matchesRequestedTicket()
    readCommunicationFile()
    detail()
    shouldIgnoreCommunicationCandidate()
    hasExplicitCommunicationEnvelope()
    convertCommunicationCandidate()
    attribution()
    warnings()
    governanceRole()
    segments()
    records()
    resolveAttribution()
    resolveParticipantAttribution()
    declaredParticipant()
    declaredRole()
    declaredParticipantId()
    entry()
    participant()
    declaredGitAuthors()
    resolvedParticipant()
    resolvedDisplayName()
    resolveMessageAttribution()
    explicitMessageType()
    rawTimestamp()
    resolveTargetAttribution()
    attributionWarnings()
    basicAttributionWarnings()
    registryAttributionWarnings()
    source()
    declaredRole()
    timestampAttributionWarnings()
    buildCommunicationIntentRecord()
    semantics()
    classified()
    action()
    line()
    communicationMetadata()
    resolveIdentity()
    sameStrings()
    normalize()
    normalizedLeft()
    normalizedRight()
    parseEnvelope()
    lines()
    end()
    match()
    inferIdentity()
    parts()
    basename()
    governance()
    fileParts()
    nestedRoleIndex()
    nestedRole()
    nestedParticipant()
    isTicketEvidenceFile()
    basename()
    communicationSegments()
    lines()
    flush()
    item()
    raw()
    heading()
    cleaned()
    isCommunicationNoise()
    normalized()
    governanceSectionType()
    normalized()
    looksLikeTicket()
    normalizeRole()
    normalizeType()
    normalized()
    isCommunicationType()
    semanticsFor()
    first()
    listValue()
    jsonValues()
    stripped()
    jsonStringList()
    unquote()
    validTimestamp()
    parsed()
  src/pipeline/event-log.ts:
    i: node:crypto,node:fs,node:path
    e: EventLogEventInput,EventLogEvent,EventLogDocument,EventLogError,MAX_EVENTS,createEventLog,previousDigest,events,renderEventLog,parseEventLog,lines,cursor,exact,field,line,streamId,generatedAt,count,genesisDigest,streamDigest,values,assertEventLog,eventIds,previousDigest,event,calculated,writeEventLogAtomic,content,temporary
    EventLogEventInput:
    EventLogEvent:
    EventLogDocument:
    EventLogError: super(-1),validateEvent(-1),validateOptionalText(-1),validateTimestamp(-1),validateTimestamp(-1),fail(-1),fail(-1),validateSha(-1),validateSha(-1),validateEvidenceRef(-1),canonicalEventPayload(-1),eventLines(-1),withoutEvidence(-1),compareInputs(-1),compareEvents(-1),hash(-1),json(-1),validateText(-1),fail(-1),validateOptionalText(-1),validateTimestamp(-1),validateSha(-1),validateEvidenceRef(-1),validateText(-1),fail(-1),secretShaped(-1),stringValue(-1),parsed(-1),nullableStringValue(-1),parsed(-1),jsonValue(-1),fail(-1),integerValue(-1),parsed(-1),required(-1),value(-1),fail(-1)
    MAX_EVENTS()
    createEventLog()
    previousDigest()
    events()
    renderEventLog()
    parseEventLog()
    lines()
    cursor()
    exact()
    field()
    line()
    streamId()
    generatedAt()
    count()
    genesisDigest()
    streamDigest()
    values()
    assertEventLog()
    eventIds()
    previousDigest()
    event()
    calculated()
    writeEventLogAtomic()
    content()
    temporary()
  scripts/verify-no-llm-imports.mjs:
    i: node:fs,node:path
    e: visited,visit,body,resolved,resolveSource,raw
    visited()
    visit()
    body()
    resolved()
    resolveSource()
    raw()
  src/extractors/docs-record.ts:
    i: ../core/record.js,../version.js,./docs-types.js
    e: OBJECT_PLACEHOLDERS,toDocumentIntentRecord,statementText,target,action,modality,isPlaceholder,resolveObject,fallback,anchorToSource,claimedStart,claimedEnd,wanted,lines,scores,claimedScore,bestScore,bestIndex,anchored,keywordOverlap,present,shared,resolveTarget,hasTarget,resolveAction,derived,resolveModality,derived,linesFromChunk,lines,relativeStart,relativeEnd,clampLine,allowedAction,allowedModality,allowedLifecycle
    OBJECT_PLACEHOLDERS()
    toDocumentIntentRecord()
    statementText()
    target()
    action()
    modality()
    isPlaceholder()
    resolveObject()
    fallback()
    anchorToSource()
    claimedStart()
    claimedEnd()
    wanted()
    lines()
    scores()
    claimedScore()
    bestScore()
    bestIndex()
    anchored()
    keywordOverlap()
    present()
    shared()
    resolveTarget()
    hasTarget()
    resolveAction()
    derived()
    resolveModality()
    derived()
    linesFromChunk()
    lines()
    relativeStart()
    relativeEnd()
    clampLine()
    allowedAction()
    allowedModality()
    allowedLifecycle()
  src/evaluation/gold.ts:
    i: ../core/id.js,./gold-extraction.js,node:fs
    e: EvaluationCore,EvaluationRun,EvaluationResult,loadGoldDataset,parsed,evaluateGoldDataset,first,second,stable,goldReportIsPerfect,renderGoldReportMarkdown,percent,support,rows,value,evaluateOnce,extraction,linking,dsl2todo,diagnostics,evaluateExtraction,byChannel,actual,overall,evaluateDiagnostics,counts,forbiddenViolations,snapshots,result,evaluateLinking,counts,byClass,forbiddenViolations,snapshots,result,reranking,evaluateDsl2Todo,duplicateCounts,snapshots,result
    EvaluationCore:
    EvaluationRun:
    EvaluationResult:
    loadGoldDataset()
    parsed()
    evaluateGoldDataset()
    first()
    second()
    stable()
    goldReportIsPerfect()
    renderGoldReportMarkdown()
    percent()
    support()
    rows()
    value()
    evaluateOnce()
    extraction()
    linking()
    dsl2todo()
    diagnostics()
    evaluateExtraction()
    byChannel()
    actual()
    overall()
    evaluateDiagnostics()
    counts()
    forbiddenViolations()
    snapshots()
    result()
    evaluateLinking()
    counts()
    byClass()
    forbiddenViolations()
    snapshots()
    result()
    reranking()
    evaluateDsl2Todo()
    duplicateCounts()
    snapshots()
    result()
  src/live/contract-check.ts:
    i: ../core/types.js
    e: LiveBudget,LiveStageMeasurement,LiveHistoryRecord,LiveHistoryStageSummary,LiveHistorySummary,LiveContractAudit,LIVE_HISTORY_LIMIT,liveRequestTimeoutMs,measureLiveStages,missingLiveStages,measureStage,responses,overLatency,sumUsage,values,buildLiveAudit,stages,missingStages,totalLatencyMs,costs,totalCostUsd,overCost,overTotalLatency,buildRecordedLiveAudit,initial,history,toLiveHistoryRecord,appendLiveHistory,kept,summarizeLiveHistory,runs,byStage,entries,redactLiveMessage,renderLiveReport,lines,status,cost,detail,total,median,middle,value,ratio,round
    LiveBudget:
    LiveStageMeasurement:
    LiveHistoryRecord:
    LiveHistoryStageSummary:
    LiveHistorySummary:
    LiveContractAudit:
    LIVE_HISTORY_LIMIT()
    liveRequestTimeoutMs()
    measureLiveStages()
    missingLiveStages()
    measureStage()
    responses()
    overLatency()
    sumUsage()
    values()
    buildLiveAudit()
    stages()
    missingStages()
    totalLatencyMs()
    costs()
    totalCostUsd()
    overCost()
    overTotalLatency()
    buildRecordedLiveAudit()
    initial()
    history()
    toLiveHistoryRecord()
    appendLiveHistory()
    kept()
    summarizeLiveHistory()
    runs()
    byStage()
    entries()
    redactLiveMessage()
    renderLiveReport()
    lines()
    status()
    cost()
    detail()
    total()
    median()
    middle()
    value()
    ratio()
    round()
  golang/ast_extract.go:
    e: Fact,output,factCollector,main,emit,collectGoFiles,parseFile,position,excerpt,add,visitDecl,visitFunc,visitGenDecl,visitCalls,typeName,declaredTypeKind,strPtr,toSlash
    Fact:
    output:
    factCollector:
    main()
    emit()
    collectGoFiles()
    parseFile()
    position()
    excerpt()
    add()
    visitDecl()
    visitFunc()
    visitGenDecl()
    visitCalls()
    typeName()
    declaredTypeKind()
    strPtr()
    toSlash()
  scripts/research/rerank-embedding-shortlist.mjs:
    i: ../../dist/src/config/env.js,../../dist/src/semantic/reranker-llm.js,node:fs,node:path
    e: options,records,selectedRows,declaration,module,candidateSet,config,rerank,augmentedGraph,originalRelationIds,originallyRelatedPairs,candidateById,accepted,candidate,relation,verdictCounts,resolveDeclaration,exact,matches,resolveModule,exact,matches,readJson,parseArgs,values,key,value,required,value,top
    options()
    records()
    selectedRows()
    declaration()
    module()
    candidateSet()
    config()
    rerank()
    augmentedGraph()
    originalRelationIds()
    originallyRelatedPairs()
    candidateById()
    accepted()
    candidate()
    relation()
    verdictCounts()
    resolveDeclaration()
    exact()
    matches()
    resolveModule()
    exact()
    matches()
    readJson()
    parseArgs()
    values()
    key()
    value()
    required()
    value()
    top()
  src/extractors/git.ts:
    i: ../config/env.js,../core/record.js,../core/text.js,../core/types.js,../tf/classifier.js,node:child_process,node:path,node:util
    e: GitCommit,ChangedFile,GitExtractionOptions,execFileAsync,extractGitIntent,root,count,inside,message,commit,changedFiles,stats,diff,classified,inferredSymbols,docOnly,runGit,result,readCommits,output,readChangedFiles,output,parts,status,readStats,output,additions,deletions,extractChangedSymbols,output,symbol,isDocumentationPath
    GitCommit:
    ChangedFile:
    GitExtractionOptions:
    execFileAsync()
    extractGitIntent()
    root()
    count()
    inside()
    message()
    commit()
    changedFiles()
    stats()
    diff()
    classified()
    inferredSymbols()
    docOnly()
    runGit()
    result()
    readCommits()
    output()
    readChangedFiles()
    output()
    parts()
    status()
    readStats()
    output()
    additions()
    deletions()
    extractChangedSymbols()
    output()
    symbol()
    isDocumentationPath()
  src/core/truth-map.ts:
    i: ./id.js,./schema.js
    e: TruthMapSourceReference,TruthMapEvidenceLanes,TruthMapAssertion,TruthMap,RecordComponents,MAPPING_RELATIONS
    TruthMapSourceReference:
    TruthMapEvidenceLanes:
    TruthMapAssertion:
    TruthMap:
    RecordComponents: find(-1),parent(-1),root(-1),connect(-1),leftRoot(-1),rightRoot(-1),root(-1),child(-1),projectTruthMap(-1),assertIntentGraph(-1),requireDateTime(-1),components(-1),mappingRelations(-1),grouped(-1),root(-1),values(-1),assertTruthMap(-1),assertTruthMap(-1),assertIntentGraph(-1),requireDateTime(-1),knownRecords(-1),knownRelations(-1),mappedRecords(-1),validateRecordCoverage(-1),validateMappingEndpoints(-1),validateProjectionSummary(-1),validateAssertions(-1),assertionIds(-1),mappedRecords(-1),assertSortedUnique(-1),validateAssertion(-1),validateAssertion(-1),assertSortedUnique(-1),assertSortedUnique(-1),component(-1),validateEvidencePartition(-1),validateSources(-1),validateRelations(-1),conflicted(-1),expectedStatus(-1),validateRecordCoverage(-1),reverseKeys(-1),validateMappingEndpoints(-1),fromAssertion(-1),toAssertion(-1),validateProjectionSummary(-1),buildAssertion(-1),recordIds(-1),component(-1),componentRelations(-1),relationIds(-1),conflicted(-1),laneFor(-1),classifyStatus(-1),declared(-1),observed(-1),claimed(-1),sourceReference(-1),assertionId(-1),countStatuses(-1),truthMapFingerprint(-1),validateEvidencePartition(-1),seen(-1),assertSortedUnique(-1),validateSources(-1),sourceIds(-1),assertSortedUnique(-1),record(-1),validateRelations(-1),relation(-1),assertConnected(-1),assertConnected(-1),adjacent(-1),relation(-1),first(-1),visited(-1),recordId(-1),assertSortedUnique(-1),requireDateTime(-1),compareById(-1)
    MAPPING_RELATIONS()
  src/config/env.ts:
    i: ../core/io.js,../core/types.js,../version.js,node:fs,node:path
    e: T2CConfig,loadEnvFile,explicit,candidates,content,trimmed,separator,key,value,envString,value,envOptional,value,envNumber,raw,value,envBoolean,raw,envList,raw,envLlmMode,value,getConfig,model,root,projectFolderLabel,configForDisplay,hasOpenRouter
    T2CConfig:
    loadEnvFile()
    explicit()
    candidates()
    content()
    trimmed()
    separator()
    key()
    value()
    envString()
    value()
    envOptional()
    value()
    envNumber()
    raw()
    value()
    envBoolean()
    raw()
    envList()
    raw()
    envLlmMode()
    value()
    getConfig()
    model()
    root()
    projectFolderLabel()
    configForDisplay()
    hasOpenRouter()
  src/diff/text-render.ts:
    i: ./text-types.js
    e: TextDiffSvgOptions,SideBySideRow,renderUnifiedDiff,marker,toSideBySideRows,index,line,pairs,renderTextDiffSvg,theme,maxRows,maxColumns,title,charWidth,rowHeight,gutterWidth,columnWidth,width,totals,y,rendered,skipped,summarizeDiffs,diffHeading,svgBody,sideBySideRowMarkup,changed,number,renderTextDiffHtml,title,sections,renderHtmlSection,hunks,rows,htmlCell,cssClass,number
    TextDiffSvgOptions:
    SideBySideRow:
    renderUnifiedDiff()
    marker()
    toSideBySideRows()
    index()
    line()
    pairs()
    renderTextDiffSvg()
    theme()
    maxRows()
    maxColumns()
    title()
    charWidth()
    rowHeight()
    gutterWidth()
    columnWidth()
    width()
    totals()
    y()
    rendered()
    skipped()
    summarizeDiffs()
    diffHeading()
    svgBody()
    sideBySideRowMarkup()
    changed()
    number()
    renderTextDiffHtml()
    title()
    sections()
    renderHtmlSection()
    hunks()
    rows()
    htmlCell()
    cssClass()
    number()
  src/operations/subactor.ts:
    i: ../core/types.js,./validation.js
    e: CompileSubactorEnvelopeOptions,valueMatchesType,assertBinding,ageSeconds,compileSubactorProcessEnvelope,variableById,referenced,variable,binding,humanApproval,binding
    CompileSubactorEnvelopeOptions:
    valueMatchesType()
    assertBinding()
    ageSeconds()
    compileSubactorProcessEnvelope()
    variableById()
    referenced()
    variable()
    binding()
    humanApproval()
    binding()
  src/communication/intake-service.ts:
    i: ./intake-store.js,node:crypto,node:fs,node:path
    e: IntakeState,GovernedIntakeService
    IntakeState:
    GovernedIntakeService: command(-1),duplicate(-1),state(-1),actor(-1),event(-1),appended(-1),actual(-1),updated(-1),participantId(-1),ticketId(-1),actual(-1),query(-1),stream(-1),state(-1),payload(-1),command(-1),requireManagerOrBootstrap(-1),ensurePrincipalsUnique(-1),requireCapability(-1),requireKnownActor(-1),requireCapability(-1),participant(-1),requireCapability(-1),participant(-1),participant(-1),requireCapability(-1),rejectSecrets(-1),requireCapability(-1),participant(-1),writeProjection(-1),participant(-1),target(-1),messages(-1),body(-1),projectionHash(-1),stat(-1),existing(-1),assertProjectionWritable(-1),target(-1),slug(-1),directory(-1),roleFiles(-1),stat(-1),existing(-1),validateProjection(-1),participant(-1),target(-1),directory(-1),slug(-1),candidates(-1),roleFiles(-1),conflictingFiles(-1),existing(-1),messages(-1),body(-1),hash(-1),replay(-1),participants(-1),participant(-1),participant(-1),participant(-1),registry(-1),resolveActor(-1),requireKnownActor(-1),requireManagerOrBootstrap(-1),requireCapability(-1),requireCapability(-1),requireKnownActor(-1),requireParticipant(-1),participant(-1),ensurePrincipalsUnique(-1),ensurePrincipalAvailable(-1),key(-1),rejectSecrets(-1),accepted(-1),rejected(-1),envelope(-1),unauthorized(-1),duplicate(-1),drift(-1),escapeRegex(-1),commandEnvelope(-1)
  scripts/live-model-comparison.mjs:
    i: node:fs,node:path,node:url
    e: REPO_ROOT,main,probe,timeoutMs,models,root,config,result,comparison,rendered,jsonTarget,markdownTarget,failedAudit,message,writeFile
    REPO_ROOT()
    main()
    probe()
    timeoutMs()
    models()
    root()
    config()
    result()
    comparison()
    rendered()
    jsonTarget()
    markdownTarget()
    failedAudit()
    message()
    writeFile()
  src/extractors/docs-llm.ts:
    i: ../config/env.js,../core/content-cache.js,../core/id.js,../core/io.js,../core/types.js,../llm/audit.js,../llm/failure.js,../llm/openrouter.js,../llm/structured-schema.js,../version.js,./docs-chunks.js,./docs-record.js,./docs-schema.js,node:fs,node:path,node:url
    e: DocumentationLlmRequiredError
    DocumentationLlmRequiredError: super(-1),extractDocumentationIntent(-1),startedAt(-1),client(-1),requireConfiguredClient(-1),cache(-1),chunks(-1),selectedChunks(-1),systemPrompt(-1),results(-1),requireConfiguredClient(-1),loadDocumentChunks(-1),files(-1),body(-1),relative(-1),fileChunks(-1),isDocumentChunks(-1),candidate(-1),selectWithinBudget(-1),prioritized(-1),selected(-1),extractChunk(-1),contract(-1),records(-1),buildAudit(-1),status(-1),readPrompt(-1),promptPath(-1),errorMessage(-1)
  src/extractors/ast.ts:
    i: ../config/env.js,../core/content-cache.js,../core/id.js,../core/ignore.js,../core/io.js,../core/schema.js,../core/types.js,../version.js,./ast/go.js,./ast/java.js,./ast/php.js,./ast/python.js,./ast/rust.js,./ast/typescript.js,./ast/unsupported.js,node:path
    e: AstExtractionOptions,ExternalCacheAdapter,code2dsl,root,result,extractAstIntent,root,cache,matcher,files,body,relative,extracted,adapterFiles,manifest,result,unsupported,sourceManifest,body,isIntentRecords,isExtractionResult,result,requireStandaloneRoot
    AstExtractionOptions:
    ExternalCacheAdapter:
    code2dsl()
    root()
    result()
    extractAstIntent()
    root()
    cache()
    matcher()
    files()
    body()
    relative()
    extracted()
    adapterFiles()
    manifest()
    result()
    unsupported()
    sourceManifest()
    body()
    isIntentRecords()
    isExtractionResult()
    result()
    requireStandaloneRoot()
  src/llm/openrouter.ts:
    i: ../config/env.js,../core/types.js,./openrouter-timeout.js,./structured-schema.js,./subllm.js,node:crypto
    e: ChatMessage,OpenRouterChoice,OpenRouterResponse,OpenRouterResult,OpenRouterModelsResponse,LlmTransport,OpenRouterModelError,OpenRouterClient,BEARER_CREDENTIAL_RE,SECRET_ASSIGNMENT_RE,CREDENTIAL_IDENTIFIER_RE
    ChatMessage:
    OpenRouterChoice:
    OpenRouterResponse:
    OpenRouterResult:
    OpenRouterModelsResponse:
    LlmTransport:
    OpenRouterModelError: super(-1)
    OpenRouterClient: isConfigured(-1),listAvailableModels(-1),transport(-1),controller(-1),timeout(-1),response(-1),text(-1),clearTimeout(-1),chatText(-1),chatTextWithMetadata(-1),response(-1),content(-1),chatJson(-1),result(-1),chatJsonWithMetadata(-1),response(-1),fallback(-1),request(-1),transport(-1),requestBody(-1),timeoutDecision(-1),controller(-1),externalSignal(-1),abortFromExternal(-1),timeout(-1),clearTimeout(-1),error(-1),response(-1),text(-1),parsed(-1),message(-1),error(-1),transport(-1),subllmTransport(-1),directOpenRouterTransport(-1),credential(-1),model(-1),availableModels(-1),formatInvalidModelError(-1),providerRequestBody(-1),responseFormat(-1),jsonSchema(-1),messages(-1),parseProviderResponse(-1),redactProviderFailureText(-1),redacted(-1),normalizeRequestError(-1),error(-1),shouldRetryRequest(-1),waitForRetry(-1),responseMetadata(-1),usage(-1),stringOrNull(-1),finiteOrNull(-1),shouldRetryWithoutJsonSchema(-1),isInvalidModelError(-1),formatInvalidModelError(-1),removeUndefined(-1),isRecord(-1),extractContent(-1),content(-1),parseJsonContent(-1),trimmed(-1),start(-1),end(-1),parseJsonResponse(-1),metadata(-1),message(-1),responseProviderLabel(-1),sleep(-1),onAbort(-1),clearTimeout(-1),reject(-1),timeout(-1),resolve(-1)
    BEARER_CREDENTIAL_RE()
    SECRET_ASSIGNMENT_RE()
    CREDENTIAL_IDENTIFIER_RE()
  src/synthesis/todo-patch.ts:
    i: ../core/id.js,../core/io.js,./validation.js,node:crypto,node:fs,node:path
    e: CreateTodoPatchOptions,CreatedTodoPatch,WriteTodoPatchOptions,WrittenTodoPatch,ApplyTodoPatchOptions,diagnosticReportFingerprint,createTodoPatch,expectedValidation,proposalById,selected,proposal,orderedSelected,markdown,renderTodoPatchMarkdown,writeTodoPatchArtifacts,created,patchPath,auditPath,applyTodoPatch,current,receipt,now,currentHash,result,applied,recovered,assertTodoPatchArtifact,artifact,sourceTodo,selected,duplicates,classified,duplicate,assertApproval,assertReceipt,atomicWrite,temporary,existing,handle,appendPatch,separator,wasAlreadyAppended,renderTargets,rendered,renderIds,inline,normalizePath,sameArray,object,exactKeys,expected,missing,extra,nonBlank,hash,isoDate,uniqueIds,uniqueStrings
    CreateTodoPatchOptions:
    CreatedTodoPatch:
    WriteTodoPatchOptions:
    WrittenTodoPatch:
    ApplyTodoPatchOptions:
    diagnosticReportFingerprint()
    createTodoPatch()
    expectedValidation()
    proposalById()
    selected()
    proposal()
    orderedSelected()
    markdown()
    renderTodoPatchMarkdown()
    writeTodoPatchArtifacts()
    created()
    patchPath()
    auditPath()
    applyTodoPatch()
    current()
    receipt()
    now()
    currentHash()
    result()
    applied()
    recovered()
    assertTodoPatchArtifact()
    artifact()
    sourceTodo()
    selected()
    duplicates()
    classified()
    duplicate()
    assertApproval()
    assertReceipt()
    atomicWrite()
    temporary()
    existing()
    handle()
    appendPatch()
    separator()
    wasAlreadyAppended()
    renderTargets()
    rendered()
    renderIds()
    inline()
    normalizePath()
    sameArray()
    object()
    exactKeys()
    expected()
    missing()
    extra()
    nonBlank()
    hash()
    isoDate()
    uniqueIds()
    uniqueStrings()
  src/summary/payload.ts:
    i: ../core/types.js
    e: compactSummaryPayload,referenced,nonAst,moduleAst,relevantAst,ids,selectedRelations,compactRecord
    compactSummaryPayload()
    referenced()
    nonAst()
    moduleAst()
    relevantAst()
    ids()
    selectedRelations()
    compactRecord()
  src/evaluation/gold-cli.ts:
    i: node:fs,node:path
    e: main,args,arg,json,requirePerfect,outIndex,outPath,dataset,report,rendered
    main()
    args()
    arg()
    json()
    requirePerfect()
    outIndex()
    outPath()
    dataset()
    report()
    rendered()
  src/live/model-comparison.ts:
    i: ../core/types.js,./contract-check.js
    e: LiveModelRun,LiveModelMeasurement,LiveModelAgreement,LiveModelComparison,measureLiveModelRun,responses,records,enrichedRecords,costUsd,isLlmEnriched,sourceKey,lines,compareLiveModelOutputs,rightBySource,pairs,agreeing,buildLiveModelComparison,models,passing,pick,measured,renderLiveModelComparison,sumUsage,values,round
    LiveModelRun:
    LiveModelMeasurement:
    LiveModelAgreement:
    LiveModelComparison:
    measureLiveModelRun()
    responses()
    records()
    enrichedRecords()
    costUsd()
    isLlmEnriched()
    sourceKey()
    lines()
    compareLiveModelOutputs()
    rightBySource()
    pairs()
    agreeing()
    buildLiveModelComparison()
    models()
    passing()
    pick()
    measured()
    renderLiveModelComparison()
    sumUsage()
    values()
    round()
  src/communication/llm.ts:
    i: ../config/env.js,../core/id.js,../core/io.js,../core/record.js,../llm/audit.js,../llm/failure.js,../llm/openrouter.js,../llm/structured-schema.js,../version.js,node:fs,node:path,node:url
    e: RawCommunicationEnrichment,RawParticipantSynthesis,RawCommunicationResponse,ParticipantCommunicationSynthesis,AuditedCommunicationExtractionResult,CommunicationLlmRequiredError,CommunicationAttemptError,ParticipantGroup
    RawCommunicationEnrichment:
    RawParticipantSynthesis:
    RawCommunicationResponse:
    ParticipantCommunicationSynthesis:
    AuditedCommunicationExtractionResult:
    CommunicationLlmRequiredError: super(-1),extractCommunicationIntentAudited(-1),startedAt(-1),deterministic(-1),records(-1),client(-1),groups(-1),response(-1),enrichments(-1),enrichedByOriginal(-1),generation(-1),participants(-1),failure(-1),responses(-1),classifyLlmFailure(-1)
    CommunicationAttemptError: super(-1),enrichWithCorrection(-1),completion(-1),fallbackOrThrow(-1),failed(-1),marked(-1),participantGroups(-1),grouped(-1),participant(-1),role(-1),key(-1),values(-1),promptPayload(-1),validateEnrichments(-1),expected(-1),output(-1),materializeSyntheses(-1),byKey(-1),seen(-1),output(-1),group(-1),permitted(-1),recordIds(-1),enrichRecord(-1),deterministicSyntheses(-1),synthesis(-1),markDeterministic(-1),marked(-1),deterministicGeneration(-1),fallbackGeneration(-1),llmGeneration(-1),audit(-1),roleOf(-1),sortedUnique(-1),readPrompt(-1),promptPath(-1),communicationStrings(-1),COMMUNICATION_ENRICHMENT_CONTRACT(-1),PARTICIPANT_SYNTHESIS_CONTRACT(-1),COMMUNICATION_RESPONSE_CONTRACT(-1)
    ParticipantGroup:
  src/extractors/changelog.ts:
    i: ../config/env.js,../core/io.js,../core/record.js,../core/types.js,./markdown-block.js,./markdown-paths.js,node:path
    e: extractChangelog,absolute,body,relative,lines,raw,versionHeading,categoryHeading,bullet,block,text,action,resolvedPaths,changelogAction,normalized,lower
    extractChangelog()
    absolute()
    body()
    relative()
    lines()
    raw()
    versionHeading()
    categoryHeading()
    bullet()
    block()
    text()
    action()
    resolvedPaths()
    changelogAction()
    normalized()
    lower()
  src/graph/diff.ts:
    i: ../core/id.js,../core/schema.js
    e: DiffSvgOptions,diffIntentGraphs,beforeById,afterById,unchangedRecords,beforeGroups,afterGroups,left,right,paired,beforeRecord,afterRecord,beforeRelations,afterRelations,fingerprint,renderGraphDiffSvg,maxItems,title,visibleRows,width,height,y,assertGraph,groupRecords,groups,identity,values,recordIdentity,normalizeRecord,changedFieldPaths,isObject,relationKey,compareRecords,compareRelations,recordLabel,changeLabel,metricCard,escapeXml,truncate
    DiffSvgOptions:
    diffIntentGraphs()
    beforeById()
    afterById()
    unchangedRecords()
    beforeGroups()
    afterGroups()
    left()
    right()
    paired()
    beforeRecord()
    afterRecord()
    beforeRelations()
    afterRelations()
    fingerprint()
    renderGraphDiffSvg()
    maxItems()
    title()
    visibleRows()
    width()
    height()
    y()
    assertGraph()
    groupRecords()
    groups()
    identity()
    values()
    recordIdentity()
    normalizeRecord()
    changedFieldPaths()
    isObject()
    relationKey()
    compareRecords()
    compareRelations()
    recordLabel()
    changeLabel()
    metricCard()
    escapeXml()
    truncate()
  src/services/branch-portfolio-assembler.ts:
    i: ../core/id.js,../core/schema.js,../core/types.js,../graph/diff.js
    e: BranchSemanticTreeBundle,BranchPortfolioAssembly,CandidateSemanticState,AssertionMapping,assembleBranchPortfolio,bundles,baseBundle,states,stateByRef,indexSemanticBundles,bundles,missing,extra,validateSemanticBundle,buildCandidateState,diff,mapping,semanticEvidence,baseSemanticConflict,mapAssertionChanges,baseAssertions,candidateByBase,afterToBefore,anchors,values,mapped,assertionAnchors,anchors,baseRecord,anchor,changeFromAssertions,changedIdentityIsAmbiguous,counts,count,semanticCompleteness,changedConflictCitations,conflicted,assertionId,buildPairEvidence,complete,semanticConflict,pairConflictCitations,leftChange,rightChange,removalConflict,explicitConflict,citationsForChanges,requiredBundle,bundle,requiredState,state,requiredAssertionId,id,uniqueAssertions,unique,uniqueSorted,cloneEmptyCitations,requireExactKeys
    BranchSemanticTreeBundle:
    BranchPortfolioAssembly:
    CandidateSemanticState:
    AssertionMapping:
    assembleBranchPortfolio()
    bundles()
    baseBundle()
    states()
    stateByRef()
    indexSemanticBundles()
    bundles()
    missing()
    extra()
    validateSemanticBundle()
    buildCandidateState()
    diff()
    mapping()
    semanticEvidence()
    baseSemanticConflict()
    mapAssertionChanges()
    baseAssertions()
    candidateByBase()
    afterToBefore()
    anchors()
    values()
    mapped()
    assertionAnchors()
    anchors()
    baseRecord()
    anchor()
    changeFromAssertions()
    changedIdentityIsAmbiguous()
    counts()
    count()
    semanticCompleteness()
    changedConflictCitations()
    conflicted()
    assertionId()
    buildPairEvidence()
    complete()
    semanticConflict()
    pairConflictCitations()
    leftChange()
    rightChange()
    removalConflict()
    explicitConflict()
    citationsForChanges()
    requiredBundle()
    bundle()
    requiredState()
    state()
    requiredAssertionId()
    id()
    uniqueAssertions()
    unique()
    uniqueSorted()
    cloneEmptyCitations()
    requireExactKeys()
  src/synthesis/validation.ts:
    i: ../core/schema.js,../core/types.js
    e: TodoProposalDuplicate,TodoProposalValidationResult,validateAndClassifyTodoProposals,existing,duplicates,orderedProposalIds,duplicateProposalIds,duplicateIds,duplicateEvidence,proposalWords,target,sharedTicket,sharedSymbol,sharedPath,similarity,dependencyFirstPriorityOrder,byId,remainingDependencies,dependents,values,compare,left,right,ready,id,remaining,words,jaccard,common,intersects,values
    TodoProposalDuplicate:
    TodoProposalValidationResult:
    validateAndClassifyTodoProposals()
    existing()
    duplicates()
    orderedProposalIds()
    duplicateProposalIds()
    duplicateIds()
    duplicateEvidence()
    proposalWords()
    target()
    sharedTicket()
    sharedSymbol()
    sharedPath()
    similarity()
    dependencyFirstPriorityOrder()
    byId()
    remainingDependencies()
    dependents()
    values()
    compare()
    left()
    right()
    ready()
    id()
    remaining()
    words()
    jaccard()
    common()
    intersects()
    values()
  src/core/branch-portfolio.ts:
    i: ./id.js
    e: BranchCitationSet,BranchAssertionChange,BranchBaseEvidence,BranchCandidateEvidence,BranchPairEvidence,BranchPortfolioEvidence,BranchCandidateResult,BranchInteractionResult,BranchPortfolio,MAX_CANDIDATES,MAX_ASSERTION_CHANGES,TEXTUAL_MERGES,COMPLETENESS,CHANGE_KINDS,ORDERINGS,projectBranchPortfolio,portfolio,assertBranchPortfolioEvidence,candidates,assertBranchPortfolio,expected,buildPortfolio,candidateIndex,interactions,validateBase,validateCandidates,candidates,validateCandidate,validatePullRequests,seen,validateAssertionChanges,seen,assertionId,validateConflict,allowed,other,validateConflictDetails,records,relations,validateCitations,allowedKeys,validatePairs,observed,key,expected,validatePair,left,right,validatePairCitations,validateOrderingEvidence,ordered,buildInteraction,left,right,sharedAssertionIds,classifyInteraction,buildCandidate,relevant,reasons,changes,recommendationFor,candidateReasons,reasons,addInteractionReason,hasCandidateConflict,waitsForCandidate,normalizePair,ordering,canonicalChanges,canonicalCitations,buildStats,byClassification,byRecommendation,emptyClassificationCounts,emptyRecommendationCounts,portfolioFingerprint,assertionIds,isDuplicateIdentity,hasConflict,expectedPairKeys,leftName,rightName,pairKey,intersection,values,uniqueSorted,requireExactKeys,requireRepository,requireBranchName,malformed,requireSha,requireDigest,requireCount,requireText,requireUniqueIds,seen,requireSubset,requireEnum,requireDateTime,parsed,compareById
    BranchCitationSet:
    BranchAssertionChange:
    BranchBaseEvidence:
    BranchCandidateEvidence:
    BranchPairEvidence:
    BranchPortfolioEvidence:
    BranchCandidateResult:
    BranchInteractionResult:
    BranchPortfolio:
    MAX_CANDIDATES()
    MAX_ASSERTION_CHANGES()
    TEXTUAL_MERGES()
    COMPLETENESS()
    CHANGE_KINDS()
    ORDERINGS()
    projectBranchPortfolio()
    portfolio()
    assertBranchPortfolioEvidence()
    candidates()
    assertBranchPortfolio()
    expected()
    buildPortfolio()
    candidateIndex()
    interactions()
    validateBase()
    validateCandidates()
    candidates()
    validateCandidate()
    validatePullRequests()
    seen()
    validateAssertionChanges()
    seen()
    assertionId()
    validateConflict()
    allowed()
    other()
    validateConflictDetails()
    records()
    relations()
    validateCitations()
    allowedKeys()
    validatePairs()
    observed()
    key()
    expected()
    validatePair()
    left()
    right()
    validatePairCitations()
    validateOrderingEvidence()
    ordered()
    buildInteraction()
    left()
    right()
    sharedAssertionIds()
    classifyInteraction()
    buildCandidate()
    relevant()
    reasons()
    changes()
    recommendationFor()
    candidateReasons()
    reasons()
    addInteractionReason()
    hasCandidateConflict()
    waitsForCandidate()
    normalizePair()
    ordering()
    canonicalChanges()
    canonicalCitations()
    buildStats()
    byClassification()
    byRecommendation()
    emptyClassificationCounts()
    emptyRecommendationCounts()
    portfolioFingerprint()
    assertionIds()
    isDuplicateIdentity()
    hasConflict()
    expectedPairKeys()
    leftName()
    rightName()
    pairKey()
    intersection()
    values()
    uniqueSorted()
    requireExactKeys()
    requireRepository()
    requireBranchName()
    malformed()
    requireSha()
    requireDigest()
    requireCount()
    requireText()
    requireUniqueIds()
    seen()
    requireSubset()
    requireEnum()
    requireDateTime()
    parsed()
    compareById()
  src/synthesis/tasks-llm.ts:
    i: ../config/env.js,../core/id.js,../core/io.js,../core/schema.js,../llm/audit.js,../llm/failure.js,../llm/openrouter.js,../llm/structured-schema.js,../version.js,./task-synthesis-contract.js,./task-synthesis-materialize.js,./task-synthesis-payload.js,node:fs,node:path,node:url
    e: RawDiagnosticAction,AuditedTaskSynthesisResult,TaskSynthesisRequiredError,TaskSynthesisAttemptError
    RawDiagnosticAction:
    AuditedTaskSynthesisResult:
    TaskSynthesisRequiredError: super(-1)
    TaskSynthesisAttemptError: super(-1),synthesizeTodoProposals(-1),startedAt(-1),assertConclusions(-1),client(-1),prompt(-1),payload(-1),failure(-1),responses(-1),synthesizeWithCorrection(-1),generation(-1),message(-1),wrapped(-1),fallbackOrThrow(-1),failedAudit(-1),rawDiagnosticActions(-1),generationMetadata(-1),configuration(-1),synthesisAudit(-1),readPrompt(-1),promptPath(-1)
  src/interfaces/a2a-task-store.ts:
    i: ../config/env.js,../core/security.js,../services/actions.js,./intake-actions.js,node:crypto,node:fs,node:path,node:timers/promises
    e: PreparedTask,ListCursor,TaskStoreSnapshot,tasks,messageTaskIndex,clearA2aTaskStoreForTests,handleA2aRpc,handleRpcInTaskStore,params,sendMessage,message,sendConfiguration,prepared,getTask,task,historyLength,cancelTask,task,fullTaskView,scheduleTaskExecution,task,withTaskStore,storePath,release,result,configuredTaskStorePath,acquireTaskStoreLock,deadline,removeLock,removeStaleLock,stat,loadTaskStore,content,snapshot,restored,readTaskStore,stat,restoreTask,assertStoredTask,saveTaskStore,removeTemporaryFile,prepareTask,key,indexedTask,taskForMessage,indexedTaskId,task,continueTask,existing,continuationError,message,createTask,taskId,contextId,executeMessage,command,result,domainResult,rejectTask,protobuf,diagnostic,message,currentTaskState,completeTask,protobuf,message,protobufResult,intakeDomainResult,record,failTask,message,agentMessage,listTasks,contextId,status,pageSize,historyLength,includeArtifacts,statusTimestampAfter,filter,filtered,pageCursor,start,page,last,filteredTasks,compareTasksByUpdate,timestampOrder,indexAfterCursor,exact,cursorTime,next,taskTime,encodeCursor,decodeCursor,decoded,taskView,effectiveHistoryLength,history,cloneArtifact,ownedTask,task,messageKey,errorMessage
    PreparedTask:
    ListCursor:
    TaskStoreSnapshot:
    tasks()
    messageTaskIndex()
    clearA2aTaskStoreForTests()
    handleA2aRpc()
    handleRpcInTaskStore()
    params()
    sendMessage()
    message()
    sendConfiguration()
    prepared()
    getTask()
    task()
    historyLength()
    cancelTask()
    task()
    fullTaskView()
    scheduleTaskExecution()
    task()
    withTaskStore()
    storePath()
    release()
    result()
    configuredTaskStorePath()
    acquireTaskStoreLock()
    deadline()
    removeLock()
    removeStaleLock()
    stat()
    loadTaskStore()
    content()
    snapshot()
    restored()
    readTaskStore()
    stat()
    restoreTask()
    assertStoredTask()
    saveTaskStore()
    removeTemporaryFile()
    prepareTask()
    key()
    indexedTask()
    taskForMessage()
    indexedTaskId()
    task()
    continueTask()
    existing()
    continuationError()
    message()
    createTask()
    taskId()
    contextId()
    executeMessage()
    command()
    result()
    domainResult()
    rejectTask()
    protobuf()
    diagnostic()
    message()
    currentTaskState()
    completeTask()
    protobuf()
    message()
    protobufResult()
    intakeDomainResult()
    record()
    failTask()
    message()
    agentMessage()
    listTasks()
    contextId()
    status()
    pageSize()
    historyLength()
    includeArtifacts()
    statusTimestampAfter()
    filter()
    filtered()
    pageCursor()
    start()
    page()
    last()
    filteredTasks()
    compareTasksByUpdate()
    timestampOrder()
    indexAfterCursor()
    exact()
    cursorTime()
    next()
    taskTime()
    encodeCursor()
    decodeCursor()
    decoded()
    taskView()
    effectiveHistoryLength()
    history()
    cloneArtifact()
    ownedTask()
    task()
    messageKey()
    errorMessage()
  src/communication/intake-store.ts:
    i: ../core/io.js,../core/security.js,node:crypto,node:fs,node:path
    e: IntakeEvent,StreamSnapshot,IntakeEventStore
    IntakeEvent:
    StreamSnapshot:
    IntakeEventStore: read(-1),names(-1),name(-1),eventPath(-1),stat(-1),event(-1),lockPath(-1),stream(-1),existing(-1),writeRegistry(-1),projectionPath(-1),slug(-1),atomicWrite(-1),safe(-1),temp(-1),assertSafe(-1),hashEvent(-1),broken(-1),unsafe(-1)
  scripts/workspace-preflight.mjs:
    e: parseArguments,values,option,value,optionValue,main,report,message
    parseArguments()
    values()
    option()
    value()
    optionValue()
    main()
    report()
    message()
  scripts/verify-workflow-yaml.mjs:
    i: node:fs,node:path
    e: explicit,files,body,seen,match,key,previous,workflowFiles,directory
    explicit()
    files()
    body()
    seen()
    match()
    key()
    previous()
    workflowFiles()
    directory()
  scripts/research/audit-changelog-sample.mjs:
    i: node:child_process,node:fs,node:path
    e: options,entries,root,latest,runDirectory,diagnostics,graph,recordsById,findings,selected,trackedFiles,classification,labelCounts,labelRepositories,stratifiedSample,groups,values,added,record,targetClass,target,classify,text,file,exactFileUpdate,match,candidate,basename,pathOwners,file,countBy,item,readJson,parseArgs,value,index,limitIndex,limit,intentDirectoryIndex,intentDirectory
    options()
    entries()
    root()
    latest()
    runDirectory()
    diagnostics()
    graph()
    recordsById()
    findings()
    selected()
    trackedFiles()
    classification()
    labelCounts()
    labelRepositories()
    stratifiedSample()
    groups()
    values()
    added()
    record()
    targetClass()
    target()
    classify()
    text()
    file()
    exactFileUpdate()
    match()
    candidate()
    basename()
    pathOwners()
    file()
    countBy()
    item()
    readJson()
    parseArgs()
    value()
    index()
    limitIndex()
    limit()
    intentDirectoryIndex()
    intentDirectory()
  sdk/php/src/Client.php:
    e: Client
    Client:
  sdk/python/examples/basic.py:
    e: main
    main()
  examples/backend/src/validation.ts:
    e: ValidationResult,ALLOWED_ACTIONS,validateEventPayload,invalid,record,agent,action,object
    ValidationResult:
    ALLOWED_ACTIONS()
    validateEventPayload()
    invalid()
    record()
    agent()
    action()
    object()
  src/extractors/nl.ts:
    i: ../config/env.js,../core/io.js,../core/record.js,../core/types.js,../tf/classifier.js,node:path
    e: NlExtractionOptions,assertNlExtractionOptions,extractNlIntent,absolute,body,sourcePath,classified,action,object,missing,confidence,inferActor,detectMissingFields
    NlExtractionOptions:
    assertNlExtractionOptions()
    extractNlIntent()
    absolute()
    body()
    sourcePath()
    classified()
    action()
    object()
    missing()
    confidence()
    inferActor()
    detectMissingFields()
  src/extractors/markdown-block.ts:
    e: MarkdownListBlock,readListBlock,cursor,line
    MarkdownListBlock:
    readListBlock()
    cursor()
    line()
  java/JavaAstExtract.java:
    i: com.sun.source.util.JavacTask,com.sun.source.util.SourcePositions,com.sun.source.util.TreePathScanner,com.sun.source.util.Trees,java.io.IOException,java.nio.charset.StandardCharsets,java.nio.file.Files,java.nio.file.Path,java.nio.file.Paths
    e: JavaAstExtract
    JavaAstExtract: main(-1),emit(-1),parseFile(-1),emit(-1),collect(-1),try(-1),containsIgnored(-1),try(-1),Collector(-1),add(-1),map(-1),add(-1),map(-1),add(-1),add(-1),add(-1),add(-1),map(-1),add(-1),map(-1),emit(-1),json(-1),json(-1),escape(-1),slash(-1)
  src/extractors/configuration.ts:
    i: ../config/env.js,../core/ignore.js,../core/io.js,../core/record.js,../core/schema.js,../core/types.js,node:path
    e: Config2DslOptions,ConfigurationEntry,MAX_ENTRIES_PER_FILE,config2dsl,root,result,extractConfigurationIntent,root,matcher,discovered,files,relative,body,isConfigurationPath,base,configurationRecords,base,entries,bounded,fileAggregate,format,lastLine,configurationFormat,base,jsonEntries,parsed,lines,tomlEntries,line,heading,pair,yamlOrAssignmentEntries,yaml,assignment,key,dockerEntries,match,instruction,detail,entry,uniqueEntries,seen,findKeyLine,pattern,index,requireStandaloneRoot
    Config2DslOptions:
    ConfigurationEntry:
    MAX_ENTRIES_PER_FILE()
    config2dsl()
    root()
    result()
    extractConfigurationIntent()
    root()
    matcher()
    discovered()
    files()
    relative()
    body()
    isConfigurationPath()
    base()
    configurationRecords()
    base()
    entries()
    bounded()
    fileAggregate()
    format()
    lastLine()
    configurationFormat()
    base()
    jsonEntries()
    parsed()
    lines()
    tomlEntries()
    line()
    heading()
    pair()
    yamlOrAssignmentEntries()
    yaml()
    assignment()
    key()
    dockerEntries()
    match()
    instruction()
    detail()
    entry()
    uniqueEntries()
    seen()
    findKeyLine()
    pattern()
    index()
    requireStandaloneRoot()
  src/graph/capability-evidence.ts:
    i: ../core/text.js,../core/types.js
    e: STRUCTURAL_TOPICS,declaredCapabilityTopics,topics,locationTopics,aggregateCapabilityTopics,values,aggregateCapabilityOverlap,aggregate,declaration,requested,implemented,overlap,hasCapabilityClaim,isFileAggregate
    STRUCTURAL_TOPICS()
    declaredCapabilityTopics()
    topics()
    locationTopics()
    aggregateCapabilityTopics()
    values()
    aggregateCapabilityOverlap()
    aggregate()
    declaration()
    requested()
    implemented()
    overlap()
    hasCapabilityClaim()
    isFileAggregate()
  src/core/ignore.ts:
    i: node:fs,node:path
    e: IgnoreRule,IgnoreMatcher,LoadIgnoreOptions,compileIgnorePattern,pattern,negated,directoryOnly,anchored,body,prefix,translateGlob,char,next,close,body,escapeLiteral,parseIgnoreFile,createIgnoreMatcher,normalize,decide,target,segments,ancestor,loadIgnoreMatcher,files,absolute,rule
    IgnoreRule:
    IgnoreMatcher:
    LoadIgnoreOptions:
    compileIgnorePattern()
    pattern()
    negated()
    directoryOnly()
    anchored()
    body()
    prefix()
    translateGlob()
    char()
    next()
    close()
    body()
    escapeLiteral()
    parseIgnoreFile()
    createIgnoreMatcher()
    normalize()
    decide()
    target()
    segments()
    ancestor()
    loadIgnoreMatcher()
    files()
    absolute()
    rule()
  src/llm/structured-schema.ts:
    i: ../core/types.js
    e: StructuredSchema,StructuredResponseError,StringOptions,NumberOptions,ArrayOptions
    StructuredSchema:
    StructuredResponseError: super(-1),schema(-1),parse(-1),string(-1),pattern(-1),fail(-1),fail(-1),nullableString(-1),base(-1),number(-1),fail(-1),checkNumberBounds(-1),integer(-1),numeric(-1),parsed(-1),enumValue(-1),allowed(-1),fail(-1),array(-1),fail(-1),fail(-1),parsed(-1),identities(-1),object(-1),keys(-1),allowed(-1),fail(-1),candidate(-1),unknown(-1),missing(-1),checkNumberBounds(-1),fail(-1),fail(-1),jsonIdentity(-1),record(-1),describe(-1),fail(-1)
    StringOptions:
    NumberOptions:
    ArrayOptions:
  src/llm/subllm.ts:
    i: node:child_process,node:fs,node:path,node:util
    e: SubllmPublicRoute,ResolvedSubllmRoute,execFileAsync,FALSE_VALUES,TRUE_VALUES,lastResolvedSubllmRoute,shouldUseSubllm,explicit,resolveSubllmRoute,commandEnvironment,python,routeOutput,route,credential,localSubllmPythonPath,candidate,requireFile,stat,subllmCommandEnvironment,pythonPath,inherited,resolvedPythonPath,parsePublicRoute,route,provider,extraHeaders,requiredString,value,requiredNumber,value,requiredHttpsUrl,value,parsed,requiredEnvName,value,isRecord,credentialFromSharedFile,envPath,stat,message,parseCredential,values,value,credentialAssignment,line,separator,unquoteCredential,doubleQuoted,singleQuoted,redactDiagnostic,runSubllm,result,error
    SubllmPublicRoute:
    ResolvedSubllmRoute:
    execFileAsync()
    FALSE_VALUES()
    TRUE_VALUES()
    lastResolvedSubllmRoute()
    shouldUseSubllm()
    explicit()
    resolveSubllmRoute()
    commandEnvironment()
    python()
    routeOutput()
    route()
    credential()
    localSubllmPythonPath()
    candidate()
    requireFile()
    stat()
    subllmCommandEnvironment()
    pythonPath()
    inherited()
    resolvedPythonPath()
    parsePublicRoute()
    route()
    provider()
    extraHeaders()
    requiredString()
    value()
    requiredNumber()
    value()
    requiredHttpsUrl()
    value()
    parsed()
    requiredEnvName()
    value()
    isRecord()
    credentialFromSharedFile()
    envPath()
    stat()
    message()
    parseCredential()
    values()
    value()
    credentialAssignment()
    line()
    separator()
    unquoteCredential()
    doubleQuoted()
    singleQuoted()
    redactDiagnostic()
    runSubllm()
    result()
    error()
  src/interfaces/a2a-types.ts:
    i: ../services/actions.js,./intake-actions.js
    e: JsonRpcRequest,A2APart,A2AMessage,A2AArtifact,A2ATask,StoredTask,SendConfiguration,A2ARequestError,BodyTooLargeError,TERMINAL_TASK_STATES,TASK_STATES
    JsonRpcRequest:
    A2APart:
    A2AMessage:
    A2AArtifact:
    A2ATask:
    StoredTask:
    SendConfiguration:
    A2ARequestError: super(-1)
    BodyTooLargeError: stringParam(-1),optionalString(-1),optionalStringArray(-1),optionalInteger(-1),parsed(-1),optionalBoolean(-1),optionalTimestamp(-1),timestamp(-1),optionalTaskState(-1),recordParam(-1),isRecord(-1)
    TERMINAL_TASK_STATES()
    TASK_STATES()
  src/interfaces/mcp-tools.ts:
    i: ../config/env.js,../services/actions.js,./intake-actions.js,./mcp-errors.js
    e: McpTool,callMcpTool,name,args,result,tool,writes,stringProp,nullableStringProp,stringArrayProp,numberProp
    McpTool:
    callMcpTool()
    name()
    args()
    result()
    tool()
    writes()
    stringProp()
    nullableStringProp()
    stringArrayProp()
    numberProp()
  src/summary/render.ts:
    i: ../core/types.js
    e: renderSummaryMarkdown,plans,git,moduleFacts,facts,releases,communication,actions,compareConclusions,renderRecords,confidence,renderConclusion,confidence,recordCitations
    renderSummaryMarkdown()
    plans()
    git()
    moduleFacts()
    facts()
    releases()
    communication()
    actions()
    compareConclusions()
    renderRecords()
    confidence()
    renderConclusion()
    confidence()
    recordCitations()
  src/summary/summarizer.ts:
    i: ../config/env.js,../core/grounding.js,../core/id.js,../core/io.js,../core/schema.js,../llm/audit.js,../llm/openrouter.js,../llm/structured-schema.js,../version.js,./payload.js,./render.js,node:fs,node:path,node:url
    e: SummaryResult,SummaryOptions,RawConclusion,RawSummaryResponse,SummaryAttemptError,summarizeGraph,mode,conclusions,client,conclusions,systemPrompt,payload,failure,responses,conclusions,SUMMARY_CONCLUSION_CONTRACT,SUMMARY_RESPONSE_CONTRACT
    SummaryResult:
    SummaryOptions:
    RawConclusion:
    RawSummaryResponse:
    SummaryAttemptError: super(-1),summarizeWithCorrection(-1),conclusions(-1),generationMetadata(-1),message(-1),materializeConclusions(-1),parsed(-1),conclusions(-1),diagnosticIds(-1),assertConclusions(-1),deterministicConclusions(-1),conclusions(-1),assertConclusions(-1),generationMetadata(-1),effectiveMode(-1),degraded(-1),configuration(-1),summaryMode(-1),sortedUnique(-1),readPrompt(-1),promptPath(-1)
    summarizeGraph()
    mode()
    conclusions()
    client()
    conclusions()
    systemPrompt()
    payload()
    failure()
    responses()
    conclusions()
    SUMMARY_CONCLUSION_CONTRACT()
    SUMMARY_RESPONSE_CONTRACT()
  src/operations/compile-cli.ts:
    i: ./artifact.js
    e: argumentsByName,key,value,allowed,unknown,main,args
    argumentsByName()
    key()
    value()
    allowed()
    unknown()
    main()
    args()
  src/interfaces/intake_cli.py:
    e: _varint,_read_varint,encode_envelope,decode_envelope,execute,main
    _varint(value)
    _read_varint(data;offset)
    encode_envelope(envelope)
    decode_envelope(data)
    execute(args)
    main()
  rust-ast/src/main.rs:
    i: proc_macro2::Span,quote::ToTokens,serde::Serialize,serde_json::,std::collections::BTreeSet,std::env,std::fs,std::path::,syn::spanned::Spanned,syn::visit::
    e: Fact,Output,Collector,main,arguments,collect_files,new,qualified,add,excerpt,modifiers,visit_item_mod,visit_item_use,visit_item_struct,visit_item_enum,visit_item_trait,visit_item_type,visit_item_const,visit_item_static,visit_item_fn,visit_item_impl,visit_impl_item_fn,visit_expr_call,visit_expr_method_call
    Fact:
    Output:
    Collector:
    main()
    arguments()
    collect_files()
    new()
    qualified()
    add()
    excerpt()
    modifiers()
    visit_item_mod()
    visit_item_use()
    visit_item_struct()
    visit_item_enum()
    visit_item_trait()
    visit_item_type()
    visit_item_const()
    visit_item_static()
    visit_item_fn()
    visit_item_impl()
    visit_impl_item_fn()
    visit_expr_call()
    visit_expr_method_call()
  src/extractors/runtime-cycle.ts:
    i: ../config/env.js,../core/io.js,../core/record.js,node:path
    e: CycleContext,MAX_PER_SECTION,extractRuntimeCycleIntent,cyclePath,root,body,cycle,sourcePath,observedAt,host,results,parseCycle,cycle,sourcePathFor,relative,boundedArray,objects,label,text,tags,watched,declared,probeRecord,id,failed,error,outcome,violationRecord,probe,fact,driftRecord,probe,fact,proposalRecord,kind,probe,detail,proposalAction,factsMetadata,jsonScalar
    CycleContext:
    MAX_PER_SECTION()
    extractRuntimeCycleIntent()
    cyclePath()
    root()
    body()
    cycle()
    sourcePath()
    observedAt()
    host()
    results()
    parseCycle()
    cycle()
    sourcePathFor()
    relative()
    boundedArray()
    objects()
    label()
    text()
    tags()
    watched()
    declared()
    probeRecord()
    id()
    failed()
    error()
    outcome()
    violationRecord()
    probe()
    fact()
    driftRecord()
    probe()
    fact()
    proposalRecord()
    kind()
    probe()
    detail()
    proposalAction()
    factsMetadata()
    jsonScalar()
  src/extractors/ast/external.ts:
    i: ../../core/io.js,../../core/types.js,./records.js,./types.js,node:child_process,node:util
    e: ExternalAdapterOptions,execFileAsync,runExternalAstAdapter,files,result,parsed
    ExternalAdapterOptions:
    execFileAsync()
    runExternalAstAdapter()
    files()
    result()
    parsed()
  src/core/target.ts:
    i: ./types.js
    e: GENERIC_SYMBOLS,GENERIC_FILES,normalizeTarget,normalizePath,normalizeSymbol,symbolAliases,normalized,parts,leaf,pathAliases,normalized,basename,unique
    GENERIC_SYMBOLS()
    GENERIC_FILES()
    normalizeTarget()
    normalizePath()
    normalizeSymbol()
    symbolAliases()
    normalized()
    parts()
    leaf()
    pathAliases()
    normalized()
    basename()
    unique()
  src/interfaces/mcp.ts:
    i: ../config/env.js,./mcp-errors.js,./mcp-resources.js,./mcp-tools.js,node:path,node:readline,node:url
    e: JsonRpcRequest,McpConnectionState,DISCOVERY_TTL_MS,LIST_TTL_MS,RESOURCE_TTL_MS,createMcpConnectionState,startMcpServer,resolvedConfig,state,input,parsed,request,result,handleMcpRequest,initializeLegacy,params,requested,protocolVersion,handleModernRequest,params,responseMeta,handleLegacyRequest,params,validateModernRequest,params,meta,validateModernMetadata,requested,capabilities,hasModernMetadata,meta,parseRequestLine,completePublic,serverInfo,serverMeta,serverInstructions,isLegacyProtocol,isJsonRpcRequest,candidate,requestId,id,rpcError,sendError,send,invokedPath
    JsonRpcRequest:
    McpConnectionState:
    DISCOVERY_TTL_MS()
    LIST_TTL_MS()
    RESOURCE_TTL_MS()
    createMcpConnectionState()
    startMcpServer()
    resolvedConfig()
    state()
    input()
    parsed()
    request()
    result()
    handleMcpRequest()
    initializeLegacy()
    params()
    requested()
    protocolVersion()
    handleModernRequest()
    params()
    responseMeta()
    handleLegacyRequest()
    params()
    validateModernRequest()
    params()
    meta()
    validateModernMetadata()
    requested()
    capabilities()
    hasModernMetadata()
    meta()
    parseRequestLine()
    completePublic()
    serverInfo()
    serverMeta()
    serverInstructions()
    isLegacyProtocol()
    isJsonRpcRequest()
    candidate()
    requestId()
    id()
    rpcError()
    sendError()
    send()
    invokedPath()
  src/interfaces/a2a.ts:
    i: ../config/env.js,../services/actions.js,../web/diff-ui.js,./a2a-card.js,./a2a-history.js,./a2a-task-store.js,node:crypto,node:http,node:path,node:url
    e: startA2aServer,resolvedConfig,server,address,port,handleHttp,url,handlePublicGet,handleAuthenticatedApi,handleDiffApi,input,handleJsonRpc,rpc,isNotification,result,parseRpcRequest,status,sendRpcFailure,code,metadata,status,requireAuthorization,requireProtocolVersion,requestedVersion,a2aVersion,raw,headerVersion,isLoopbackHost,value,authorized,header,received,expected,principalForRequest,readBody,length,chunk,sendJson,payload,sendText,sendNoContent,rpcError,reason,errorInfo,stringMetadata,handleUnexpectedError,errorMessage,invokedPath
    startA2aServer()
    resolvedConfig()
    server()
    address()
    port()
    handleHttp()
    url()
    handlePublicGet()
    handleAuthenticatedApi()
    handleDiffApi()
    input()
    handleJsonRpc()
    rpc()
    isNotification()
    result()
    parseRpcRequest()
    status()
    sendRpcFailure()
    code()
    metadata()
    status()
    requireAuthorization()
    requireProtocolVersion()
    requestedVersion()
    a2aVersion()
    raw()
    headerVersion()
    isLoopbackHost()
    value()
    authorized()
    header()
    received()
    expected()
    principalForRequest()
    readBody()
    length()
    chunk()
    sendJson()
    payload()
    sendText()
    sendNoContent()
    rpcError()
    reason()
    errorInfo()
    stringMetadata()
    handleUnexpectedError()
    errorMessage()
    invokedPath()
  src/pipeline/event-log-persistence.ts:
    i: ../core/id.js,../core/types.js,node:child_process,node:crypto,node:fs,node:path,node:util
    e: execFileAsync,persistPipelineEventLog,manifestPath,manifest,manifestEvidence,identity,events,document,output,canonicalPipelineManifestEvidence,baseEvents,pipelineIdentity,resolvedRoot,git,result,repositoryFromRemote,url,parts,appendDiagnosticEvent,relative,diagnosticsPath,blocking,count,parsed,evidenceError
    execFileAsync()
    persistPipelineEventLog()
    manifestPath()
    manifest()
    manifestEvidence()
    identity()
    events()
    document()
    output()
    canonicalPipelineManifestEvidence()
    baseEvents()
    pipelineIdentity()
    resolvedRoot()
    git()
    result()
    repositoryFromRemote()
    url()
    parts()
    appendDiagnosticEvent()
    relative()
    diagnosticsPath()
    blocking()
    count()
    parsed()
    evidenceError()
  sdk/go/client.go:
    e: Client,rpcRequest,rpcResponse,New,nextID,setHeaders,RPC,Send,unwrapTask,Call,Health,AgentCard,getJSON
    Client:
    rpcRequest:
    rpcResponse:
    New()
    nextID()
    setHeaders()
    RPC()
    Send()
    unwrapTask()
    Call()
    Health()
    AgentCard()
    getJSON()
  scripts/research/evaluate-embedding-pairs.py:
    e: parse_args,main
    parse_args()
    main()
  sdk/python/todo2code/runtime.py:
    e: TypeScriptRuntimeError,RuntimeResult,TypeScriptRuntime,_resolve_cli,_parse_mapping,_load_mapping
    TypeScriptRuntimeError(RuntimeError):  # Raised when the local Node/TypeScript runtime cannot be exec...
    RuntimeResult:  # Raw result of a local TypeScript CLI invocation...
    TypeScriptRuntime: __init__(1),invoke(1),version(0),pipeline(0),diagnose(1),diff_graphs(2),reality(1)  # Execute the canonical TypeScript runtime from a Python proce...
    _resolve_cli(value)
    _parse_mapping(content;label)
    _load_mapping(path;label)
  src/graph/changelog-signal.ts:
    i: ../core/types.js
    e: GENERATED_ANALYSIS_BASENAMES,isActionableChangelogRecord,text,paths,isPlaceholder,isFileSummary,isFileOnlyUpdate,match,candidate,basename,isGeneratedAnalysisPath,segments,basename
    GENERATED_ANALYSIS_BASENAMES()
    isActionableChangelogRecord()
    text()
    paths()
    isPlaceholder()
    isFileSummary()
    isFileOnlyUpdate()
    match()
    candidate()
    basename()
    isGeneratedAnalysisPath()
    segments()
    basename()
  src/extractors/docs-chunks.ts:
    i: ./docs-types.js
    e: prioritizeDocumentChunks,needles,chunkPriority,matches,mapConcurrent,results,nextIndex,worker,index,item,workerCount,chunkMarkdown,lines,sections,currentStart,currentEnd,flush,sectionLines,sectionText,candidateSize,markdownSections,sectionStart,splitLongSection,batchStart,batch,takeLineBatch,size,offset,line
    prioritizeDocumentChunks()
    needles()
    chunkPriority()
    matches()
    mapConcurrent()
    results()
    nextIndex()
    worker()
    index()
    item()
    workerCount()
    chunkMarkdown()
    lines()
    sections()
    currentStart()
    currentEnd()
    flush()
    sectionLines()
    sectionText()
    candidateSize()
    markdownSections()
    sectionStart()
    splitLongSection()
    batchStart()
    batch()
    takeLineBatch()
    size()
    offset()
    line()
  src/evaluation/analysis-policy.ts:
    i: node:crypto
    e: AnalysisBudget,AnalysisStage,AnalysisPolicy,AnalysisUsageCeiling,AnalysisCacheIdentity,AnalysisPolicyError,PolicyReader,MAX_STAGES,renderAnalysisPolicy,parseAnalysisPolicy,reader,schema,profileId,llmPolicy,cacheMode,onProviderUnavailable,onBudgetExhausted,budget,stageCount,stages,assertAnalysisPolicy,selectAnalysisStages,observed,calculateAnalysisUsageCeiling,stages,budget,analysisPolicyFingerprint,createAnalysisCacheKey,stage,estimateAnalysisCostUsd
    AnalysisBudget:
    AnalysisStage:
    AnalysisPolicy:
    AnalysisUsageCeiling:
    AnalysisCacheIdentity:
    AnalysisPolicyError: super(-1)
    PolicyReader: fail(-1),exact(-1),string(-1),stringArray(-1),integer(-1),budget(-1),done(-1),field(-1),line(-1),parseStage(-1),validateStages(-1),fail(-1),fail(-1),assertSortedUnique(-1),fail(-1),maximum(-1),assertWithinBudget(-1),validateStage(-1),oneOf(-1),oneOf(-1),oneOf(-1),assertVocabulary(-1),assertVocabulary(-1),fail(-1),fail(-1),validateBudget(-1),assertWithinBudget(-1),validateBudget(-1),validateBoundedInteger(-1),validateBoundedInteger(-1),validateBoundedInteger(-1),validateBoundedInteger(-1),assertWithinBudget(-1),fail(-1),assertVocabulary(-1),fail(-1),assertSortedUnique(-1),assertSortedUnique(-1),fail(-1),current(-1),fail(-1),sumBudgets(-1),stageLines(-1),budgetLines(-1),stringValue(-1),fail(-1),stringArrayValue(-1),fail(-1),integerValue(-1),parsed(-1),validateBoundedInteger(-1),fail(-1),validateRate(-1),requireText(-1),fail(-1),oneOf(-1),digest(-1),json(-1),fail(-1)
    MAX_STAGES()
    renderAnalysisPolicy()
    parseAnalysisPolicy()
    reader()
    schema()
    profileId()
    llmPolicy()
    cacheMode()
    onProviderUnavailable()
    onBudgetExhausted()
    budget()
    stageCount()
    stages()
    assertAnalysisPolicy()
    selectAnalysisStages()
    observed()
    calculateAnalysisUsageCeiling()
    stages()
    budget()
    analysisPolicyFingerprint()
    createAnalysisCacheKey()
    stage()
    estimateAnalysisCostUsd()
  scripts/verify-structured-responses.mjs:
    i: node:fs,node:path
    e: root,sourceRoot,files,structuredCalls,source,typescriptFiles,absolute
    root()
    sourceRoot()
    files()
    structuredCalls()
    source()
    typescriptFiles()
    absolute()
  scripts/verify-generated-analysis.mjs:
    i: node:child_process,node:fs,node:path,node:util
    e: execFileAsync,root,projectDirectory,textExtensions,untracked,tracked,generatedRelative,trackedReferences,relative,content,normalizePath,referencesAlreadyInTrackedSources,referenced,content,text
    execFileAsync()
    root()
    projectDirectory()
    textExtensions()
    untracked()
    tracked()
    generatedRelative()
    trackedReferences()
    relative()
    content()
    normalizePath()
    referencesAlreadyInTrackedSources()
    referenced()
    content()
    text()
  sdk/typescript/src/index.ts:
    e: IntentTarget,IntentStatement,IntentGenerationMetadata,IntentRecord,IntentGraph,DiagnosticReport,ExtractionAudit,ExtractionResult,A2APart,A2AMessage,A2ATask,T2CError,ClientOptions,T2CClient,unwrapTask
    IntentTarget:
    IntentStatement:
    IntentGenerationMetadata:
    IntentRecord:
    IntentGraph:
    DiagnosticReport:
    ExtractionAudit:
    ExtractionResult:
    A2APart:
    A2AMessage:
    A2ATask:
    T2CError: super(-1)
    ClientOptions:
    T2CClient: health(-1),agentCard(-1),send(-1),result(-1),call(-1),task(-1),detail(-1),part(-1),getTask(-1),cancelTask(-1),listTasks(-1),extractNl(-1),extractGit(-1),extractAst(-1),extractConfig(-1),link(-1),diagnose(-1),summarize(-1),compareWorkspace(-1),diffGraphs(-1),response(-1),body(-1),message(-1),diffFiles(-1),diffGit(-1),reality(-1),pipeline(-1),proposeTodo(-1),renderTodo(-1),applyTodo(-1),proposeCodeChange(-1),renderCodeChange(-1),proposeSourcePatch(-1),applySourcePatch(-1),evaluateCodeChange(-1),closeCodeChange(-1),rpc(-1),body(-1),response(-1),payload(-1),getJson(-1),response(-1),request(-1),controller(-1),timer(-1),clearTimeout(-1)
    unwrapTask()
  src/core/security.ts:
    i: node:fs,node:path
    e: assertPathWithinRoot,rootAbsolute,candidateAbsolute,existingAncestor,ancestorReal,assertDescendant,relative,nearestExistingPath,current,code,parent
    assertPathWithinRoot()
    rootAbsolute()
    candidateAbsolute()
    existingAncestor()
    ancestorReal()
    assertDescendant()
    relative()
    nearestExistingPath()
    current()
    code()
    parent()
  src/llm/failure.ts:
    i: ../core/types.js,./openrouter.js,./structured-schema.js
    e: LlmFailureReason,classifyLlmFailure,message,rejectedLlmResponseMetadata
    LlmFailureReason:
    classifyLlmFailure()
    message()
    rejectedLlmResponseMetadata()
  scripts/verify-module-boundaries.mjs:
    i: node:fs,node:path
    e: sourceRoot,files,graph,body,target,relative,targetRelative,visiting,visited,visit,start,collect,absolute,resolveSource,raw,relative,slash
    sourceRoot()
    files()
    graph()
    body()
    target()
    relative()
    targetRelative()
    visiting()
    visited()
    visit()
    start()
    collect()
    absolute()
    resolveSource()
    raw()
    relative()
    slash()
  sdk/python/todo2code/client.py:
    e: T2CError,IntentRecord,ExtractionResult,Diagnostic,DiagnosticReport,IntentGraph,T2CClient,_unwrap_task,_as_dict,_graph_dict,_report_dict
    T2CError(RuntimeError): __init__(3)  # Raised for JSON-RPC errors, transport failures and non-compl...
    IntentRecord: from_dict(1)  # A single t2c.intent/v1 record...
    ExtractionResult: from_dict(1)  # Records, warnings and the optional audited LLM stage result...
    Diagnostic: from_dict(1)
    DiagnosticReport: from_dict(1),blocking(0)
    IntentGraph: from_dict(1)
    T2CClient: __init__(3),_headers(1),_open(1),_rpc(2),_get(1),health(0),agent_card(0),send(2),call(2),compare_workspace(0),propose_todo(1),render_todo(1),apply_todo(1),get_task(1),cancel_task(1),list_tasks(0),extract_nl(3),extract_nl_result(3),extract_git(2),extract_ast(1),extract_config(1),extract_markdown(4),extract_markdown_result(4),extract_docs(3),extract_docs_result(3),link(1),diagnose(1),summarize(3),diff_graphs(3),diff_graphs_rest(0),diff_files(2),diff_git(0),reality(2),pipeline(0)  # Client for the todo2code A2A endpoint.

Example:
    >>> cli...
    _unwrap_task(result)
    _as_dict(value)
    _graph_dict(value)
    _report_dict(value)
  examples/frontend/src/api.ts:
    e: IntentEvent,EventPage,ApiError
    IntentEvent:
    EventPage:
    ApiError: super(-1),fetchEvents(-1),url(-1),response(-1),payload(-1),publishEvent(-1),response(-1),payload(-1)
  src/extractors/ast/records.ts:
    i: ../../core/record.js,../../core/types.js,./types.js
    e: adapterRecords,detailRecords,moduleRecords,byPath,bucket,start,end,capabilities,boundedCapabilities,moduleTopicText
    adapterRecords()
    detailRecords()
    moduleRecords()
    byPath()
    bucket()
    start()
    end()
    capabilities()
    boundedCapabilities()
    moduleTopicText()
  src/interfaces/intake-actions.ts:
    i: ../communication/intake-contract.js,../communication/intake-protobuf.js,../communication/intake-service.js,../config/env.js,../core/security.js,node:path
    e: executeIntakeAction,requestedRoot,root,projectDir,operation,supplied,envelope,service,result,envelopeInput
    executeIntakeAction()
    requestedRoot()
    root()
    projectDir()
    operation()
    supplied()
    envelope()
    service()
    result()
    envelopeInput()
  src/interfaces/mcp-resources.ts:
    i: ../config/env.js,../core/io.js,./mcp-errors.js,node:fs,node:path
    e: listMcpResources,readRequestedMcpResource,uri,readMcpResource,latestPath,selected,latest,filePath,latestPointer,assertInsideRoot,relative,isInvalidResourceError,resource
    listMcpResources()
    readRequestedMcpResource()
    uri()
    readMcpResource()
    latestPath()
    selected()
    latest()
    filePath()
    latestPointer()
    assertInsideRoot()
    relative()
    isInvalidResourceError()
    resource()
  src/operations/artifact.ts:
    i: ../core/id.js,./subactor.js,./types.js,node:fs,node:path
    e: CompileOperationPlanArtifactOptions,OperationPlanCompilationReceipt,readJson,writeExclusive,target,directory,temporary,existing,compileOperationPlanArtifact,plan,bindings,envelope
    CompileOperationPlanArtifactOptions:
    OperationPlanCompilationReceipt:
    readJson()
    writeExclusive()
    target()
    directory()
    temporary()
    existing()
    compileOperationPlanArtifact()
    plan()
    bindings()
    envelope()
  src/extractors/ast/unsupported.ts:
    i: ../../core/ignore.js,../../core/io.js,node:path
    e: unsupportedSourceWarning,files,counts,extension
    unsupportedSourceWarning()
    files()
    counts()
    extension()
  src/extractors/todo.ts:
    i: ../config/env.js,../core/io.js,../core/record.js,../core/types.js,../tf/classifier.js,./markdown-block.js,./markdown-paths.js,node:path
    e: extractTodo,absolute,body,relative,lines,raw,heading,level,task,checked,block,text,classified,action,resolvedPaths,inferOwner,match,extractExplicitId
    extractTodo()
    absolute()
    body()
    relative()
    lines()
    raw()
    heading()
    level()
    task()
    checked()
    block()
    text()
    classified()
    action()
    resolvedPaths()
    inferOwner()
    match()
    extractExplicitId()
  src/core/id.ts:
    i: node:crypto
    e: stableStringify,sortValue,sha256,shortHash,createIntentId,createRelationId,createConclusionId,createTodoProposalId,createCodeChangePlanHash,createCodeChangePlanId,createCodeChangeSourcePatchHash,createCodeChangeSourcePatchId,graphFingerprint,newRunId,stamp,asJsonValue
    stableStringify()
    sortValue()
    sha256()
    shortHash()
    createIntentId()
    createRelationId()
    createConclusionId()
    createTodoProposalId()
    createCodeChangePlanHash()
    createCodeChangePlanId()
    createCodeChangeSourcePatchHash()
    createCodeChangeSourcePatchId()
    graphFingerprint()
    newRunId()
    stamp()
    asJsonValue()
  src/core/grounding.ts:
    i: ./types.js
    e: groundRecordIdsByDiagnostics,diagnosticById,allowed,suppliedGrounded,sortedUnique
    groundRecordIdsByDiagnostics()
    diagnosticById()
    allowed()
    suppliedGrounded()
    sortedUnique()
  src/core/content-cache.ts:
    i: ./id.js,./io.js,./types.js,node:crypto,node:fs,node:path
    e: CacheEnvelope,ContentCacheOptions,ContentCacheEntryOptions,ContentCache
    CacheEnvelope:
    ContentCacheOptions:
    ContentCacheEntryOptions:
    ContentCache: getOrCompute(-1),assertNamespace(-1),key(-1),filePath(-1),cached(-1),value(-1),snapshot(-1),envelope(-1),write(-1),directory(-1),temporaryPath(-1),assertNamespace(-1),isNodeError(-1)
  src/synthesis/task-synthesis-materialize.ts:
    i: ../core/grounding.js,../core/id.js,../core/schema.js,../core/target.js,./task-synthesis-contract.js
    e: materializeTaskSynthesisResponse,parsed,conclusionKeys,proposalKeys,conclusions,diagnosticIds,conclusionIdByKey,conclusionByKey,proposalDrafts,conclusionKeys,citedConclusions,conclusion,proposalIdByKey,proposals,normalizeLocalKeys,explicit,reserved,keys,hasBlankKey,key,suffix,mapKeys,keys,id,sortedUnique,normalizeStringArray,values,normalizeRawTarget,target,normalizeAcceptanceCriteria,criteria,source,assertProposalEvidenceMatchesConclusions,byId,cited,diagnostics,records
    materializeTaskSynthesisResponse()
    parsed()
    conclusionKeys()
    proposalKeys()
    conclusions()
    diagnosticIds()
    conclusionIdByKey()
    conclusionByKey()
    proposalDrafts()
    conclusionKeys()
    citedConclusions()
    conclusion()
    proposalIdByKey()
    proposals()
    normalizeLocalKeys()
    explicit()
    reserved()
    keys()
    hasBlankKey()
    key()
    suffix()
    mapKeys()
    keys()
    id()
    sortedUnique()
    normalizeStringArray()
    values()
    normalizeRawTarget()
    target()
    normalizeAcceptanceCriteria()
    criteria()
    source()
    assertProposalEvidenceMatchesConclusions()
    byId()
    cited()
    diagnostics()
    records()
  src/llm/audit.ts:
    i: ../config/env.js,../core/types.js,./openrouter-timeout.js,./subllm.js
    e: openRouterAuditConfiguration,subllmEnabled,route,subllmRoutingEnabled
    openRouterAuditConfiguration()
    subllmEnabled()
    route()
    subllmRoutingEnabled()
  src/evaluation/gold-extraction.ts:
    i: ../config/env.js,../core/security.js,../core/types.js,../extractors/docs-deterministic.js,../extractors/docs-llm.js,../extractors/markdown.js,../extractors/nl.js,./gold-types.js,node:fs,node:os,node:path
    e: runExtractionCase,root,config,writeFixtureFiles,destination,extractNlCase,extractMarkdownCase,extractDeterministicDocumentationCase,files,extractDocumentationCase,originalFetch,benchmarkConfig,config,projectRecord
    runExtractionCase()
    root()
    config()
    writeFixtureFiles()
    destination()
    extractNlCase()
    extractMarkdownCase()
    extractDeterministicDocumentationCase()
    files()
    extractDocumentationCase()
    originalFetch()
    benchmarkConfig()
    config()
    projectRecord()
  scripts/live-contract-check.mjs:
    i: node:fs,node:path,node:url
    e: REPO_ROOT,envNumber,value,main,config,manifest,history,recorded,runLivePipeline,root,outputDir,config,deadline,deadlineTimer,startedAt,failed,runLivePipelineOnce,result,readLatestRunManifest,runsRoot,manifestPath,stat,auditPath,historyPath,readHistory,parsed,writeJson
    REPO_ROOT()
    envNumber()
    value()
    main()
    config()
    manifest()
    history()
    recorded()
    runLivePipeline()
    root()
    outputDir()
    config()
    deadline()
    deadlineTimer()
    startedAt()
    failed()
    runLivePipelineOnce()
    result()
    readLatestRunManifest()
    runsRoot()
    manifestPath()
    stat()
    auditPath()
    historyPath()
    readHistory()
    parsed()
    writeJson()
  examples/frontend/src/app.ts:
    i: ./api.js,./render.js
    e: PanelState,createState,refresh,page,message,mountPanel,state,reload
    PanelState:
    createState()
    refresh()
    page()
    message()
    mountPanel()
    state()
    reload()
  src/extractors/markdown.ts:
    i: ../config/env.js,../core/types.js,./changelog.js,./markdown-paths.js,./todo.js
    e: MarkdownExtractionOptions,extractMarkdownIntent,pathResolver,todo,changelog
    MarkdownExtractionOptions:
    extractMarkdownIntent()
    pathResolver()
    todo()
    changelog()
  examples/frontend/src/render.ts:
    i: ./api.js
    e: PanelRow,classifyEvent,toRows,renderTable,table,head,body,tr,cell,renderError,banner,headerRow,tr,th
    PanelRow:
    classifyEvent()
    toRows()
    renderTable()
    table()
    head()
    body()
    tr()
    cell()
    renderError()
    banner()
    headerRow()
    tr()
    th()
  src/evaluation/gold-metrics.ts:
    i: ../core/id.js,./gold-types.js
    e: Counts,emptyCounts,addCounts,compareSets,actualCounts,expectedCounts,counts,actualCount,expectedCount,frequency,counts,metric,ratio
    Counts:
    emptyCounts()
    addCounts()
    compareSets()
    actualCounts()
    expectedCounts()
    counts()
    actualCount()
    expectedCount()
    frequency()
    counts()
    metric()
    ratio()
  scripts/normalize-generated-analysis-roots.mjs:
    i: node:fs,node:path
    e: root,sourceRoot,textExtensions,projectDirectory,changed,original,normalized
    root()
    sourceRoot()
    textExtensions()
    projectDirectory()
    changed()
    original()
    normalized()
  scripts/sync-generated-readme-metadata.mjs:
    i: node:fs,node:path
    e: root,readmePath,relativeReadme,packagePath,packageJson,version,license,nodeVersion,original,synchronized,licenseTarget,requiredString,replaceRequired,badgeValue
    root()
    readmePath()
    relativeReadme()
    packagePath()
    packageJson()
    version()
    license()
    nodeVersion()
    original()
    synchronized()
    licenseTarget()
    requiredString()
    replaceRequired()
    badgeValue()
  sdk/go/types.go:
    e: SourceLineRange,IntentTarget,IntentStatement,IntentSource,IntentEpistemic,IntentGenerationMetadata,IntentRecord,IntentRelation,IntentGraph,Diagnostic,DiagnosticReport,ExtractionResult,Part,Message,Artifact,Task,RealityResult,DiffResult,Error,Generation,Error
    SourceLineRange:
    IntentTarget:
    IntentStatement:
    IntentSource:
    IntentEpistemic:
    IntentGenerationMetadata:
    IntentRecord:
    IntentRelation:
    IntentGraph:
    Diagnostic:
    DiagnosticReport:
    ExtractionResult:
    Part:
    Message:
    Artifact:
    Task:
    RealityResult:
    DiffResult:
    Error:
    Generation()
    Error()
  sdk/rust/src/actions.rs:
    i: crate::,serde_json::
  src/synthesis/task-synthesis-payload.ts:
    e: compactSynthesisPayload,recordIds,todoRecords,records,includedIds,groundedDiagnostics,compactRecord,compareDiagnostics
    compactSynthesisPayload()
    recordIds()
    todoRecords()
    records()
    includedIds()
    groundedDiagnostics()
    compactRecord()
    compareDiagnostics()
  src/interfaces/mcp-errors.ts:
    e: McpRequestError
    McpRequestError: super(-1),normalizeMcpError(-1)
  src/interfaces/a2a-card.ts:
    i: ../config/env.js,../version.js,node:crypto,node:http
    e: sendAgentCard,card,serialized,payload,agentCard,skills,skill
    sendAgentCard()
    card()
    serialized()
    payload()
    agentCard()
    skills()
    skill()
  sdk/go/actions.go:
    i: context
    e: ExtractAST,ExtractConfig,ExtractNL,ExtractDocs,ExtractMarkdown,ExtractMarkdownWithOptions,ExtractGit,Link,Diagnose,Reality,DiffGit,DiffFiles,CompareWorkspace,Pipeline,ProposeTodo,RenderTodo,ApplyTodo,callMap
    ExtractAST()
    ExtractConfig()
    ExtractNL()
    ExtractDocs()
    ExtractMarkdown()
    ExtractMarkdownWithOptions()
    ExtractGit()
    Link()
    Diagnose()
    Reality()
    DiffGit()
    DiffFiles()
    CompareWorkspace()
    Pipeline()
    ProposeTodo()
    RenderTodo()
    ApplyTodo()
    callMap()
  examples/src/runtime.ts:
    e: Contract,validateContract,executeContract
    Contract:
    validateContract()
    executeContract()
  src/extractors/ast/python.ts:
    i: ../../config/env.js,../../core/ignore.js,../../core/io.js,../../core/types.js,./external.js,node:fs,node:os,node:path,node:url
    e: extractPythonAst,helperPath,matcher,files,temporaryDirectory,filesPath
    extractPythonAst()
    helperPath()
    matcher()
    files()
    temporaryDirectory()
    filesPath()
  src/extractors/ast/php.ts:
    i: ../../config/env.js,../../core/ignore.js,../../core/io.js,../../core/types.js,./external.js,node:fs,node:os,node:path,node:url
    e: extractPhpAst,helperPath,matcher,files,temporaryDirectory,filesPath
    extractPhpAst()
    helperPath()
    matcher()
    files()
    temporaryDirectory()
    filesPath()
  src/diff/svg.ts:
    e: SvgTheme,SvgDocumentOptions,escapeXml,truncate,sanitizeSourceLine,metricCard,svgStyles,svgDocument,theme
    SvgTheme:
    SvgDocumentOptions:
    escapeXml()
    truncate()
    sanitizeSourceLine()
    metricCard()
    svgStyles()
    svgDocument()
    theme()
  src/sdk/typescript.ts:
    i: ../core/types.js,../diff/reality.js,../diff/text.js,../services/actions.js
    e: Todo2CodeClientOptions,DiffResult,FileDiffResult,GitDiffResponse,RealityResult,Todo2CodeClient
    Todo2CodeClientOptions:
    DiffResult:
    FileDiffResult:
    GitDiffResponse:
    RealityResult:
    Todo2CodeClient: a2a(-1),health(-1),diffGraphs(-1),diffGraphFiles(-1),compareWorkspace(-1),proposeTodo(-1),renderTodo(-1),applyTodo(-1),proposeCodeChange(-1),renderCodeChange(-1),proposeSourcePatch(-1),applySourcePatch(-1),evaluateCodeChange(-1),closeCodeChange(-1),extractNl(-1),run(-1)
  scripts/assert-demollm-run.mjs:
    i: node:fs/promises,node:path
    e: root,output,latestPath,latest,manifestPath,manifest,stage,stage,tokens,cost
    root()
    output()
    latestPath()
    latest()
    manifestPath()
    manifest()
    stage()
    stage()
    tokens()
    cost()
  scripts/generate-response-schemas.mjs:
    i: ../dist/src/extractors/docs-schema.js,node:fs,node:path,node:url
    e: root,outputPath,publishedDocumentMaximum,current
    root()
    outputPath()
    publishedDocumentMaximum()
    current()
  sdk/rust/src/types.rs:
    i: serde::,serde_json::Value
    e: SourceLineRange,IntentTarget,IntentStatement,IntentSource,IntentEpistemic,IntentLifecycle,IntentGenerationMetadata,IntentRecord,Diagnostic,DiagnosticReport,ExtractionResult
    SourceLineRange:
    IntentTarget:
    IntentStatement:
    IntentSource:
    IntentEpistemic:
    IntentLifecycle:
    IntentGenerationMetadata:
    IntentRecord:
    Diagnostic:
    DiagnosticReport:
    ExtractionResult:
  sdk/rust/src/error.rs:
    i: std::fmt
  sdk/python/todo2code_sdk.py:
    e: Todo2CodeClient,_record_dict
    Todo2CodeClient: __init__(3),health(0),extract_nl(3),extract_docs(3),diff_graphs(3),diff_graph_files(3),diff_text_files(2),diff_git(0),reality(1),run(2)  # Diff-focused client for the todo2code runtime.

Graph compar...
    _record_dict(record)
  scripts/vallm-compatible.py:
    e: detect_file_language_with_parser_id
    detect_file_language_with_parser_id(file_path)
  examples/backend/src/store.ts:
    e: IntentEvent,EventPage,EventStore
    IntentEvent:
    EventPage:
    EventStore: enqueueEvent(-1),listEvents(-1),start(-1),size(-1)
  src/extractors/docs-schema.ts:
    i: ../llm/structured-schema.js,./docs-types.js
    e: strings,target,documentRecord,documentResponseContract,documentResponseSchema
    strings()
    target()
    documentRecord()
    documentResponseContract()
    documentResponseSchema()
  src/extractors/ast/rust.ts:
    i: ../../config/env.js,../../core/types.js,./external.js,node:path,node:url
    e: extractRustAst,helperPath
    extractRustAst()
    helperPath()
  src/extractors/ast/go.ts:
    i: ../../config/env.js,../../core/types.js,./external.js,node:path,node:url
    e: extractGoAst,helperPath
    extractGoAst()
    helperPath()
  examples/sdk/typescript.mjs:
    i: ../../dist/src/sdk/typescript.js,node:fs/promises
    e: client
    client()
  src/extractors/ast/java.ts:
    i: ../../config/env.js,../../core/types.js,./external.js,node:path,node:url
    e: extractJavaAst,helperPath
    extractJavaAst()
    helperPath()
  src/semantic/reranker-response.ts:
    i: ../llm/structured-schema.js
    e: SemanticRerankerResponse,RERANK_DECISION_CONTRACT,SEMANTIC_RERANK_RESPONSE_CONTRACT,SEMANTIC_RERANK_RESPONSE_SCHEMA,assertSemanticRerankerResponse,response
    SemanticRerankerResponse:
    RERANK_DECISION_CONTRACT()
    SEMANTIC_RERANK_RESPONSE_CONTRACT()
    SEMANTIC_RERANK_RESPONSE_SCHEMA()
    assertSemanticRerankerResponse()
    response()
  src/synthesis/task-synthesis-contract.ts:
    i: ../core/types.js,../llm/structured-schema.js
    e: RawConclusion,RawProposal,RawTaskSynthesisResponse,taskStrings,taskIds,nonBlank,RAW_CONCLUSION_CONTRACT,RAW_PROPOSAL_CONTRACT,TASK_SYNTHESIS_RESPONSE_CONTRACT
    RawConclusion:
    RawProposal:
    RawTaskSynthesisResponse:
    taskStrings()
    taskIds()
    nonBlank()
    RAW_CONCLUSION_CONTRACT()
    RAW_PROPOSAL_CONTRACT()
    TASK_SYNTHESIS_RESPONSE_CONTRACT()
  src/operations/contract.ts:
    i: ../core/id.js,./validation.js
    e: variableContractSemanticValue,createVariableContract,normalized,normalizedPlanDraft,operationPlanHashMaterial,createOperationPlan,normalized,planHash
    variableContractSemanticValue()
    createVariableContract()
    normalized()
    normalizedPlanDraft()
    operationPlanHashMaterial()
    createOperationPlan()
    normalized()
    planHash()
  sdk/php/src/Error.php:
    e: Error
    Error:
  examples/src/helper.py:
    e: load_task,normalize_task
    load_task(path)
    normalize_task(value)
  sdk/python/examples/local_runtime.py:
    e: main
    main()
  TASK.md:
  goal.yaml:
  Makefile:
  docker-compose.yml:
  compose.e2e.yml:
  tsconfig.json:
  Dockerfile:
  AGENTS.md:
  TODO.md:
  nlp2uri.yaml:
  schemas/todo-proposal.schema.json:
  schemas/conclusion.schema.json:
  schemas/code-change-acceptance.schema.json:
  dsl-manifest.json:
  schemas/document-extraction-response.schema.json:
  schemas/intent-graph-diff.schema.json:
  README.md:
  pyproject.toml:
  project.sh:
  schemas/operation-plan.schema.json:
  project2.sh:
  schemas/code-change-review.schema.json:
  schemas/semantic-rerank.schema.json:
  CONTRIBUTION.md:
  schemas/variable-contract.schema.json:
  schemas/todo-patch.schema.json:
  schemas/participant-registry.schema.json:
  schemas/code-change-plan-set.schema.json:
  schemas/semantic-candidate-set.schema.json:
  rust-ast/Cargo.toml:
  schemas/gold-dataset.schema.json:
  schemas/intent-record.schema.json:
  CHANGELOG.md:
  schemas/intent-graph.schema.json:
  schemas/code-change-source-apply-receipt.schema.json:
  schemas/code-change-source-patch.schema.json:
  schemas/participant-synthesis.schema.json:
  package.json:
  schemas/code-change-source-patch-set.schema.json:
  docs/TEAM_COMMUNICATION.md:
  docs/DSL.md:
  schemas/code-change-plan.schema.json:
  docs/PROTOCOLS.md:
  docs/EVENT_LOG_DSL.md:
  docs/DEMOLLM.md:
  schemas/code-change-close-result.schema.json:
  docs/SUBACTOR_OPERATION_DSL.md:
  docs/OPTIMIZATION.md:
  docs/TEST_REPORT.md:
  docs/GROK-PLAN.md:
  docs/READINESS.md:
  docs/E2E.md:
  docs/VALIDATION.md:
  docs/REQUIREMENTS.md:
  docs/SYSTEM_MONITOROWANIA_INTENCJI_I_PRACY_AGENTOW.md:
  docs/PIPELINE_DSL_NL.md:
  docs/CODE_CHANGE_PLANS.md:
  docs/ARCHITECTURE.md:
  docs/SECURITY.md:
  docs/CLI_GUIDE.md:
  docs/PROJECT_STATUS.md:
  examples/TODO.md:
  examples/task.md:
  docs/intent-guard-diagrams/README.md:
  docs/intent-guard-diagrams/ALL_DIAGRAMS.md:
  docs/reference/original-monitoring-design.md:
  examples/CHANGELOG.md:
  docs/README.md:
  examples/backend/task.md:
  examples/backend/tsconfig.json:
  examples/frontend/TODO.md:
  examples/backend/TODO.md:
  examples/frontend/tsconfig.json:
  examples/frontend/task.md:
  examples/frontend/CHANGELOG.md:
  examples/backend/README.md:
  examples/docs/ARCHITECTURE.md:
  examples/project/participants.json:
  examples/project/DEMO-101/agent.rogue.plan.001.md:
  examples/project/DEMO-101/human.product-owner.request.001.md:
  examples/project/DEMO-101/human.security.decision.001.md:
  examples/project/DEMO-101/agent.codex.report.002.md:
  examples/backend/CHANGELOG.md:
  examples/project/DEMO-101/agent.codex.plan.001.md:
  src/index.ts:
  examples/frontend/README.md:
  src/version.ts:
  src/extractors/docs-types.ts:
    e: RawDocumentRecord,DocumentResponse,DocumentChunk,DocumentationTargetHints,DocumentationExtractionOptions,DocumentationExtractionResult,DocumentChunkResult
    RawDocumentRecord:
    DocumentResponse:
    DocumentChunk:
    DocumentationTargetHints:
    DocumentationExtractionOptions:
    DocumentationExtractionResult:
    DocumentChunkResult:
  src/extractors/ast/types.ts:
    i: ../../core/types.js
    e: AdapterFact,AdapterOutput
    AdapterFact:
    AdapterOutput:
  src/core/types.ts:
    e: SourceLineRange,IntentTarget,IntentStatement,IntentSource,IntentEpistemic,IntentLifecycle,IntentGenerationMetadata,IntentRecordMetadata,IntentRecord,IntentRelation,IntentGraph,IntentRecordChange,IntentGraphDiff,Diagnostic,DiagnosticReport,GroundedGenerationMetadata,Conclusion,TodoProposal,CodeChangeFile,CodeChangeRisk,CodeChangePlan,CodeChangeAcceptance,CodeChangeCloseResult,CodeChangeReviewPatch,CodeChangeSourceEdit,CodeChangeSourcePatch,CodeChangeSourcePatchSet,CodeChangeSourcePatchApproval,CodeChangeSourceApplyReceipt,TodoPatchDuplicateClassification,TodoPatchArtifact,TodoPatchApproval,TodoApplyReceipt,TodoApplyResult,ExtractionResult,ContentCacheStats,CachedExtractionResult,LlmResponseMetadata,PipelineStageAudit,PipelineOptions,PipelineManifest
    SourceLineRange:
    IntentTarget:
    IntentStatement:
    IntentSource:
    IntentEpistemic:
    IntentLifecycle:
    IntentGenerationMetadata:
    IntentRecordMetadata:
    IntentRecord:
    IntentRelation:
    IntentGraph:
    IntentRecordChange:
    IntentGraphDiff:
    Diagnostic:
    DiagnosticReport:
    GroundedGenerationMetadata:
    Conclusion:
    TodoProposal:
    CodeChangeFile:
    CodeChangeRisk:
    CodeChangePlan:
    CodeChangeAcceptance:
    CodeChangeCloseResult:
    CodeChangeReviewPatch:
    CodeChangeSourceEdit:
    CodeChangeSourcePatch:
    CodeChangeSourcePatchSet:
    CodeChangeSourcePatchApproval:
    CodeChangeSourceApplyReceipt:
    TodoPatchDuplicateClassification:
    TodoPatchArtifact:
    TodoPatchApproval:
    TodoApplyReceipt:
    TodoApplyResult:
    ExtractionResult:
    ContentCacheStats:
    CachedExtractionResult:
    LlmResponseMetadata:
    PipelineStageAudit:
    PipelineOptions:
    PipelineManifest:
  src/core/version.ts:
  src/interfaces/governed-intake.proto:
  src/interfaces/intake-schemas/command-v1.schema.json:
  src/interfaces/intake-schemas/result-v1.schema.json:
  src/interfaces/intake-schemas/event-v1.schema.json:
  src/interfaces/intake-schemas/envelope-v1.schema.json:
  src/interfaces/intake-schemas/participant-registry-v2.schema.json:
  src/interfaces/intake-schemas/query-v1.schema.json:
  src/interfaces/intake-schemas/diagnostic-v1.schema.json:
  src/diff/text-types.ts:
    e: DiffLine,DiffHunk,FileDiff,DiffTextOptions
    DiffLine:
    DiffHunk:
    FileDiff:
    DiffTextOptions:
  src/operations/types.ts:
    i: ../core/types.js
    e: VariableContract,OperationParameterReference,OperationRollback,OperationStep,OperationExpectation,OperationPlan,ResolvedVariableBinding,SubactorProcessEnvelope
    VariableContract:
    OperationParameterReference:
    OperationRollback:
    OperationStep:
    OperationExpectation:
    OperationPlan:
    ResolvedVariableBinding:
    SubactorProcessEnvelope:
  prompts/summarize.system.md:
  prompts/communication-to-intent.system.md:
  prompts/nl-to-intent.system.md:
  prompts/tasks-from-dsl.system.md:
  prompts/markdown-to-intent.system.md:
  prompts/docs-to-intent.system.md:
  scripts/e2e.sh:
    e: fail,require_command,run_step
    fail()
    require_command()
    run_step()
  scripts/a2a-request.sh:
  scripts/mcp-request.sh:
  scripts/docker-smoke.sh:
    e: cleanup
    cleanup()
  scripts/examples-check.sh:
    e: cleanup,record_sdk_log,run_sdk
    cleanup()
    record_sdk_log()
    run_sdk()
  scripts/runtime.sh:
    e: usage,parseOptions,sortDeep,canonical,sha256Bytes,sha256File,readText,readJson,diagnostic,validatePolicyText,isObject,isSha,isDigest,validateMinimumShape,findNumericScore,globToRegExp,pathAllowed,git,exactStringSet,approvalScopeDigest,expectedVerdict,validateEvaluation,markdownReport,writeResult
    usage()
    parseOptions()
    sortDeep()
    canonical()
    sha256Bytes()
    sha256File()
    readText()
    readJson()
    diagnostic()
    validatePolicyText()
    isObject()
    isSha()
    isDigest()
    validateMinimumShape()
    findNumericScore()
    globToRegExp()
    pathAllowed()
    git()
    exactStringSet()
    approvalScopeDigest()
    expectedVerdict()
    validateEvaluation()
    markdownReport()
    writeResult()
  scripts/smoke.sh:
  scripts/research/README.md:
  adapters/tensorflow/package.json:
  evaluation/gold/README.md:
  evaluation/gold/v1/dataset.json:
  python/requirements.txt:
  evaluation/gold/v2/dataset.json:
  sdk/README.md:
  sdk/go/todo2code.go:
  sdk/go/README.md:
  sdk/typescript/tsconfig.json:
  sdk/typescript/package.json:
  sdk/typescript/README.md:
  sdk/rust/Cargo.toml:
  sdk/rust/README.md:
  sdk/rust/src/lib.rs:
  sdk/php/composer.json:
  sdk/php/README.md:
  sdk/php/examples/basic.php:
    i: Todo2Code\Client,Todo2Code\Error
  sdk/python/README.md:
  sdk/python/__init__.py:
  sdk/python/todo2code/__init__.py:
  sdk/__init__.py:
  examples/sdk/python.py:
  scripts/package.py:
```

### `project/logic.pl`

```prolog markpact:analysis path=project/logic.pl
% ── Project Metadata ─────────────────────────────────────
project_metadata('todo2code', '0.5.1', 'python').

% ── Project Files ────────────────────────────────────────
project_file('.governance/check_required_checks.py', 139, 'python').
project_file('.governance/decision_record.py', 395, 'python').
project_file('.governance/governance_check.py', 2726, 'python').
project_file('app.doql.less', 226, 'less').
project_file('examples/backend/src/server.ts', 100, 'typescript').
project_file('examples/backend/src/store.ts', 49, 'typescript').
project_file('examples/backend/src/validation.ts', 32, 'typescript').
project_file('examples/frontend/src/api.ts', 51, 'typescript').
project_file('examples/frontend/src/app.ts', 44, 'typescript').
project_file('examples/frontend/src/render.ts', 65, 'typescript').
project_file('examples/sdk/python.py', 24, 'python').
project_file('examples/sdk/typescript.mjs', 17, 'javascript').
project_file('examples/src/helper.py', 10, 'python').
project_file('examples/src/runtime.ts', 14, 'typescript').
project_file('golang/ast_extract.go', 369, 'go').
project_file('php/ast_extract.php', 234, 'php').
project_file('project.sh', 39, 'shell').
project_file('project2.sh', 56, 'shell').
project_file('python/ast_extract.py', 222, 'python').
project_file('python/tests/test_python.py', 12, 'python').
project_file('rust-ast/src/main.rs', 323, 'rust').
project_file('rust-ast/tests/placeholder_test.rs', 10, 'rust').
project_file('scripts/a2a-request.sh', 24, 'shell').
project_file('scripts/assert-demollm-run.mjs', 46, 'javascript').
project_file('scripts/docker-smoke.sh', 37, 'shell').
project_file('scripts/e2e.sh', 110, 'shell').
project_file('scripts/examples-check.sh', 211, 'shell').
project_file('scripts/generate-response-schemas.mjs', 28, 'javascript').
project_file('scripts/github-event-log.mjs', 578, 'javascript').
project_file('scripts/live-contract-check.mjs', 201, 'javascript').
project_file('scripts/live-model-comparison.mjs', 126, 'javascript').
project_file('scripts/mcp-request.sh', 12, 'shell').
project_file('scripts/normalize-generated-analysis-roots.mjs', 39, 'javascript').
project_file('scripts/package.py', 26, 'python').
project_file('scripts/research/audit-changelog-sample.mjs', 227, 'javascript').
project_file('scripts/research/evaluate-embedding-pairs.py', 102, 'python').
project_file('scripts/research/rank-intent-graph-embeddings.py', 175, 'python').
project_file('scripts/research/rerank-embedding-shortlist.mjs', 192, 'javascript').
project_file('scripts/runtime.sh', 859, 'shell').
project_file('scripts/smoke.sh', 58, 'shell').
project_file('scripts/sync-generated-readme-metadata.mjs', 67, 'javascript').
project_file('scripts/vallm-compatible.py', 26, 'python').
project_file('scripts/verify-env-contract.mjs', 104, 'javascript').
project_file('scripts/verify-generated-analysis.mjs', 89, 'javascript').
project_file('scripts/verify-module-boundaries.mjs', 88, 'javascript').
project_file('scripts/verify-no-llm-imports.mjs', 79, 'javascript').
project_file('scripts/verify-structured-responses.mjs', 36, 'javascript').
project_file('scripts/verify-workflow-yaml.mjs', 44, 'javascript').
project_file('scripts/workspace-preflight.mjs', 85, 'javascript').
project_file('sdk/__init__.py', 2, 'python').
project_file('sdk/go/actions.go', 137, 'go').
project_file('sdk/go/client.go', 198, 'go').
project_file('sdk/go/examples/basic/main.go', 164, 'go').
project_file('sdk/go/todo2code.go', 31, 'go').
project_file('sdk/go/types.go', 216, 'go').
project_file('sdk/php/examples/basic.php', 113, 'php').
project_file('sdk/php/src/Client.php', 402, 'php').
project_file('sdk/php/src/Error.php', 26, 'php').
project_file('sdk/python/__init__.py', 14, 'python').
project_file('sdk/python/examples/basic.py', 96, 'python').
project_file('sdk/python/examples/local_runtime.py', 37, 'python').
project_file('sdk/python/todo2code/__init__.py', 34, 'python').
project_file('sdk/python/todo2code/client.py', 470, 'python').
project_file('sdk/python/todo2code/runtime.py', 226, 'python').
project_file('sdk/python/todo2code_sdk.py', 172, 'python').
project_file('sdk/rust/examples/basic.rs', 109, 'rust').
project_file('sdk/rust/src/actions.rs', 101, 'rust').
project_file('sdk/rust/src/client.rs', 222, 'rust').
project_file('sdk/rust/src/error.rs', 38, 'rust').
project_file('sdk/rust/src/lib.rs', 50, 'rust').
project_file('sdk/rust/src/types.rs', 141, 'rust').
project_file('sdk/typescript/examples/basic.ts', 85, 'typescript').
project_file('sdk/typescript/src/index.ts', 421, 'typescript').
project_file('src/cli.ts', 875, 'typescript').
project_file('src/communication/analyzer.ts', 543, 'typescript').
project_file('src/communication/identity.ts', 147, 'typescript').
project_file('src/communication/intake-contract.ts', 274, 'typescript').
project_file('src/communication/intake-protobuf.ts', 126, 'typescript').
project_file('src/communication/intake-service.ts', 292, 'typescript').
project_file('src/communication/intake-store.ts', 162, 'typescript').
project_file('src/communication/llm.ts', 515, 'typescript').
project_file('src/comparison/workspace.ts', 486, 'typescript').
project_file('src/config/env.ts', 233, 'typescript').
project_file('src/core/branch-portfolio.ts', 500, 'typescript').
project_file('src/core/content-cache.ts', 140, 'typescript').
project_file('src/core/grounding.ts', 25, 'typescript').
project_file('src/core/id.ts', 168, 'typescript').
project_file('src/core/ignore.ts', 201, 'typescript').
project_file('src/core/io.ts', 178, 'typescript').
project_file('src/core/record.ts', 173, 'typescript').
project_file('src/core/schema.ts', 923, 'typescript').
project_file('src/core/security.ts', 56, 'typescript').
project_file('src/core/target.ts', 58, 'typescript').
project_file('src/core/text.ts', 492, 'typescript').
project_file('src/core/truth-map.ts', 468, 'typescript').
project_file('src/core/types.ts', 677, 'typescript').
project_file('src/core/version.ts', 3, 'typescript').
project_file('src/diff/git.ts', 162, 'typescript').
project_file('src/diff/reality.ts', 620, 'typescript').
project_file('src/diff/svg.ts', 105, 'typescript').
project_file('src/diff/text-render.ts', 252, 'typescript').
project_file('src/diff/text-types.ts', 40, 'typescript').
project_file('src/diff/text.ts', 240, 'typescript').
project_file('src/evaluation/analysis-policy.ts', 438, 'typescript').
project_file('src/evaluation/gold-cases.ts', 367, 'typescript').
project_file('src/evaluation/gold-cli.ts', 45, 'typescript').
project_file('src/evaluation/gold-extraction.ts', 128, 'typescript').
project_file('src/evaluation/gold-metrics.ts', 51, 'typescript').
project_file('src/evaluation/gold-types.ts', 379, 'typescript').
project_file('src/evaluation/gold.ts', 330, 'typescript').
project_file('src/extractors/ast/external.ts', 49, 'typescript').
project_file('src/extractors/ast/go.ts', 21, 'typescript').
project_file('src/extractors/ast/java.ts', 21, 'typescript').
project_file('src/extractors/ast/php.ts', 35, 'typescript').
project_file('src/extractors/ast/python.ts', 40, 'typescript').
project_file('src/extractors/ast/records.ts', 98, 'typescript').
project_file('src/extractors/ast/rust.ts', 21, 'typescript').
project_file('src/extractors/ast/types.ts', 21, 'typescript').
project_file('src/extractors/ast/typescript.ts', 167, 'typescript').
project_file('src/extractors/ast/unsupported.ts', 31, 'typescript').
project_file('src/extractors/ast.ts', 194, 'typescript').
project_file('src/extractors/changelog.ts', 100, 'typescript').
project_file('src/extractors/communication.ts', 686, 'typescript').
project_file('src/extractors/configuration.ts', 232, 'typescript').
project_file('src/extractors/docs-chunks.ts', 148, 'typescript').
project_file('src/extractors/docs-deterministic.ts', 365, 'typescript').
project_file('src/extractors/docs-llm.ts', 270, 'typescript').
project_file('src/extractors/docs-record.ts', 194, 'typescript').
project_file('src/extractors/docs-schema.ts', 44, 'typescript').
project_file('src/extractors/docs-types.ts', 69, 'typescript').
project_file('src/extractors/git.ts', 181, 'typescript').
project_file('src/extractors/markdown-block.ts', 68, 'typescript').
project_file('src/extractors/markdown-llm.ts', 459, 'typescript').
project_file('src/extractors/markdown-paths.ts', 123, 'typescript').
project_file('src/extractors/markdown.ts', 36, 'typescript').
project_file('src/extractors/nl-llm.ts', 317, 'typescript').
project_file('src/extractors/nl.ts', 108, 'typescript').
project_file('src/extractors/runtime-cycle.ts', 307, 'typescript').
project_file('src/extractors/todo.ts', 94, 'typescript').
project_file('src/graph/capability-evidence.ts', 63, 'typescript').
project_file('src/graph/changelog-signal.ts', 90, 'typescript').
project_file('src/graph/diagnostics.ts', 362, 'typescript').
project_file('src/graph/diff.ts', 236, 'typescript').
project_file('src/graph/linker.ts', 490, 'typescript').
project_file('src/graph/symbol-resolution.ts', 121, 'typescript').
project_file('src/index.ts', 54, 'typescript').
project_file('src/interfaces/a2a-card.ts', 182, 'typescript').
project_file('src/interfaces/a2a-history.ts', 227, 'typescript').
project_file('src/interfaces/a2a-message.ts', 198, 'typescript').
project_file('src/interfaces/a2a-task-store.ts', 561, 'typescript').
project_file('src/interfaces/a2a-types.ts', 165, 'typescript').
project_file('src/interfaces/a2a.ts', 333, 'typescript').
project_file('src/interfaces/intake-actions.ts', 39, 'typescript').
project_file('src/interfaces/intake_cli.py', 157, 'python').
project_file('src/interfaces/mcp-errors.ts', 11, 'typescript').
project_file('src/interfaces/mcp-resources.ts', 89, 'typescript').
project_file('src/interfaces/mcp-tools.ts', 324, 'typescript').
project_file('src/interfaces/mcp.ts', 262, 'typescript').
project_file('src/live/contract-check.ts', 318, 'typescript').
project_file('src/live/model-comparison.ts', 219, 'typescript').
project_file('src/llm/audit.ts', 65, 'typescript').
project_file('src/llm/failure.ts', 26, 'typescript').
project_file('src/llm/openrouter-timeout.ts', 136, 'typescript').
project_file('src/llm/openrouter.ts', 562, 'typescript').
project_file('src/llm/structured-schema.ts', 219, 'typescript').
project_file('src/llm/subllm.ts', 260, 'typescript').
project_file('src/operations/artifact.ts', 67, 'typescript').
project_file('src/operations/compile-cli.ts', 35, 'typescript').
project_file('src/operations/contract.ts', 85, 'typescript').
project_file('src/operations/subactor.ts', 123, 'typescript').
project_file('src/operations/types.ts', 156, 'typescript').
project_file('src/operations/validation.ts', 282, 'typescript').
project_file('src/pipeline/event-log-persistence.ts', 191, 'typescript').
project_file('src/pipeline/event-log.ts', 416, 'typescript').
project_file('src/pipeline/run.ts', 796, 'typescript').
project_file('src/sdk/typescript.ts', 173, 'typescript').
project_file('src/semantic/reranker-llm.ts', 211, 'typescript').
project_file('src/semantic/reranker-response.ts', 43, 'typescript').
project_file('src/semantic/reranker.ts', 510, 'typescript').
project_file('src/services/actions.ts', 701, 'typescript').
project_file('src/services/branch-portfolio-assembler.ts', 358, 'typescript').
project_file('src/services/branch-snapshot.ts', 584, 'typescript').
project_file('src/services/workspace-preflight.ts', 499, 'typescript').
project_file('src/summary/payload.ts', 66, 'typescript').
project_file('src/summary/render.ts', 62, 'typescript').
project_file('src/summary/summarizer.ts', 334, 'typescript').
project_file('src/synthesis/code-change-path.ts', 205, 'typescript').
project_file('src/synthesis/code-change-plan.ts', 1311, 'typescript').
project_file('src/synthesis/task-synthesis-contract.ts', 67, 'typescript').
project_file('src/synthesis/task-synthesis-materialize.ts', 173, 'typescript').
project_file('src/synthesis/task-synthesis-payload.ts', 71, 'typescript').
project_file('src/synthesis/tasks-llm.ts', 267, 'typescript').
project_file('src/synthesis/todo-patch.ts', 373, 'typescript').
project_file('src/synthesis/validation.ts', 114, 'typescript').
project_file('src/tf/classifier.ts', 97, 'typescript').
project_file('src/version.ts', 3, 'typescript').
project_file('src/watch/watcher.ts', 244, 'typescript').
project_file('src/web/diff-ui.ts', 49, 'typescript').
project_file('test/a2a-intake.test.ts', 110, 'typescript').
project_file('test/a2a.test.ts', 318, 'typescript').
project_file('test/ast-go.test.ts', 147, 'typescript').
project_file('test/ast-languages.test.ts', 104, 'typescript').
project_file('test/ast-php.test.ts', 109, 'typescript').
project_file('test/ast.test.ts', 78, 'typescript').
project_file('test/cli-help.test.ts', 23, 'typescript').
project_file('test/cli-intake.test.ts', 51, 'typescript').
project_file('test/cli-summary.test.ts', 53, 'typescript').
project_file('test/cli-todo.test.ts', 67, 'typescript').
project_file('test/cli-watch.test.ts', 100, 'typescript').
project_file('test/code-change-plan.test.ts', 808, 'typescript').
project_file('test/communication-identity.test.ts', 78, 'typescript').
project_file('test/communication-intake.test.ts', 206, 'typescript').
project_file('test/communication-llm.test.ts', 144, 'typescript').
project_file('test/communication.test.ts', 318, 'typescript').
project_file('test/config-openrouter-app-name.test.ts', 50, 'typescript').
project_file('test/configuration.test.ts', 54, 'typescript').
project_file('test/diff-engine.test.ts', 243, 'typescript').
project_file('test/diff.test.ts', 244, 'typescript').
project_file('test/docs-llm-repair.test.ts', 146, 'typescript').
project_file('test/docs-source-dsl-apis.test.ts', 89, 'typescript').
project_file('test/docs.test.ts', 120, 'typescript').
project_file('test/extraction-cache.test.ts', 134, 'typescript').
project_file('test/fixtures/languages/sample.rs', 26, 'rust').
project_file('test/generated-analysis-roots.test.ts', 40, 'typescript').
project_file('test/generated-analysis.test.ts', 97, 'typescript').
project_file('test/generated-readme.test.ts', 77, 'typescript').
project_file('test/generated-remediation-projections.test.ts', 103, 'typescript').
project_file('test/git-branch-portfolio-assembler.test.ts', 292, 'typescript').
project_file('test/git-branch-snapshot.test.ts', 232, 'typescript').
project_file('test/git-workspace-preflight.test.ts', 294, 'typescript').
project_file('test/git.test.ts', 42, 'typescript').
project_file('test/gold-evaluation.test.ts', 172, 'typescript').
project_file('test/graph-branch-portfolio.test.ts', 382, 'typescript').
project_file('test/graph-truth-map.test.ts', 225, 'typescript').
project_file('test/graph.test.ts', 201, 'typescript').
project_file('test/grounded-contracts.test.ts', 275, 'typescript').
project_file('test/helpers.ts', 65, 'typescript').
project_file('test/ignore.test.ts', 140, 'typescript').
project_file('test/io.test.ts', 18, 'typescript').
project_file('test/linker-pairing.test.ts', 305, 'typescript').
project_file('test/live-contract-check.test.ts', 265, 'typescript').
project_file('test/live-model-comparison.test.ts', 215, 'typescript').
project_file('test/llm-defaults.test.ts', 22, 'typescript').
project_file('test/markdown.test.ts', 484, 'typescript').
project_file('test/mcp.test.ts', 127, 'typescript').
project_file('test/nl-llm.test.ts', 213, 'typescript').
project_file('test/nl.test.ts', 207, 'typescript').
project_file('test/openrouter-timeout.test.ts', 151, 'typescript').
project_file('test/openrouter.test.ts', 749, 'typescript').
project_file('test/operation-plan.test.ts', 210, 'typescript').
project_file('test/pipeline-event-log.test.ts', 105, 'typescript').
project_file('test/pipeline.test.ts', 375, 'typescript').
project_file('test/proposal-validation.test.ts', 102, 'typescript').
project_file('test/python-runtime.test.ts', 63, 'typescript').
project_file('test/runtime-cycle.test.ts', 160, 'typescript').
project_file('test/schema-validation.test.ts', 92, 'typescript').
project_file('test/sdk.test.ts', 207, 'typescript').
project_file('test/security.test.ts', 45, 'typescript').
project_file('test/semantic-reranker.test.ts', 468, 'typescript').
project_file('test/structured-analysis-policy.test.ts', 257, 'typescript').
project_file('test/structured-schema.test.ts', 54, 'typescript').
project_file('test/subllm.test.ts', 203, 'typescript').
project_file('test/symbol-resolution.test.ts', 124, 'typescript').
project_file('test/target.test.ts', 45, 'typescript').
project_file('test/task-synthesis.test.ts', 354, 'typescript').
project_file('test/tensorflow.test.ts', 22, 'typescript').
project_file('test/todo-patch.test.ts', 267, 'typescript').
project_file('test/watch.test.ts', 303, 'typescript').
project_file('test/workflow-validation.test.ts', 457, 'typescript').
project_file('test/workspace.test.ts', 135, 'typescript').

% ── Python Functions ─────────────────────────────────────
python_function('.governance/check_required_checks.py', 'repo_root', 0, 1, 2).
python_function('.governance/check_required_checks.py', 'load_source', 1, 10, 7).
python_function('.governance/check_required_checks.py', 'workflow_job_names', 1, 11, 9).
python_function('.governance/check_required_checks.py', 'compare', 2, 8, 5).
python_function('.governance/check_required_checks.py', 'main', 1, 8, 13).
python_function('.governance/decision_record.py', 'parse_value', 1, 2, 2).
python_function('.governance/decision_record.py', 'format_value', 1, 1, 1).
python_function('.governance/decision_record.py', 'decision_body', 1, 5, 4).
python_function('.governance/decision_record.py', 'apply_named_field', 3, 2, 1).
python_function('.governance/decision_record.py', 'apply_decision_line', 2, 8, 7).
python_function('.governance/decision_record.py', 'require_decision_fields', 1, 6, 1).
python_function('.governance/decision_record.py', 'parse_dsl_record', 1, 5, 7).
python_function('.governance/decision_record.py', 'to_dsl', 1, 5, 5).
python_function('.governance/decision_record.py', 'record_content_hash', 1, 1, 4).
python_function('.governance/decision_record.py', 'replay_verdict', 1, 15, 7).
python_function('.governance/decision_record.py', 'validate_record', 1, 10, 4).
python_function('.governance/decision_record.py', 'split_decision_blocks', 1, 8, 5).
python_function('.governance/decision_record.py', 'check_append_only', 2, 4, 7).
python_function('.governance/decision_record.py', 'from_change_evaluation', 1, 9, 11).
python_function('.governance/decision_record.py', 'main', 1, 8, 11).
python_function('.governance/governance_check.py', 'load_json', 1, 1, 2).
python_function('.governance/governance_check.py', 'work_classification_header_error', 1, 10, 3).
python_function('.governance/governance_check.py', 'complexity_rule_assignment', 1, 5, 1).
python_function('.governance/governance_check.py', 'expected_rule_assignment', 1, 8, 2).
python_function('.governance/governance_check.py', 'work_classification_rule_error', 1, 10, 4).
python_function('.governance/governance_check.py', 'work_classification_error', 1, 12, 6).
python_function('.governance/governance_check.py', 'load_work_classification', 2, 3, 4).
python_function('.governance/governance_check.py', 'rel', 2, 1, 2).
python_function('.governance/governance_check.py', 'safe_repo_path', 2, 2, 3).
python_function('.governance/governance_check.py', 'string_list', 1, 7, 5).
python_function('.governance/governance_check.py', 'relative_pattern', 1, 3, 4).
python_function('.governance/governance_check.py', 'approval_evidence_config_valid', 1, 7, 3).
python_function('.governance/governance_check.py', 'branch_name', 1, 4, 4).
python_function('.governance/governance_check.py', 'integer_fields_valid', 2, 3, 3).
python_function('.governance/governance_check.py', 'relative_pattern_list', 1, 3, 3).
python_function('.governance/governance_check.py', 'delivery_limits_valid', 1, 1, 3).
python_function('.governance/governance_check.py', 'delivery_policy_valid', 1, 11, 9).
python_function('.governance/governance_check.py', 'delivery_header_error', 1, 11, 6).
python_function('.governance/governance_check.py', 'delivery_budgets_error', 1, 8, 3).
python_function('.governance/governance_check.py', 'delivery_components_error', 1, 10, 7).
python_function('.governance/governance_check.py', 'delivery_ui_error', 1, 7, 5).
python_function('.governance/governance_check.py', 'delivery_ui_impact_error', 3, 10, 1).
python_function('.governance/governance_check.py', 'delivery_architecture_error', 1, 11, 7).
python_function('.governance/governance_check.py', 'delivery_validation_error', 1, 12, 8).
python_function('.governance/governance_check.py', 'standard_adoption_error', 1, 8, 5).
python_function('.governance/governance_check.py', 'delivery_intent_error', 1, 9, 10).
python_function('.governance/governance_check.py', 'matches', 2, 2, 8).
python_function('.governance/governance_check.py', 'segment_literal_prefix', 1, 3, 3).
python_function('.governance/governance_check.py', 'segment_literal_suffix', 1, 3, 2).
python_function('.governance/governance_check.py', 'segments_may_overlap', 2, 15, 6).
python_function('.governance/governance_check.py', 'patterns_may_overlap', 2, 1, 8).
python_function('.governance/governance_check.py', 'segment_pattern_covered_by', 2, 12, 11).
python_function('.governance/governance_check.py', 'pattern_covered_by', 2, 11, 9).
python_function('.governance/governance_check.py', 'git_output', 2, 1, 1).
python_function('.governance/governance_check.py', 'changed_paths', 4, 9, 9).
python_function('.governance/governance_check.py', 'check_history_order', 8, 12, 10).
python_function('.governance/governance_check.py', 'standard_policy_valid', 1, 5, 4).
python_function('.governance/governance_check.py', 'ticket_policy_valid', 1, 6, 6).
python_function('.governance/governance_check.py', 'ticket_scalar_policy_valid', 1, 6, 5).
python_function('.governance/governance_check.py', 'ticket_list_policy_valid', 1, 5, 7).
python_function('.governance/governance_check.py', 'docker_policy_valid', 1, 5, 4).
python_function('.governance/governance_check.py', 'workstreams_policy_valid', 1, 8, 8).
python_function('.governance/governance_check.py', 'integration_policy_valid', 2, 5, 4).
python_function('.governance/governance_check.py', 'coordination_policy_valid', 1, 9, 5).
python_function('.governance/governance_check.py', 'common_manifest_policy_valid', 1, 8, 8).
python_function('.governance/governance_check.py', 'basic_manifest_valid', 1, 11, 7).
python_function('.governance/governance_check.py', 'lock_standard_valid', 2, 8, 4).
python_function('.governance/governance_check.py', 'load_managed_lock', 2, 10, 10).
python_function('.governance/governance_check.py', 'check_managed_file', 4, 4, 7).
python_function('.governance/governance_check.py', 'extension_error', 3, 11, 3).
python_function('.governance/governance_check.py', 'check_lock', 4, 13, 14).
python_function('.governance/governance_check.py', 'parse_ticket_state', 1, 4, 4).
python_function('.governance/governance_check.py', 'ticket_directories', 2, 6, 7).
python_function('.governance/governance_check.py', 'intent_common_error', 2, 10, 6).
python_function('.governance/governance_check.py', 'ticket_id_list_error', 2, 6, 6).
python_function('.governance/governance_check.py', 'intent_v2_error', 2, 10, 5).
python_function('.governance/governance_check.py', 'intent_classification_error', 1, 6, 3).
python_function('.governance/governance_check.py', 'intent_fields_error', 1, 7, 4).
python_function('.governance/governance_check.py', 'validate_intent', 2, 9, 8).
python_function('.governance/governance_check.py', 'load_ticket_records', 2, 2, 4).
python_function('.governance/governance_check.py', 'repository_files', 2, 5, 8).
python_function('.governance/governance_check.py', 'valid_active_tickets', 5, 6, 4).
python_function('.governance/governance_check.py', 'check_workstream_limits', 4, 6, 7).
python_function('.governance/governance_check.py', 'dependency_graph', 4, 6, 4).
python_function('.governance/governance_check.py', 'find_dependency_cycle', 1, 3, 8).
python_function('.governance/governance_check.py', 'check_dependency_cycle', 2, 3, 4).
python_function('.governance/governance_check.py', 'integration_reference_valid', 2, 5, 2).
python_function('.governance/governance_check.py', 'check_active_relationships', 7, 14, 7).
python_function('.governance/governance_check.py', 'check_workstream_claims', 7, 15, 7).
python_function('.governance/governance_check.py', 'ticket_shared_files', 4, 8, 1).
python_function('.governance/governance_check.py', 'ticket_overlapping_patterns', 3, 9, 3).
python_function('.governance/governance_check.py', 'check_scope_overlaps', 4, 5, 5).
python_function('.governance/governance_check.py', 'check_ticket_statuses', 4, 4, 6).
python_function('.governance/governance_check.py', 'check_coordination', 5, 5, 12).
python_function('.governance/governance_check.py', 'check_required_files', 3, 10, 6).
python_function('.governance/governance_check.py', 'check_stacks', 4, 13, 11).
python_function('.governance/governance_check.py', 'check_ticket_content', 4, 12, 12).
python_function('.governance/governance_check.py', 'probable_secret_fields', 1, 5, 8).
python_function('.governance/governance_check.py', 'check_changed_file', 3, 9, 10).
python_function('.governance/governance_check.py', 'check_decision_log_file', 4, 12, 8).
python_function('.governance/governance_check.py', 'check_changed_content', 5, 7, 3).
python_function('.governance/governance_check.py', 'check_declared_delivery_budget', 5, 8, 2).
python_function('.governance/governance_check.py', 'check_delivery_timebox', 5, 4, 1).
python_function('.governance/governance_check.py', 'check_delivery_base', 7, 9, 4).
python_function('.governance/governance_check.py', 'map_implementation_components', 2, 6, 5).
python_function('.governance/governance_check.py', 'check_delivery_architecture', 6, 5, 6).
python_function('.governance/governance_check.py', 'check_actual_delivery_budget', 8, 10, 5).
python_function('.governance/governance_check.py', 'check_integration_ownership', 5, 4, 1).
python_function('.governance/governance_check.py', 'check_delivery_gate', 7, 5, 9).
python_function('.governance/governance_check.py', 'ticket_owns_implementation', 2, 5, 4).
python_function('.governance/governance_check.py', 'ticket_path_owners', 2, 6, 1).
python_function('.governance/governance_check.py', 'select_change_ticket', 5, 12, 6).
python_function('.governance/governance_check.py', 'check_selected_ticket_state', 8, 3, 3).
python_function('.governance/governance_check.py', 'check_workstream_change_scope', 5, 12, 6).
python_function('.governance/governance_check.py', 'check_selected_ticket_intent', 8, 9, 7).
python_function('.governance/governance_check.py', 'approval_subject_valid', 1, 13, 4).
python_function('.governance/governance_check.py', 'approval_actor_valid', 1, 5, 4).
python_function('.governance/governance_check.py', 'approval_verification_valid', 1, 5, 3).
python_function('.governance/governance_check.py', 'approval_authority_valid', 2, 11, 4).
python_function('.governance/governance_check.py', 'approval_binding_mismatches', 4, 7, 2).
python_function('.governance/governance_check.py', 'load_external_approval_evidence', 3, 9, 16).
python_function('.governance/governance_check.py', 'approval_evidence', 7, 10, 9).
python_function('.governance/governance_check.py', 'check_change_approval', 6, 4, 5).
python_function('.governance/governance_check.py', 'resolve_change_approval', 10, 3, 3).
python_function('.governance/governance_check.py', 'git_revision_file', 3, 2, 1).
python_function('.governance/governance_check.py', 'package_entry', 1, 13, 5).
python_function('.governance/governance_check.py', 'package_strategies', 1, 8, 6).
python_function('.governance/governance_check.py', 'adoption_standard_binding_is_valid', 2, 7, 6).
python_function('.governance/governance_check.py', 'adoption_lock', 2, 10, 10).
python_function('.governance/governance_check.py', 'content_digest', 1, 1, 2).
python_function('.governance/governance_check.py', 'standard_adoption_records', 1, 5, 2).
python_function('.governance/governance_check.py', 'load_standard_adoption_evidence', 3, 11, 10).
python_function('.governance/governance_check.py', 'verify_changed_managed_paths', 7, 11, 9).
python_function('.governance/governance_check.py', 'atomic_standard_adoption_paths', 5, 10, 8).
python_function('.governance/governance_check.py', 'check_change_gate', 15, 9, 8).
python_function('.governance/governance_check.py', 'sarif', 1, 5, 2).
python_function('.governance/governance_check.py', 'render_text', 1, 4, 3).
python_function('.governance/governance_check.py', 'parse_args', 1, 1, 3).
python_function('.governance/governance_check.py', 'load_manifest', 3, 4, 6).
python_function('.governance/governance_check.py', 'optional_repo_path', 5, 3, 3).
python_function('.governance/governance_check.py', 'resolve_changed_paths', 3, 2, 3).
python_function('.governance/governance_check.py', 'run_governance_checks', 4, 1, 12).
python_function('.governance/governance_check.py', 'formatted_report', 2, 3, 3).
python_function('.governance/governance_check.py', 'write_report', 2, 2, 3).
python_function('.governance/governance_check.py', 'write_resolved_ticket', 4, 6, 7).
python_function('.governance/governance_check.py', 'main', 1, 4, 11).
python_function('examples/src/helper.py', 'load_task', 1, 1, 2).
python_function('examples/src/helper.py', 'normalize_task', 1, 1, 2).
python_function('python/ast_extract.py', 'source_hash', 1, 1, 3).
python_function('python/ast_extract.py', 'dotted_name', 1, 5, 2).
python_function('python/ast_extract.py', 'is_module_entrypoint', 1, 10, 3).
python_function('python/ast_extract.py', 'iter_python_files', 2, 16, 15).
python_function('python/ast_extract.py', 'main', 0, 4, 19).
python_function('python/tests/test_python.py', 'test_placeholder', 0, 2, 0).
python_function('python/tests/test_python.py', 'test_import', 0, 1, 0).
python_function('scripts/research/evaluate-embedding-pairs.py', 'parse_args', 0, 1, 3).
python_function('scripts/research/evaluate-embedding-pairs.py', 'main', 0, 9, 21).
python_function('scripts/research/rank-intent-graph-embeddings.py', 'parse_args', 0, 1, 3).
python_function('scripts/research/rank-intent-graph-embeddings.py', 'projection_text', 2, 1, 3).
python_function('scripts/research/rank-intent-graph-embeddings.py', 'main', 0, 27, 24).
python_function('scripts/vallm-compatible.py', 'detect_file_language_with_parser_id', 1, 2, 2).
python_function('sdk/python/examples/basic.py', 'main', 0, 11, 21).
python_function('sdk/python/examples/local_runtime.py', 'main', 0, 1, 8).
python_function('sdk/python/todo2code/client.py', '_unwrap_task', 1, 4, 1).
python_function('sdk/python/todo2code/client.py', '_as_dict', 1, 2, 1).
python_function('sdk/python/todo2code/client.py', '_graph_dict', 1, 2, 1).
python_function('sdk/python/todo2code/client.py', '_report_dict', 1, 2, 1).
python_function('sdk/python/todo2code/runtime.py', '_resolve_cli', 1, 9, 10).
python_function('sdk/python/todo2code/runtime.py', '_parse_mapping', 2, 3, 3).
python_function('sdk/python/todo2code/runtime.py', '_load_mapping', 2, 2, 3).
python_function('sdk/python/todo2code_sdk.py', '_record_dict', 1, 1, 1).
python_function('src/interfaces/intake_cli.py', '_varint', 1, 5, 4).
python_function('src/interfaces/intake_cli.py', '_read_varint', 2, 4, 3).
python_function('src/interfaces/intake_cli.py', 'encode_envelope', 1, 6, 11).
python_function('src/interfaces/intake_cli.py', 'decode_envelope', 1, 10, 7).
python_function('src/interfaces/intake_cli.py', 'execute', 1, 3, 7).
python_function('src/interfaces/intake_cli.py', 'main', 0, 5, 16).

% ── Python Classes ───────────────────────────────────────
python_class('.governance/governance_check.py', 'Finding').
python_class('.governance/governance_check.py', 'TicketRecord').
python_class('.governance/governance_check.py', 'Report').
python_method('Report', '__init__', 1, 1, 0).
python_method('Report', 'add', 6, 2, 4).
python_method('Report', 'errors', 0, 2, 1).
python_method('Report', 'payload', 0, 4, 4).
python_class('python/ast_extract.py', 'FactVisitor').
python_method('FactVisitor', '__init__', 2, 1, 0).
python_method('FactVisitor', 'excerpt', 1, 1, 5).
python_method('FactVisitor', 'add', 6, 4, 6).
python_method('FactVisitor', 'visit_Import', 1, 2, 2).
python_method('FactVisitor', 'visit_ImportFrom', 1, 3, 3).
python_method('FactVisitor', 'visit_FunctionDef', 1, 3, 5).
python_method('FactVisitor', 'visit_AsyncFunctionDef', 1, 3, 5).
python_method('FactVisitor', 'visit_ClassDef', 1, 3, 5).
python_method('FactVisitor', 'add_named_constant', 3, 8, 6).
python_method('FactVisitor', 'visit_Assign', 1, 3, 3).
python_method('FactVisitor', 'visit_AnnAssign', 1, 3, 3).
python_method('FactVisitor', 'visit_If', 1, 3, 3).
python_method('FactVisitor', 'visit_Call', 1, 3, 4).
python_class('sdk/python/todo2code/client.py', 'T2CError').
python_method('T2CError', '__init__', 3, 1, 2).
python_class('sdk/python/todo2code/client.py', 'IntentRecord').
python_method('IntentRecord', 'from_dict', 2, 2, 2).
python_method('IntentRecord', 'action', 0, 1, 2).
python_method('IntentRecord', 'source_kind', 0, 1, 2).
python_method('IntentRecord', 'confidence', 0, 1, 2).
python_method('IntentRecord', 'generation', 0, 2, 2).
python_class('sdk/python/todo2code/client.py', 'ExtractionResult').
python_method('ExtractionResult', 'from_dict', 2, 2, 6).
python_class('sdk/python/todo2code/client.py', 'Diagnostic').
python_method('Diagnostic', 'from_dict', 2, 2, 3).
python_class('sdk/python/todo2code/client.py', 'DiagnosticReport').
python_method('DiagnosticReport', 'from_dict', 2, 2, 4).
python_method('DiagnosticReport', 'blocking', 0, 3, 1).
python_class('sdk/python/todo2code/client.py', 'IntentGraph').
python_method('IntentGraph', 'from_dict', 2, 2, 4).
python_class('sdk/python/todo2code/client.py', 'T2CClient').
python_method('T2CClient', '__init__', 3, 1, 1).
python_method('T2CClient', '_headers', 1, 3, 0).
python_method('T2CClient', '_open', 1, 7, 8).
python_method('T2CClient', '_rpc', 2, 4, 8).
python_method('T2CClient', '_get', 1, 1, 3).
python_method('T2CClient', 'health', 0, 1, 1).
python_method('T2CClient', 'agent_card', 0, 1, 1).
python_method('T2CClient', 'send', 2, 3, 7).
python_method('T2CClient', 'call', 2, 7, 5).
python_method('T2CClient', 'compare_workspace', 0, 1, 1).
python_method('T2CClient', 'propose_todo', 1, 1, 1).
python_method('T2CClient', 'render_todo', 1, 1, 1).
python_method('T2CClient', 'apply_todo', 1, 1, 1).
python_method('T2CClient', 'get_task', 1, 2, 2).
python_method('T2CClient', 'cancel_task', 1, 1, 2).
python_method('T2CClient', 'list_tasks', 0, 1, 1).
python_method('T2CClient', 'extract_nl', 3, 1, 1).
python_method('T2CClient', 'extract_nl_result', 3, 2, 2).
python_method('T2CClient', 'extract_git', 2, 2, 4).
python_method('T2CClient', 'extract_ast', 1, 2, 4).
python_method('T2CClient', 'extract_config', 1, 2, 4).
python_method('T2CClient', 'extract_markdown', 4, 1, 1).
python_method('T2CClient', 'extract_markdown_result', 4, 2, 2).
python_method('T2CClient', 'extract_docs', 3, 1, 1).
python_method('T2CClient', 'extract_docs_result', 3, 3, 3).
python_method('T2CClient', 'link', 1, 3, 4).
python_method('T2CClient', 'diagnose', 1, 1, 3).
python_method('T2CClient', 'summarize', 3, 2, 3).
python_method('T2CClient', 'diff_graphs', 3, 1, 2).
python_method('T2CClient', 'diff_graphs_rest', 0, 2, 6).
python_method('T2CClient', 'diff_files', 2, 1, 1).
python_method('T2CClient', 'diff_git', 0, 1, 1).
python_method('T2CClient', 'reality', 2, 2, 3).
python_method('T2CClient', 'pipeline', 0, 1, 1).
python_class('sdk/python/todo2code/runtime.py', 'TypeScriptRuntimeError').
python_class('sdk/python/todo2code/runtime.py', 'RuntimeResult').
python_class('sdk/python/todo2code/runtime.py', 'TypeScriptRuntime').
python_method('TypeScriptRuntime', '__init__', 1, 3, 6).
python_method('TypeScriptRuntime', 'invoke', 1, 7, 8).
python_method('TypeScriptRuntime', 'version', 0, 1, 2).
python_method('TypeScriptRuntime', 'pipeline', 0, 6, 5).
python_method('TypeScriptRuntime', 'diagnose', 1, 1, 6).
python_method('TypeScriptRuntime', 'diff_graphs', 2, 3, 8).
python_method('TypeScriptRuntime', 'reality', 1, 5, 9).
python_class('sdk/python/todo2code_sdk.py', 'Todo2CodeClient').
python_method('Todo2CodeClient', '__init__', 3, 1, 1).
python_method('Todo2CodeClient', 'base_url', 0, 1, 0).
python_method('Todo2CodeClient', 'health', 0, 1, 2).
python_method('Todo2CodeClient', 'extract_nl', 3, 2, 3).
python_method('Todo2CodeClient', 'extract_docs', 3, 2, 3).
python_method('Todo2CodeClient', 'diff_graphs', 3, 1, 2).
python_method('Todo2CodeClient', 'diff_graph_files', 3, 1, 2).
python_method('Todo2CodeClient', 'diff_text_files', 2, 1, 2).
python_method('Todo2CodeClient', 'diff_git', 0, 1, 2).
python_method('Todo2CodeClient', 'reality', 1, 1, 2).
python_method('Todo2CodeClient', 'run', 2, 2, 1).

% ── Dependencies ─────────────────────────────────────────

% ── Makefile Targets ─────────────────────────────────────
makefile_target('SHELL', '').
makefile_target('help', '').
makefile_target('setup', '').
makefile_target('install', '').
makefile_target('install-tf', '').
makefile_target('build', '').
makefile_target('check', '').
makefile_target('test', '').
makefile_target('verify-no-llm', '').
makefile_target('verify-modules', '').
makefile_target('verify-env', '').
makefile_target('verify', '').
makefile_target('governance', '').
makefile_target('smoke', '').
makefile_target('doctor', '').
makefile_target('mcp-probe', '').
makefile_target('a2a-probe', '').
makefile_target('protocol-smoke', '').
makefile_target('validate', '').
makefile_target('live-contract-check', '').
makefile_target('live-model-comparison', '').
makefile_target('demo', '').
makefile_target('demollm', '').
makefile_target('examples-check', '').
makefile_target('pipeline', '').
makefile_target('compare-workspace', '').
makefile_target('preflight', '').
makefile_target('mcp', '').
makefile_target('a2a', '').
makefile_target('docker-build', '').
makefile_target('docker-smoke', '').
makefile_target('docker-up', '').
makefile_target('docker-down', '').
makefile_target('e2e-core', '').
makefile_target('e2e-full', '').
makefile_target('e2e-clean', '').
makefile_target('python-wheel', '').
makefile_target('package', '').
makefile_target('clean', '').

% ── Taskfile Tasks ───────────────────────────────────────

% ── Environment Variables ────────────────────────────────
env_variable('T2C_ENV_FILE', '*(not set)*', 'Bootstrap-only override used before this file is loaded. Usually leave empty.').
env_variable('T2C_ROOT', '.', '').
env_variable('T2C_OUTPUT_DIR', '.intent', '').
env_variable('T2C_GIT_COMMIT_COUNT', '10', '').
env_variable('T2C_MAX_FILE_BYTES', '524288', '').
env_variable('T2C_DOC_CONCURRENCY', '3', '').
env_variable('T2C_DOC_CHUNK_CHARS', '8000', '').
env_variable('T2C_DOC_MAX_CHUNKS', '12', '').
env_variable('T2C_DOC_MAX_RECORDS_PER_CHUNK', '24', '').
env_variable('T2C_DOC_TIMEOUT_MS', '45000', '').
env_variable('T2C_PYTHON', 'python3', '').
env_variable('T2C_ENABLE_PYTHON_AST', 'true', '').
env_variable('T2C_GO', 'go', '').
env_variable('T2C_ENABLE_GO_AST', 'true', '').
env_variable('T2C_JAVA', 'java', '').
env_variable('T2C_ENABLE_JAVA_AST', 'true', '').
env_variable('T2C_CARGO', 'cargo', '').
env_variable('T2C_ENABLE_RUST_AST', 'true', '').
env_variable('T2C_PHP', 'php', '').
env_variable('T2C_ENABLE_PHP_AST', 'true', '').
env_variable('T2C_ALLOW_OUTSIDE_ROOT', 'false', '').
env_variable('T2C_ENABLE_TF', 'false', 'Optional TensorFlow action classifier. Heuristics remain the deterministic fallback.').
env_variable('T2C_TF_MODEL_PATH', '*(not set)*', '').
env_variable('T2C_TF_MODULE_PATH', 'adapters/tensorflow/node_modules/@tensorflow/tfjs-node/dist/index.js', '').
env_variable('T2C_TF_LABELS', 'add,fix,remove,refactor,test,document,configure,analyze,unknown', '').
env_variable('T2C_NL_MODE', 'require-llm', 'NL/TODO/CHANGELOG -> Intent DSL, documentation -> Intent DSL, Intent DSL -> NL/tasks').
env_variable('T2C_MARKDOWN_MODE', 'require-llm', '').
env_variable('T2C_COMMUNICATION_MODE', 'require-llm', '').
env_variable('OPENROUTER_API_KEY', '*(not set)*', '').
env_variable('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1', '').
env_variable('OPENROUTER_MODEL', 'mistralai/codestral-2508', '').
env_variable('OPENROUTER_NL_MODEL', '*(not set)*', '').
env_variable('OPENROUTER_MARKDOWN_MODEL', '*(not set)*', '').
env_variable('OPENROUTER_COMMUNICATION_MODEL', '*(not set)*', '').
env_variable('OPENROUTER_DOC_MODEL', '*(not set)*', '').
env_variable('OPENROUTER_SUMMARY_MODEL', '*(not set)*', '').
env_variable('OPENROUTER_TASK_MODEL', '*(not set)*', '').
env_variable('OPENROUTER_SITE_URL', 'http://localhost:8787', '').
env_variable('OPENROUTER_APP_NAME', 'todo2code', '').
env_variable('OPENROUTER_TIMEOUT_MS', '120000', '').
env_variable('OPENROUTER_MAX_TOKENS', '6000', '').
env_variable('OPENROUTER_TEMPERATURE', '0', '').
env_variable('OPENROUTER_REQUIRE_STRUCTURED_OUTPUT', 'true', '').
env_variable('OPENROUTER_RESPONSE_HEALING', 'true', '').
env_variable('T2C_REQUIRE_LIVE_CHECK', 'false', 'The check runs all six semantic stages through the pipeline in require-llm.').
env_variable('T2C_LIVE_AUDIT_PATH', '.intent-live/contract-check.json', '').
env_variable('T2C_LIVE_HISTORY_PATH', '.intent-live/contract-check-history.json', 'Recorded trend of past runs. Reported, never a pass/fail threshold.').
env_variable('T2C_LIVE_RUN_OUTPUT', '.intent-live-run', '').
env_variable('T2C_LIVE_MAX_STAGE_LATENCY_MS', '300000', 'Per-stage ceiling; one slow stage is a signal an average would hide.').
env_variable('T2C_LIVE_MAX_LATENCY_MS', '120000', 'Legacy alias for the per-stage ceiling, still honoured when it is set alone.').
env_variable('T2C_LIVE_MAX_TOTAL_LATENCY_MS', '900000', '').
env_variable('T2C_LIVE_MAX_COST_USD', '0.5', '').
env_variable('T2C_LIVE_COMPARE_MODELS', 'mistralai/codestral-2508,google/gemini-3-flash-preview', 'Opt-in batched TODO/CHANGELOG model comparison. Never part of offline CI.').
env_variable('T2C_LIVE_COMPARE_ROOT', '.', '').
env_variable('T2C_LIVE_COMPARE_TIMEOUT_MS', '300000', '').
env_variable('T2C_LIVE_COMPARE_PATH', '.intent-live/model-comparison.json', '').
env_variable('T2C_LIVE_COMPARE_MD_PATH', '.intent-live/model-comparison.md', '').
env_variable('T2C_DOC_PATTERNS', 'README.md,docs/**/*.md,project/**/*.md,packages/**/MODULE.md', 'Default document selection. TODO and CHANGELOG have a dedicated structural + LLM stage.').
env_variable('T2C_MARKDOWN_CONCURRENCY', '3', '').
env_variable('T2C_DOC_EXCLUDES', 'node_modules/**,.git/**,dist/**,.intent/**,TODO.md,CHANGELOG.md', '').
env_variable('T2C_MCP_SERVER_NAME', 'todo2code', 'MCP stdio server').
env_variable('T2C_MCP_SERVER_VERSION', '0.5.0', '').
env_variable('T2C_A2A_HOST', '127.0.0.1', 'token whenever you widen the host. Docker Compose sets 0.0.0.0 itself.').
env_variable('T2C_A2A_PORT', '8787', '').
env_variable('T2C_A2A_PUBLIC_URL', 'http://localhost:8787/a2a', '').
env_variable('T2C_A2A_TOKEN', '*(not set)*', '').
env_variable('T2C_A2A_MAX_BODY_BYTES', '1048576', '').
env_variable('T2C_A2A_TASK_STORE', '*(not set)*', 'Optional shared snapshot for restart persistence and multi-replica deployments.').
env_variable('T2C_WORKSPACE', '.', 'Docker Compose host settings. Container port remains 8787.').
env_variable('T2C_DOCKER_HOST_PORT', '8787', '').
env_variable('T2C_A2A_URL', 'http://localhost:8787', 'SDK/example clients. T2C_A2A_TOKEN above is shared with the server.').
env_variable('T2C_EXAMPLE_ROOT', 'examples/backend', '').
env_variable('T2C_COMPARE_WORKSPACE', 'false', '').
env_variable('T2C_COMPARE_BASE', 'origin/main', '').
env_variable('T2C_TYPESCRIPT_CLI', '*(not set)*', '').

% ── TestQL Scenarios ─────────────────────────────────────
testql_scenario('generated-cli-tests.testql.toon.yaml', 'cli').

% ── Semantic Facts from SUMD.md ──────────────────────────
```

## Call Graph

*454 nodes · 500 edges · 40 modules · CC̄=3.8*

### Hubs (by degree)

| Function | CC | in | out | total |
|----------|----|----|-----|-------|
| `extractTypeScriptFile` *(in src.extractors.ast.typescript)* | 43 ⚠ | 0 | 44 | **44** |
| `visit` *(in src.extractors.ast.typescript)* | 25 ⚠ | 1 | 26 | **27** |
| `extractTodo` *(in src.extractors.todo)* | 5 | 0 | 24 | **24** |
| `extractNlIntentAudited` *(in src.extractors.nl-llm.NlLlmRequiredError)* | 10 ⚠ | 0 | 22 | **22** |
| `collect_files` *(in rust-ast.src.main)* | 9 | 1 | 20 | **21** |
| `extractGitIntent` *(in src.extractors.git)* | 13 ⚠ | 0 | 21 | **21** |
| `extractAstIntent` *(in src.extractors.ast)* | 12 ⚠ | 1 | 20 | **21** |
| `main` *(in rust-ast.src.main)* | 6 | 0 | 21 | **21** |

```toon markpact:analysis path=project/calls.toon.yaml
# code2llm call graph | /home/tom/github/autogrammar/todo2code
# generated in 0.28s
# nodes: 454 | edges: 500 | modules: 40
# CC̄=3.8

HUBS[20]:
  src.extractors.ast.typescript.extractTypeScriptFile
    CC=43  in:0  out:44  total:44
  src.extractors.ast.typescript.visit
    CC=25  in:1  out:26  total:27
  src.extractors.todo.extractTodo
    CC=5  in:0  out:24  total:24
  src.extractors.nl-llm.NlLlmRequiredError.extractNlIntentAudited
    CC=10  in:0  out:22  total:22
  rust-ast.src.main.collect_files
    CC=9  in:1  out:20  total:21
  src.extractors.git.extractGitIntent
    CC=13  in:0  out:21  total:21
  src.extractors.ast.extractAstIntent
    CC=12  in:1  out:20  total:21
  rust-ast.src.main.main
    CC=6  in:0  out:21  total:21
  src.extractors.nl.extractNlIntent
    CC=5  in:0  out:20  total:20
  src.extractors.todo.relative
    CC=5  in:0  out:20  total:20
  src.extractors.todo.body
    CC=5  in:0  out:20  total:20
  src.extractors.todo.lines
    CC=5  in:0  out:20  total:20
  rust-ast.src.main.add
    CC=1  in:9  out:10  total:19
  src.semantic.reranker-llm.SemanticRerankerRequiredError.rerankSemanticCandidates
    CC=25  in:0  out:19  total:19
  src.graph.diff.diffIntentGraphs
    CC=11  in:0  out:19  total:19
  src.extractors.markdown-paths.buildBasenameIndex
    CC=17  in:3  out:16  total:19
  src.extractors.changelog.extractChangelog
    CC=10  in:0  out:19  total:19
  src.core.truth-map.RecordComponents.projectTruthMap
    CC=7  in:0  out:18  total:18
  src.extractors.docs-deterministic.convertDocument
    CC=18  in:3  out:13  total:16
  java.JavaAstExtract.JavaAstExtract.main
    CC=10  in:0  out:16  total:16

MODULES:
  examples.backend.src.server  [12 funcs]
    createBackend  CC=4  out:5
    event  CC=1  out:1
    handleRequest  CC=16  out:12
    limit  CC=1  out:1
    offset  CC=1  out:1
    readBody  CC=3  out:5
    sendJson  CC=1  out:4
    server  CC=3  out:4
    size  CC=3  out:3
    startBackend  CC=3  out:3
  examples.backend.src.validation  [7 funcs]
    ALLOWED_ACTIONS  CC=10  out:5
    action  CC=2  out:3
    agent  CC=2  out:3
    invalid  CC=1  out:0
    object  CC=2  out:3
    record  CC=2  out:3
    validateEventPayload  CC=10  out:5
  examples.frontend.src.app  [5 funcs]
    createState  CC=1  out:0
    mountPanel  CC=1  out:4
    refresh  CC=4  out:6
    reload  CC=1  out:1
    state  CC=1  out:1
  examples.frontend.src.render  [4 funcs]
    classifyEvent  CC=4  out:0
    headerRow  CC=2  out:2
    renderTable  CC=3  out:4
    toRows  CC=1  out:2
  examples.src.runtime  [2 funcs]
    executeContract  CC=1  out:1
    validateContract  CC=2  out:1
  java.JavaAstExtract  [10 funcs]
    add  CC=1  out:0
    collect  CC=1  out:11
    containsIgnored  CC=3  out:2
    emit  CC=1  out:3
    escape  CC=9  out:6
    json  CC=1  out:1
    main  CC=10  out:16
    map  CC=1  out:0
    slash  CC=1  out:1
    try  CC=3  out:13
  rust-ast.src.main  [21 funcs]
    add  CC=1  out:10
    arguments  CC=5  out:9
    collect_files  CC=9  out:20
    excerpt  CC=1  out:7
    main  CC=6  out:21
    modifiers  CC=3  out:4
    qualified  CC=2  out:3
    slash  CC=1  out:2
    type_item  CC=1  out:8
    visit_expr_call  CC=1  out:9
  src.core.content-cache  [4 funcs]
    assertNamespace  CC=2  out:2
    getOrCompute  CC=5  out:7
    value  CC=1  out:1
    write  CC=3  out:9
  src.core.grounding  [2 funcs]
    groundRecordIdsByDiagnostics  CC=5  out:10
    sortedUnique  CC=1  out:3
  src.core.id  [13 funcs]
    createCodeChangePlanHash  CC=2  out:9
    createCodeChangePlanId  CC=1  out:2
    createCodeChangeSourcePatchHash  CC=3  out:9
    createCodeChangeSourcePatchId  CC=1  out:2
    createConclusionId  CC=1  out:5
    createIntentId  CC=1  out:2
    createRelationId  CC=1  out:2
    createTodoProposalId  CC=1  out:6
    graphFingerprint  CC=1  out:5
    sha256  CC=1  out:3
  src.core.ignore  [13 funcs]
    char  CC=3  out:1
    compileIgnorePattern  CC=4  out:8
    createIgnoreMatcher  CC=8  out:8
    decide  CC=5  out:1
    escapeLiteral  CC=2  out:1
    files  CC=3  out:4
    loadIgnoreMatcher  CC=7  out:6
    next  CC=2  out:1
    normalize  CC=5  out:1
    parseIgnoreFile  CC=2  out:4
  src.core.record  [5 funcs]
    buildRecord  CC=18  out:8
    clamp  CC=1  out:3
    extractorIdentity  CC=3  out:2
    generationMetadata  CC=15  out:1
    sourcePrefix  CC=1  out:0
  src.core.security  [4 funcs]
    assertDescendant  CC=3  out:4
    assertPathWithinRoot  CC=3  out:5
    nearestExistingPath  CC=7  out:3
    relative  CC=3  out:3
  src.core.target  [8 funcs]
    GENERIC_FILES  CC=9  out:4
    GENERIC_SYMBOLS  CC=9  out:4
    normalizePath  CC=1  out:2
    normalizeSymbol  CC=1  out:2
    normalizeTarget  CC=9  out:4
    pathAliases  CC=5  out:8
    symbolAliases  CC=6  out:10
    unique  CC=1  out:5
  src.core.text  [17 funcs]
    GENERIC_TOPICS  CC=2  out:7
    PATH_ROOTS  CC=13  out:12
    STOP_WORDS  CC=17  out:5
    classifyActionHeuristically  CC=17  out:5
    detectModality  CC=11  out:6
    detectPolarity  CC=8  out:4
    extractBacktickValues  CC=4  out:4
    extractPaths  CC=5  out:7
    extractSymbols  CC=7  out:15
    extractTickets  CC=2  out:7
  src.core.truth-map  [8 funcs]
    MAPPING_RELATIONS  CC=7  out:7
    assertIntentGraph  CC=1  out:0
    components  CC=3  out:4
    connect  CC=4  out:3
    find  CC=3  out:3
    mappingRelations  CC=3  out:4
    projectTruthMap  CC=7  out:18
    requireDateTime  CC=4  out:3
  src.extractors.ast  [5 funcs]
    code2dsl  CC=2  out:3
    extractAstIntent  CC=12  out:20
    isExtractionResult  CC=5  out:3
    isIntentRecords  CC=2  out:1
    requireStandaloneRoot  CC=3  out:2
  src.extractors.ast.external  [3 funcs]
    execFileAsync  CC=3  out:0
    result  CC=2  out:1
    runExternalAstAdapter  CC=9  out:6
  src.extractors.ast.records  [7 funcs]
    adapterRecords  CC=2  out:3
    boundedCapabilities  CC=1  out:6
    capabilities  CC=1  out:2
    end  CC=1  out:2
    moduleRecords  CC=6  out:14
    moduleTopicText  CC=2  out:1
    start  CC=1  out:2
  src.extractors.ast.typescript  [14 funcs]
    add  CC=14  out:7
    callee  CC=2  out:2
    capabilities  CC=1  out:2
    declarationIsCallable  CC=4  out:2
    excerpt  CC=1  out:2
    extractTypeScriptFile  CC=43  out:44
    isTopLevel  CC=5  out:3
    languageName  CC=2  out:3
    lineRange  CC=1  out:3
    modifiers  CC=4  out:4
  src.extractors.changelog  [5 funcs]
    body  CC=7  out:15
    changelogAction  CC=11  out:3
    extractChangelog  CC=10  out:19
    lines  CC=7  out:15
    relative  CC=7  out:15
  src.extractors.configuration  [24 funcs]
    bounded  CC=1  out:3
    config2dsl  CC=2  out:3
    configurationFormat  CC=6  out:4
    configurationRecords  CC=4  out:12
    dockerEntries  CC=6  out:6
    entries  CC=1  out:3
    entry  CC=1  out:1
    extractConfigurationIntent  CC=4  out:10
    fileAggregate  CC=3  out:10
    files  CC=4  out:5
  src.extractors.docs-chunks  [15 funcs]
    chunkMarkdown  CC=8  out:9
    chunkPriority  CC=3  out:4
    flush  CC=2  out:2
    index  CC=1  out:3
    item  CC=1  out:3
    mapConcurrent  CC=3  out:7
    markdownSections  CC=4  out:2
    needles  CC=1  out:2
    prioritizeDocumentChunks  CC=3  out:6
    sectionLines  CC=2  out:3
  src.extractors.docs-deterministic  [25 funcs]
    action  CC=3  out:6
    block  CC=1  out:1
    bullet  CC=4  out:3
    codeBlockRecord  CC=2  out:2
    convertDocument  CC=18  out:13
    docs2dsl  CC=3  out:6
    extractDocumentationBaseline  CC=4  out:8
    fenceMatch  CC=7  out:5
    files  CC=1  out:1
    level  CC=3  out:2
  src.extractors.docs-llm  [8 funcs]
    errorMessage  CC=2  out:1
    extractChunk  CC=12  out:8
    extractDocumentationIntent  CC=3  out:12
    files  CC=3  out:7
    loadDocumentChunks  CC=4  out:8
    readPrompt  CC=2  out:6
    requireConfiguredClient  CC=3  out:4
    selectWithinBudget  CC=2  out:3
  src.extractors.docs-record  [20 funcs]
    OBJECT_PLACEHOLDERS  CC=14  out:13
    action  CC=11  out:7
    allowedAction  CC=1  out:1
    allowedLifecycle  CC=1  out:1
    allowedModality  CC=1  out:1
    anchorToSource  CC=7  out:10
    clampLine  CC=1  out:3
    fallback  CC=2  out:1
    hasTarget  CC=4  out:1
    isPlaceholder  CC=3  out:3
  src.extractors.docs-schema  [5 funcs]
    documentRecord  CC=1  out:8
    documentResponseContract  CC=1  out:2
    documentResponseSchema  CC=1  out:1
    strings  CC=1  out:2
    target  CC=1  out:2
  src.extractors.git  [10 funcs]
    count  CC=3  out:2
    execFileAsync  CC=1  out:0
    extractChangedSymbols  CC=9  out:3
    extractGitIntent  CC=13  out:21
    readChangedFiles  CC=6  out:5
    readCommits  CC=1  out:7
    readStats  CC=6  out:4
    result  CC=1  out:1
    root  CC=3  out:2
    runGit  CC=1  out:1
  src.extractors.markdown-paths  [9 funcs]
    MAX_INDEXED_FILES  CC=12  out:12
    PATH_SEARCH_EXCLUDES  CC=12  out:12
    basenames  CC=11  out:10
    buildBasenameIndex  CC=17  out:16
    createMarkdownPathResolver  CC=12  out:12
    headingDirectories  CC=11  out:9
    headingScopes  CC=4  out:6
    isRepositoryPath  CC=5  out:3
    repositoryRoot  CC=11  out:11
  src.extractors.nl  [12 funcs]
    absolute  CC=2  out:14
    action  CC=1  out:9
    assertNlExtractionOptions  CC=9  out:2
    body  CC=2  out:14
    classified  CC=1  out:9
    confidence  CC=1  out:9
    detectMissingFields  CC=10  out:5
    extractNlIntent  CC=5  out:20
    inferActor  CC=5  out:2
    missing  CC=1  out:9
  src.extractors.nl-llm  [33 funcs]
    NL_RECORD_CONTRACT  CC=1  out:7
    action  CC=1  out:1
    allowedAction  CC=1  out:1
    allowedModality  CC=1  out:1
    audit  CC=1  out:1
    clampLine  CC=1  out:3
    deterministic  CC=1  out:1
    end  CC=1  out:1
    excerpt  CC=1  out:1
    extractNlWithCorrection  CC=1  out:0
  src.extractors.runtime-cycle  [17 funcs]
    MAX_PER_SECTION  CC=8  out:12
    boundedArray  CC=8  out:4
    driftRecord  CC=5  out:5
    extractRuntimeCycleIntent  CC=8  out:12
    factsMetadata  CC=5  out:3
    jsonScalar  CC=6  out:1
    label  CC=2  out:1
    parseCycle  CC=7  out:5
    probeRecord  CC=9  out:8
    proposalAction  CC=5  out:0
  src.extractors.todo  [16 funcs]
    action  CC=2  out:12
    block  CC=2  out:12
    body  CC=5  out:20
    checked  CC=2  out:12
    classified  CC=2  out:12
    extractExplicitId  CC=5  out:3
    extractTodo  CC=5  out:24
    heading  CC=1  out:1
    inferOwner  CC=4  out:1
    lines  CC=5  out:20
  src.graph.capability-evidence  [5 funcs]
    aggregateCapabilityOverlap  CC=10  out:4
    aggregateCapabilityTopics  CC=2  out:5
    declaredCapabilityTopics  CC=3  out:3
    hasCapabilityClaim  CC=1  out:1
    isFileAggregate  CC=2  out:0
  src.graph.changelog-signal  [6 funcs]
    GENERATED_ANALYSIS_BASENAMES  CC=6  out:5
    isActionableChangelogRecord  CC=6  out:5
    isFileOnlyUpdate  CC=6  out:7
    isFileSummary  CC=3  out:1
    isPlaceholder  CC=6  out:3
    match  CC=1  out:0
  src.graph.diff  [26 funcs]
    afterGroups  CC=7  out:6
    afterRecord  CC=1  out:3
    assertGraph  CC=3  out:3
    beforeGroups  CC=7  out:6
    beforeRecord  CC=1  out:3
    changedFieldPaths  CC=6  out:6
    compareRelations  CC=1  out:2
    diffIntentGraphs  CC=11  out:19
    escapeXml  CC=2  out:1
    groupRecords  CC=4  out:6
  src.graph.symbol-resolution  [10 funcs]
    buildSymbolResolutionIndex  CC=15  out:13
    byAlias  CC=9  out:8
    byNlRecord  CC=4  out:3
    hasResolvedNlAstSymbolPair  CC=10  out:3
    isAstDeclaration  CC=3  out:0
    pathSelects  CC=3  out:5
    resolveSymbol  CC=8  out:6
    selected  CC=2  out:1
    uniquePaths  CC=1  out:3
    values  CC=2  out:0
  src.semantic.reranker-llm  [8 funcs]
    assertSemanticCandidateSet  CC=2  out:1
    assertSemanticRerankResult  CC=2  out:1
    assertTrackedSnapshot  CC=1  out:0
    model  CC=4  out:2
    modelRevision  CC=4  out:2
    payload  CC=1  out:3
    projectRecord  CC=3  out:3
    rerankSemanticCandidates  CC=25  out:19
  src.services.branch-portfolio-assembler  [30 funcs]
    afterToBefore  CC=5  out:4
    assembleBranchPortfolio  CC=1  out:9
    assertionAnchors  CC=4  out:3
    baseAssertions  CC=5  out:4
    baseBundle  CC=1  out:3
    buildCandidateState  CC=1  out:8
    buildPairEvidence  CC=7  out:6
    bundles  CC=3  out:4
    candidateByBase  CC=5  out:4
    changeFromAssertions  CC=1  out:2
  src.tf.classifier  [6 funcs]
    classifyAction  CC=17  out:12
    dynamicImport  CC=1  out:3
    importer  CC=1  out:0
    loadAssets  CC=2  out:6
    loadClassifier  CC=6  out:5
    vectorize  CC=6  out:5

EDGES:
  rust-ast.src.main.main → rust-ast.src.main.arguments
  rust-ast.src.main.main → rust-ast.src.main.collect_files
  rust-ast.src.main.main → rust-ast.src.main.slash
  rust-ast.src.main.collect_files → rust-ast.src.main.slash
  rust-ast.src.main.add → rust-ast.src.main.excerpt
  rust-ast.src.main.visit_item_mod → rust-ast.src.main.qualified
  rust-ast.src.main.visit_item_mod → rust-ast.src.main.add
  rust-ast.src.main.visit_item_use → rust-ast.src.main.add
  rust-ast.src.main.visit_item_struct → rust-ast.src.main.type_item
  rust-ast.src.main.visit_item_enum → rust-ast.src.main.type_item
  rust-ast.src.main.visit_item_trait → rust-ast.src.main.type_item
  rust-ast.src.main.visit_item_type → rust-ast.src.main.type_item
  rust-ast.src.main.visit_item_const → rust-ast.src.main.qualified
  rust-ast.src.main.visit_item_const → rust-ast.src.main.add
  rust-ast.src.main.visit_item_const → rust-ast.src.main.modifiers
  rust-ast.src.main.visit_item_static → rust-ast.src.main.qualified
  rust-ast.src.main.visit_item_static → rust-ast.src.main.add
  rust-ast.src.main.visit_item_static → rust-ast.src.main.modifiers
  rust-ast.src.main.visit_item_fn → rust-ast.src.main.qualified
  rust-ast.src.main.visit_item_fn → rust-ast.src.main.add
  rust-ast.src.main.visit_impl_item_fn → rust-ast.src.main.add
  rust-ast.src.main.visit_expr_call → rust-ast.src.main.add
  rust-ast.src.main.visit_expr_method_call → rust-ast.src.main.add
  rust-ast.src.main.type_item → rust-ast.src.main.qualified
  rust-ast.src.main.type_item → rust-ast.src.main.add
  rust-ast.src.main.type_item → rust-ast.src.main.modifiers
  examples.src.runtime.executeContract → examples.src.runtime.validateContract
  examples.backend.src.validation.ALLOWED_ACTIONS → examples.backend.src.validation.invalid
  examples.backend.src.validation.validateEventPayload → examples.backend.src.validation.invalid
  examples.backend.src.validation.record → examples.backend.src.validation.invalid
  examples.backend.src.validation.agent → examples.backend.src.validation.invalid
  examples.backend.src.validation.action → examples.backend.src.validation.invalid
  examples.backend.src.validation.object → examples.backend.src.validation.invalid
  examples.frontend.src.app.mountPanel → examples.frontend.src.app.createState
  examples.frontend.src.app.mountPanel → examples.frontend.src.app.refresh
  examples.frontend.src.app.mountPanel → examples.frontend.src.app.reload
  examples.frontend.src.app.mountPanel → examples.frontend.src.app.state
  examples.frontend.src.app.state → examples.frontend.src.app.refresh
  examples.frontend.src.app.reload → examples.frontend.src.app.refresh
  src.extractors.nl.extractNlIntent → src.extractors.nl.assertNlExtractionOptions
  src.extractors.nl.extractNlIntent → src.extractors.nl.detectMissingFields
  src.extractors.nl.absolute → src.extractors.nl.detectMissingFields
  src.extractors.nl.absolute → src.extractors.nl.inferActor
  src.extractors.nl.body → src.extractors.nl.detectMissingFields
  src.extractors.nl.body → src.extractors.nl.inferActor
  src.extractors.nl.sourcePath → src.extractors.nl.detectMissingFields
  src.extractors.nl.sourcePath → src.extractors.nl.inferActor
  src.extractors.nl.classified → src.extractors.nl.inferActor
  src.extractors.nl.action → src.extractors.nl.inferActor
  src.extractors.nl.object → src.extractors.nl.inferActor
```

## Test Contracts

*Scenarios as contract signatures — what the system guarantees.*

### Cli (1)

**`CLI Command Tests`**

## Intent

Dependency-free Python SDK for todo2code A2A and the local TypeScript runtime
