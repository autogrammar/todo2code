# todo2code (`t2c`)

SUMD - Structured Unified Markdown Descriptor for AI-aware project refactorization

## Contents

- [Metadata](#metadata)
- [Architecture](#architecture)
- [Workflows](#workflows)
- [Dependencies](#dependencies)
- [Call Graph](#call-graph)
- [Test Contracts](#test-contracts)
- [Refactoring Analysis](#refactoring-analysis)
- [Intent](#intent)

## Metadata

- **name**: `todo2code`
- **version**: `0.5.1`
- **python_requires**: `>=3.10`
- **license**: Apache-2.0
- **ecosystem**: SUMD + DOQL + testql + taskfile
- **generated_from**: pyproject.toml, Makefile, testql(1), app.doql.less, goal.yaml, .env.example, Dockerfile, docker-compose.yml, package.json, project/(6 analysis files)

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

## Workflows

## Dependencies

### Runtime (Node.js)

```text markpact:deps node
typescript
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

## Refactoring Analysis

*Pre-refactoring snapshot — use this section to identify targets. Generated from `project/` toon files.*

### Call Graph & Complexity (`project/calls.toon.yaml`)

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

### Code Analysis (`project/analysis.toon.yaml`)

```toon markpact:analysis path=project/analysis.toon.yaml
# code2llm | 306f 58934L | typescript:133,md:61,json:41,javascript:17,python:16,shell:9,rust:7,go:6,php:4,toml:3,yaml:2,yml:2,java:1,proto:1,txt:1 | 2026-08-16
# generated in 0.35s
# CC̅=3.8 | critical:128/4221 | dups:0 | cycles:0

HEALTH[20]:
  🔴 GOD   src/extractors/communication.ts = 685L, 6 classes, 90m, max CC=15
  🔴 GOD   src/semantic/reranker.ts = 509L, 11 classes, 35m, max CC=27
  🔴 GOD   src/services/branch-snapshot.ts = 583L, 9 classes, 81m, max CC=110
  🔴 GOD   src/llm/openrouter.ts = 561L, 8 classes, 63m, max CC=12
  🔴 GOD   src/synthesis/code-change-plan.ts = 1310L, 10 classes, 127m, max CC=47
  🔴 GOD   src/core/schema.ts = 922L, 4 classes, 124m, max CC=23
  🔴 GOD   src/communication/llm.ts = 514L, 8 classes, 53m, max CC=12
  🔴 GOD   src/pipeline/run.ts = 795L, 8 classes, 71m, max CC=19
  🔴 GOD   src/core/types.ts = 676L, 41 classes, 0m, max CC=0.0
  🟡 CC    handleRequest CC=16 (limit:15)
  🟡 CC    toIntentRecord CC=18 (limit:15)
  🟡 CC    convertDocument CC=18 (limit:15)
  🟡 CC    lines CC=17 (limit:15)
  🟡 CC    extractTypeScriptFile CC=43 (limit:15)
  🟡 CC    visit CC=25 (limit:15)
  🟡 CC    buildSymbolResolutionIndex CC=15 (limit:15)
  🟡 CC    buildBasenameIndex CC=17 (limit:15)
  🟡 CC    index CC=16 (limit:15)
  🟡 CC    base CC=16 (limit:15)
  🟡 CC    seen CC=16 (limit:15)

REFACTOR[10]:
  1. split src/extractors/communication.ts  (god module)
  2. split src/semantic/reranker.ts  (god module)
  3. split src/services/branch-snapshot.ts  (god module)
  4. split src/llm/openrouter.ts  (god module)
  5. split src/synthesis/code-change-plan.ts  (god module)
  6. split src/core/schema.ts  (god module)
  7. split src/communication/llm.ts  (god module)
  8. split src/pipeline/run.ts  (god module)
  9. split src/core/types.ts  (god module)
  10. split 11 high-CC methods  (CC>15)

PIPELINES[2227]:
  [1] Src [enqueueEvent]: enqueueEvent
      PURITY: 100% pure
  [2] Src [listEvents]: listEvents
      PURITY: 100% pure
  [3] Src [start]: start
      PURITY: 100% pure
  [4] Src [main]: main → arguments
      PURITY: 100% pure
  [5] Src [new]: new
      PURITY: 100% pure
  [6] Src [visit_item_mod]: visit_item_mod → qualified
      PURITY: 100% pure
  [7] Src [visit_item_use]: visit_item_use → add → excerpt
      PURITY: 100% pure
  [8] Src [visit_item_struct]: visit_item_struct → type_item → qualified
      PURITY: 100% pure
  [9] Src [visit_item_enum]: visit_item_enum → type_item → qualified
      PURITY: 100% pure
  [10] Src [visit_item_trait]: visit_item_trait → type_item → qualified
      PURITY: 100% pure
  [11] Src [visit_item_type]: visit_item_type → type_item → qualified
      PURITY: 100% pure
  [12] Src [visit_item_const]: visit_item_const → qualified
      PURITY: 100% pure
  [13] Src [visit_item_static]: visit_item_static → qualified
      PURITY: 100% pure
  [14] Src [visit_item_fn]: visit_item_fn → qualified
      PURITY: 100% pure
  [15] Src [visit_item_impl]: visit_item_impl
      PURITY: 100% pure
  [16] Src [visit_impl_item_fn]: visit_impl_item_fn → add → excerpt
      PURITY: 100% pure
  [17] Src [visit_expr_call]: visit_expr_call → add → excerpt
      PURITY: 100% pure
  [18] Src [visit_expr_method_call]: visit_expr_method_call → add → excerpt
      PURITY: 100% pure
  [19] Src [executeContract]: executeContract → validateContract
      PURITY: 100% pure
  [20] Src [ALLOWED_ACTIONS]: ALLOWED_ACTIONS → invalid
      PURITY: 100% pure
  [21] Src [validateEventPayload]: validateEventPayload → invalid
      PURITY: 100% pure
  [22] Src [record]: record → invalid
      PURITY: 100% pure
  [23] Src [agent]: agent → invalid
      PURITY: 100% pure
  [24] Src [action]: action → invalid
      PURITY: 100% pure
  [25] Src [object]: object → invalid
      PURITY: 100% pure
  [26] Src [message]: message
      PURITY: 100% pure
  [27] Src [mountPanel]: mountPanel → createState
      PURITY: 100% pure
  [28] Src [extractNlIntent]: extractNlIntent → assertNlExtractionOptions
      PURITY: 100% pure
  [29] Src [absolute]: absolute → detectMissingFields
      PURITY: 100% pure
  [30] Src [body]: body → detectMissingFields
      PURITY: 100% pure
  [31] Src [sourcePath]: sourcePath → detectMissingFields
      PURITY: 100% pure
  [32] Src [classified]: classified → inferActor
      PURITY: 100% pure
  [33] Src [action]: action → inferActor
      PURITY: 100% pure
  [34] Src [object]: object → inferActor
      PURITY: 100% pure
  [35] Src [missing]: missing → inferActor
      PURITY: 100% pure
  [36] Src [confidence]: confidence → inferActor
      PURITY: 100% pure
  [37] Src [extractMarkdownIntent]: extractMarkdownIntent
      PURITY: 100% pure
  [38] Src [pathResolver]: pathResolver
      PURITY: 100% pure
  [39] Src [store]: store → handleRequest → sendJson
      PURITY: 100% pure
  [40] Src [server]: server → handleRequest → sendJson
      PURITY: 100% pure
  [41] Src [url]: url
      PURITY: 100% pure
  [42] Src [body]: body
      PURITY: 100% pure
  [43] Src [validation]: validation → sendJson
      PURITY: 100% pure
  [44] Src [event]: event → sendJson
      PURITY: 100% pure
  [45] Src [offset]: offset → sendJson
      PURITY: 100% pure
  [46] Src [limit]: limit → sendJson
      PURITY: 100% pure
  [47] Src [startBackend]: startBackend → createBackend → handleRequest → sendJson
      PURITY: 100% pure
  [48] Src [port]: port
      PURITY: 100% pure
  [49] Src [host]: host
      PURITY: 100% pure
  [50] Src [fetchEvents]: fetchEvents
      PURITY: 100% pure

LAYERS:
  php/                            CC̄=8.7    ←in:0  →out:0
  │ !! ast_extract.php            233L  0C    7m  CC=38     ←0
  │
  golang/                         CC̄=5.3    ←in:0  →out:0
  │ ast_extract.go             368L  3C   15m  CC=14     ←0
  │
  python/                         CC̄=4.2    ←in:0  →out:5
  │ !! ast_extract                221L  1C   18m  CC=16     ←0
  │ requirements.txt             1L  0C    0m  CC=0.0    ←0
  │
  src/                            CC̄=3.9    ←in:0  →out:0
  │ !! code-change-plan.ts       1310L  10C  127m  CC=47     ←3
  │ !! schema.ts                  922L  4C  124m  CC=23     ←0
  │ !! cli.ts                     874L  1C   88m  CC=96     ←0
  │ !! run.ts                     795L  8C   71m  CC=19     ←0
  │ !! actions.ts                 700L  0C   74m  CC=83     ←0
  │ !! communication.ts           685L  6C   90m  CC=15     ←0
  │ !! types.ts                   676L  41C    0m  CC=0.0    ←0
  │ !! reality.ts                 619L  3C   74m  CC=26     ←0
  │ !! branch-snapshot.ts         583L  9C   81m  CC=110    ←1
  │ !! openrouter.ts              561L  8C   63m  CC=12     ←0
  │ !! a2a-task-store.ts          560L  3C   88m  CC=11     ←0
  │ !! analyzer.ts                542L  3C   72m  CC=48     ←0
  │ !! llm.ts                     514L  8C   53m  CC=12     ←0
  │ !! reranker.ts                509L  11C   35m  CC=27     ←0
  │ branch-portfolio.ts        499L  9C   85m  CC=11     ←0
  │ !! workspace-preflight.ts     498L  12C   82m  CC=116    ←0
  │ !! text.ts                    491L  0C   51m  CC=34     ←0
  │ !! linker.ts                  489L  4C   72m  CC=18     ←3
  │ !! workspace.ts               485L  5C   80m  CC=20     ←0
  │ truth-map.ts               467L  5C   58m  CC=13     ←0
  │ !! markdown-llm.ts            458L  6C   38m  CC=19     ←0
  │ analysis-policy.ts         437L  7C   53m  CC=8      ←0
  │ !! event-log.ts               415L  4C   47m  CC=15     ←0
  │ !! gold-types.ts              378L  15C   11m  CC=32     ←0
  │ todo-patch.ts              372L  5C   52m  CC=12     ←0
  │ !! gold-cases.ts              366L  4C   42m  CC=18     ←0
  │ !! docs-deterministic.ts      364L  2C   40m  CC=18     ←0
  │ !! diagnostics.ts             361L  0C   40m  CC=40     ←0
  │ branch-portfolio-assembler.ts   357L  4C   52m  CC=11     ←0
  │ summarizer.ts              333L  5C   27m  CC=10     ←0
  │ a2a.ts                     332L  0C   47m  CC=9      ←0
  │ gold.ts                    329L  3C   31m  CC=14     ←0
  │ mcp-tools.ts               323L  1C   10m  CC=10     ←0
  │ contract-check.ts          317L  6C   39m  CC=14     ←0
  │ !! nl-llm.ts                  316L  5C   45m  CC=18     ←0
  │ runtime-cycle.ts           306L  1C   35m  CC=9      ←0
  │ intake-service.ts          291L  2C   48m  CC=13     ←0
  │ !! validation.ts              281L  0C   47m  CC=84     ←0
  │ !! intake-contract.ts         273L  7C   30m  CC=18     ←0
  │ docs-llm.ts                269L  1C   28m  CC=12     ←0
  │ tasks-llm.ts               266L  4C   22m  CC=11     ←0
  │ mcp.ts                     261L  2C   38m  CC=9      ←0
  │ subllm.ts                  259L  2C   45m  CC=10     ←0
  │ text-render.ts             251L  2C   33m  CC=13     ←0
  │ !! watcher.ts                 243L  4C   37m  CC=19     ←0
  │ !! text.ts                    239L  1C   48m  CC=19     ←2
  │ diff.ts                    235L  1C   38m  CC=11     ←0
  │ env.ts                     232L  1C   21m  CC=13     ←0
  │ configuration.ts           231L  2C   41m  CC=10     ←0
  │ !! a2a-history.ts             226L  3C   37m  CC=18     ←0
  │ structured-schema.ts       218L  5C   25m  CC=10     ←0
  │ model-comparison.ts        218L  4C   21m  CC=12     ←2
  │ !! reranker-llm.ts            210L  2C   24m  CC=25     ←0
  │ !! code-change-path.ts        204L  0C   14m  CC=38     ←0
  │ ignore.ts                  200L  3C   23m  CC=10     ←0
  │ !! a2a-message.ts             197L  0C   35m  CC=63     ←0
  │ ast.ts                     193L  2C   17m  CC=12     ←0
  │ docs-record.ts             193L  0C   34m  CC=14     ←0
  │ event-log-persistence.ts   190L  0C   25m  CC=9      ←0
  │ a2a-card.ts                181L  0C    7m  CC=3      ←0
  │ git.ts                     180L  3C   26m  CC=13     ←0
  │ !! io.ts                      177L  1C   32m  CC=15     ←0
  │ !! record.ts                  172L  2C    9m  CC=18     ←0
  │ task-synthesis-materialize.ts   172L  0C   35m  CC=5      ←0
  │ typescript.ts              172L  6C   16m  CC=2      ←0
  │ id.ts                      167L  0C   16m  CC=5      ←0
  │ !! typescript.ts              166L  0C   19m  CC=43     ←0
  │ a2a-types.ts               164L  9C   14m  CC=10     ←0
  │ !! git.ts                     161L  3C   21m  CC=22     ←0
  │ intake-store.ts            161L  3C   19m  CC=11     ←0
  │ intake_cli                 156L  0C    6m  CC=10     ←0
  │ types.ts                   155L  8C    0m  CC=0.0    ←0
  │ docs-chunks.ts             147L  0C   29m  CC=8      ←0
  │ !! identity.ts                146L  3C   22m  CC=30     ←0
  │ content-cache.ts           139L  4C   12m  CC=5      ←0
  │ !! openrouter-timeout.ts      135L  2C   19m  CC=16     ←0
  │ gold-extraction.ts         127L  0C   13m  CC=5      ←0
  │ !! intake-protobuf.ts         125L  0C   23m  CC=18     ←0
  │ !! markdown-paths.ts          122L  1C   17m  CC=17     ←0
  │ subactor.ts                122L  1C    9m  CC=13     ←0
  │ !! symbol-resolution.ts       120L  3C   16m  CC=15     ←0
  │ validation.ts              113L  2C   28m  CC=11     ←0
  │ nl.ts                      107L  1C   12m  CC=10     ←0
  │ svg.ts                     104L  2C    7m  CC=2      ←0
  │ changelog.ts                99L  0C   16m  CC=11     ←0
  │ records.ts                  97L  0C   10m  CC=6      ←0
  │ !! classifier.ts               96L  4C   27m  CC=17     ←0
  │ todo.ts                     93L  0C   18m  CC=5      ←0
  │ changelog-signal.ts         89L  0C   12m  CC=8      ←0
  │ mcp-resources.ts            88L  0C   13m  CC=6      ←0
  │ contract.ts                 84L  0C    7m  CC=1      ←0
  │ governed-intake.proto       78L  0C    0m  CC=0.0    ←0
  │ task-synthesis-payload.ts    70L  0C    8m  CC=3      ←0
  │ docs-types.ts               68L  7C    0m  CC=0.0    ←0
  │ markdown-block.ts           67L  1C    3m  CC=10     ←0
  │ task-synthesis-contract.ts    66L  3C    6m  CC=1      ←0
  │ artifact.ts                 66L  2C   10m  CC=6      ←0
  │ payload.ts                  65L  0C    8m  CC=12     ←0
  │ audit.ts                    64L  0C    4m  CC=5      ←0
  │ capability-evidence.ts      62L  0C   14m  CC=10     ←0
  │ render.ts                   61L  0C   13m  CC=10     ←0
  │ target.ts                   57L  0C   12m  CC=9      ←0
  │ security.ts                 55L  0C   11m  CC=7      ←0
  │ index.ts                    53L  0C    0m  CC=0.0    ←0
  │ gold-metrics.ts             50L  1C   11m  CC=4      ←0
  │ external.ts                 48L  1C    5m  CC=9      ←0
  │ !! diff-ui.ts                  48L  0C    9m  CC=52     ←0
  │ gold-cli.ts                 44L  0C   10m  CC=12     ←0
  │ docs-schema.ts              43L  0C    5m  CC=1      ←0
  │ reranker-response.ts        42L  1C    5m  CC=1      ←0
  │ python.ts                   39L  0C    6m  CC=2      ←0
  │ text-types.ts               39L  4C    0m  CC=0.0    ←0
  │ intake-actions.ts           38L  0C   10m  CC=6      ←0
  │ participant-registry-v2.schema.json    36L  0C    0m  CC=0.0    ←0
  │ markdown.ts                 35L  1C    4m  CC=4      ←0
  │ php.ts                      34L  0C    6m  CC=2      ←0
  │ compile-cli.ts              34L  0C    7m  CC=10     ←0
  │ unsupported.ts              30L  0C    4m  CC=5      ←0
  │ failure.ts                  25L  1C    3m  CC=7      ←0
  │ grounding.ts                24L  0C    5m  CC=5      ←0
  │ rust.ts                     20L  0C    2m  CC=1      ←0
  │ go.ts                       20L  0C    2m  CC=1      ←0
  │ java.ts                     20L  0C    2m  CC=1      ←0
  │ types.ts                    20L  2C    0m  CC=0.0    ←0
  │ event-v1.schema.json        20L  0C    0m  CC=0.0    ←0
  │ envelope-v1.schema.json     20L  0C    0m  CC=0.0    ←0
  │ command-v1.schema.json      17L  0C    0m  CC=0.0    ←0
  │ query-v1.schema.json        11L  0C    0m  CC=0.0    ←0
  │ diagnostic-v1.schema.json    11L  0C    0m  CC=0.0    ←0
  │ mcp-errors.ts               10L  1C    2m  CC=3      ←0
  │ result-v1.schema.json        9L  0C    0m  CC=0.0    ←0
  │ version.ts                   2L  0C    0m  CC=0.0    ←0
  │ version.ts                   2L  0C    0m  CC=0.0    ←0
  │
  scripts/                        CC̄=3.3    ←in:0  →out:0
  │ !! runtime.sh                 858L  0C   24m  CC=0.0    ←0
  │ !! github-event-log.mjs       577L  0C   68m  CC=34     ←0
  │ audit-changelog-sample.mjs   226L  0C   39m  CC=11     ←0
  │ examples-check.sh          210L  0C    3m  CC=0.0    ←0
  │ live-contract-check.mjs    200L  0C   26m  CC=5      ←0
  │ rerank-embedding-shortlist.mjs   191L  0C   27m  CC=14     ←0
  │ !! rank-intent-graph-embeddings   174L  0C    3m  CC=27     ←0
  │ live-model-comparison.mjs   125L  0C   15m  CC=13     ←0
  │ e2e.sh                     109L  0C    3m  CC=0.0    ←0
  │ !! verify-env-contract.mjs    103L  0C   15m  CC=28     ←0
  │ evaluate-embedding-pairs   101L  0C    2m  CC=9      ←0
  │ verify-generated-analysis.mjs    88L  0C   14m  CC=8      ←0
  │ verify-module-boundaries.mjs    87L  0C   16m  CC=7      ←0
  │ workspace-preflight.mjs     84L  0C    8m  CC=11     ←0
  │ !! verify-no-llm-imports.mjs    78L  0C    6m  CC=15     ←0
  │ sync-generated-readme-metadata.mjs    66L  0C   14m  CC=4      ←0
  │ smoke.sh                    57L  0C    0m  CC=0.0    ←0
  │ assert-demollm-run.mjs      45L  0C    9m  CC=2      ←0
  │ verify-workflow-yaml.mjs    43L  0C    9m  CC=11     ←0
  │ normalize-generated-analysis-roots.mjs    38L  0C    7m  CC=4      ←0
  │ docker-smoke.sh             36L  0C    1m  CC=0.0    ←0
  │ verify-structured-responses.mjs    35L  0C    7m  CC=8      ←0
  │ generate-response-schemas.mjs    27L  0C    4m  CC=2      ←0
  │ README.md                   27L  0C    0m  CC=0.0    ←0
  │ vallm-compatible            25L  0C    1m  CC=2      ←0
  │ package                     25L  0C    0m  CC=0.0    ←0
  │ a2a-request.sh              23L  0C    0m  CC=0.0    ←0
  │ mcp-request.sh              11L  0C    0m  CC=0.0    ←0
  │
  java/                           CC̄=3.0    ←in:2  →out:0
  │ JavaAstExtract.java        260L  1C   12m  CC=10     ←1
  │
  sdk/                            CC̄=2.7    ←in:0  →out:0
  │ client                     469L  7C   45m  CC=7      ←0
  │ index.ts                   420L  14C   45m  CC=8      ←0
  │ Client.php                 401L  1C   27m  CC=11     ←0
  │ runtime                    225L  3C   10m  CC=9      ←0
  │ !! client.rs                  221L  1C   19m  CC=18     ←0
  │ types.go                   215L  19C    2m  CC=4      ←0
  │ client.go                  197L  3C   10m  CC=9      ←0
  │ todo2code_sdk              171L  1C   11m  CC=2      ←0
  │ !! main.go                    163L  0C    5m  CC=26     ←0
  │ types.rs                   140L  11C    1m  CC=2      ←0
  │ actions.go                 136L  0C   18m  CC=3      ←0
  │ basic.php                  112L  0C    0m  CC=0.0    ←0
  │ !! basic.rs                   108L  0C    3m  CC=20     ←0
  │ README.md                  107L  0C    0m  CC=0.0    ←0
  │ actions.rs                 100L  1C   20m  CC=4      ←0
  │ basic                       95L  0C    1m  CC=11     ←0
  │ !! basic.ts                    84L  0C   19m  CC=17     ←0
  │ README.md                   80L  0C    0m  CC=0.0    ←0
  │ lib.rs                      49L  0C    0m  CC=0.0    ←0
  │ error.rs                    37L  2C    2m  CC=2      ←0
  │ local_runtime               36L  0C    1m  CC=1      ←0
  │ __init__                    33L  0C    0m  CC=0.0    ←0
  │ package.json                32L  0C    0m  CC=0.0    ←0
  │ todo2code.go                30L  0C    0m  CC=0.0    ←0
  │ Error.php                   25L  1C    2m  CC=1      ←0
  │ README.md                   24L  0C    0m  CC=0.0    ←0
  │ README.md                   23L  0C    0m  CC=0.0    ←0
  │ README.md                   21L  0C    0m  CC=0.0    ←0
  │ README.md                   20L  0C    0m  CC=0.0    ←0
  │ tsconfig.json               20L  0C    0m  CC=0.0    ←0
  │ composer.json               18L  0C    0m  CC=0.0    ←0
  │ Cargo.toml                  17L  0C    0m  CC=0.0    ←0
  │ __init__                    13L  0C    0m  CC=0.0    ←0
  │ __init__                     1L  0C    0m  CC=0.0    ←0
  │
  examples/                       CC̄=2.4    ←in:0  →out:0
  │ !! server.ts                   99L  1C   18m  CC=16     ←0
  │ render.ts                   64L  1C   12m  CC=4      ←0
  │ api.ts                      50L  3C    6m  CC=6      ←1
  │ store.ts                    48L  3C    4m  CC=1      ←0
  │ README.md                   46L  0C    0m  CC=0.0    ←0
  │ app.ts                      43L  1C    7m  CC=4      ←0
  │ participants.json           37L  0C    0m  CC=0.0    ←0
  │ README.md                   35L  0C    0m  CC=0.0    ←0
  │ validation.ts               31L  1C    7m  CC=10     ←0
  │ python                      23L  0C    0m  CC=0.0    ←0
  │ task.md                     18L  0C    0m  CC=0.0    ←0
  │ task.md                     17L  0C    0m  CC=0.0    ←0
  │ typescript.mjs              16L  0C    1m  CC=1      ←0
  │ tsconfig.json               15L  0C    0m  CC=0.0    ←0
  │ tsconfig.json               14L  0C    0m  CC=0.0    ←0
  │ runtime.ts                  13L  1C    2m  CC=2      ←0
  │ CHANGELOG.md                11L  0C    0m  CC=0.0    ←0
  │ CHANGELOG.md                11L  0C    0m  CC=0.0    ←0
  │ CHANGELOG.md                11L  0C    0m  CC=0.0    ←0
  │ agent.codex.plan.001.md     11L  0C    0m  CC=0.0    ←0
  │ human.product-owner.request.001.md    10L  0C    0m  CC=0.0    ←0
  │ human.security.decision.001.md    10L  0C    0m  CC=0.0    ←0
  │ agent.codex.report.002.md    10L  0C    0m  CC=0.0    ←0
  │ helper                       9L  0C    2m  CC=1      ←0
  │ task.md                      9L  0C    0m  CC=0.0    ←0
  │ ARCHITECTURE.md              9L  0C    0m  CC=0.0    ←0
  │ TODO.md                      8L  0C    0m  CC=0.0    ←0
  │ agent.rogue.plan.001.md      8L  0C    0m  CC=0.0    ←0
  │ TODO.md                      7L  0C    0m  CC=0.0    ←0
  │ TODO.md                      7L  0C    0m  CC=0.0    ←0
  │
  rust-ast/                       CC̄=1.9    ←in:0  →out:0
  │ main.rs                    322L  3C   23m  CC=9      ←0
  │ Cargo.toml                  12L  0C    0m  CC=0.0    ←0
  │
  ./                              CC̄=0.0    ←in:0  →out:0
  │ !! README.md                  927L  0C    0m  CC=0.0    ←0
  │ !! CHANGELOG.md               733L  0C    0m  CC=0.0    ←0
  │ !! TODO.md                    551L  0C    0m  CC=0.0    ←0
  │ !! goal.yaml                  531L  0C    0m  CC=0.0    ←0
  │ dsl-manifest.json          152L  0C    0m  CC=0.0    ←0
  │ Makefile                   147L  0C    0m  CC=0.0    ←0
  │ project2.sh                 55L  0C    0m  CC=0.0    ←0
  │ package.json                52L  0C    0m  CC=0.0    ←0
  │ AGENTS.md                   48L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  45L  0C    0m  CC=0.0    ←0
  │ project.sh                  38L  0C    0m  CC=0.0    ←0
  │ CONTRIBUTION.md             37L  0C    0m  CC=0.0    ←0
  │ compose.e2e.yml             27L  0C    0m  CC=0.0    ←0
  │ tsconfig.json               23L  0C    0m  CC=0.0    ←0
  │ docker-compose.yml          18L  0C    0m  CC=0.0    ←0
  │ pyproject.toml              18L  0C    0m  CC=0.0    ←0
  │ TASK.md                     10L  0C    0m  CC=0.0    ←0
  │ nlp2uri.yaml                 8L  0C    0m  CC=0.0    ←0
  │
  schemas/                        CC̄=0.0    ←in:0  →out:0
  │ !! gold-dataset.schema.json   585L  0C    0m  CC=0.0    ←0
  │ document-extraction-response.schema.json   186L  0C    0m  CC=0.0    ←0
  │ intent-record.schema.json   132L  0C    0m  CC=0.0    ←0
  │ semantic-rerank.schema.json   113L  0C    0m  CC=0.0    ←0
  │ code-change-plan.schema.json    98L  0C    0m  CC=0.0    ←0
  │ operation-plan.schema.json    94L  0C    0m  CC=0.0    ←0
  │ intent-graph-diff.schema.json    80L  0C    0m  CC=0.0    ←0
  │ code-change-source-patch.schema.json    63L  0C    0m  CC=0.0    ←0
  │ todo-proposal.schema.json    61L  0C    0m  CC=0.0    ←0
  │ todo-patch.schema.json      59L  0C    0m  CC=0.0    ←0
  │ semantic-candidate-set.schema.json    54L  0C    0m  CC=0.0    ←0
  │ code-change-acceptance.schema.json    53L  0C    0m  CC=0.0    ←0
  │ conclusion.schema.json      51L  0C    0m  CC=0.0    ←0
  │ intent-graph.schema.json    40L  0C    0m  CC=0.0    ←0
  │ participant-synthesis.schema.json    39L  0C    0m  CC=0.0    ←0
  │ variable-contract.schema.json    38L  0C    0m  CC=0.0    ←0
  │ code-change-source-apply-receipt.schema.json    31L  0C    0m  CC=0.0    ←0
  │ code-change-review.schema.json    27L  0C    0m  CC=0.0    ←0
  │ participant-registry.schema.json    27L  0C    0m  CC=0.0    ←0
  │ code-change-close-result.schema.json    26L  0C    0m  CC=0.0    ←0
  │ code-change-plan-set.schema.json    22L  0C    0m  CC=0.0    ←0
  │ code-change-source-patch-set.schema.json    18L  0C    0m  CC=0.0    ←0
  │
  docs/                           CC̄=0.0    ←in:0  →out:0
  │ !! README.md                 3919L  0C    0m  CC=0.0    ←0
  │ !! SYSTEM_MONITOROWANIA_INTENCJI_I_PRACY_AGENTOW.md   872L  0C    0m  CC=0.0    ←0
  │ !! original-monitoring-design.md   872L  0C    0m  CC=0.0    ←0
  │ !! TEST_REPORT.md             587L  0C    0m  CC=0.0    ←0
  │ PIPELINE_DSL_NL.md         464L  0C    0m  CC=0.0    ←0
  │ DSL.md                     457L  0C    0m  CC=0.0    ←0
  │ READINESS.md               442L  0C    0m  CC=0.0    ←0
  │ ALL_DIAGRAMS.md            410L  0C    0m  CC=0.0    ←0
  │ CLI_GUIDE.md               328L  0C    0m  CC=0.0    ←0
  │ EVENT_LOG_DSL.md           300L  0C    0m  CC=0.0    ←0
  │ GROK-PLAN.md               269L  0C    0m  CC=0.0    ←0
  │ TEAM_COMMUNICATION.md      268L  0C    0m  CC=0.0    ←0
  │ OPTIMIZATION.md            249L  0C    0m  CC=0.0    ←0
  │ ARCHITECTURE.md            200L  0C    0m  CC=0.0    ←0
  │ VALIDATION.md              198L  0C    0m  CC=0.0    ←0
  │ PROJECT_STATUS.md          177L  0C    0m  CC=0.0    ←0
  │ DEMOLLM.md                 175L  0C    0m  CC=0.0    ←0
  │ CODE_CHANGE_PLANS.md       173L  0C    0m  CC=0.0    ←0
  │ PROTOCOLS.md               124L  0C    0m  CC=0.0    ←0
  │ E2E.md                      52L  0C    0m  CC=0.0    ←0
  │ SECURITY.md                 50L  0C    0m  CC=0.0    ←0
  │ REQUIREMENTS.md             39L  0C    0m  CC=0.0    ←0
  │ SUBACTOR_OPERATION_DSL.md    33L  0C    0m  CC=0.0    ←0
  │ README.md                   22L  0C    0m  CC=0.0    ←0
  │
  prompts/                        CC̄=0.0    ←in:0  →out:0
  │ tasks-from-dsl.system.md    52L  0C    0m  CC=0.0    ←0
  │ summarize.system.md         51L  0C    0m  CC=0.0    ←0
  │ docs-to-intent.system.md    23L  0C    0m  CC=0.0    ←0
  │ nl-to-intent.system.md      15L  0C    0m  CC=0.0    ←0
  │ communication-to-intent.system.md     7L  0C    0m  CC=0.0    ←0
  │ markdown-to-intent.system.md     5L  0C    0m  CC=0.0    ←0
  │
  adapters/                       CC̄=0.0    ←in:0  →out:0
  │ package.json                14L  0C    0m  CC=0.0    ←0
  │
  evaluation/                     CC̄=0.0    ←in:0  →out:0
  │ !! dataset.json              2410L  0C    0m  CC=0.0    ←0
  │ !! dataset.json               761L  0C    0m  CC=0.0    ←0
  │ README.md                   87L  0C    0m  CC=0.0    ←0
  │

COUPLING:
                      scripts.research         sdk.python           src.live           src.diff             python      src.synthesis          src.graph               java     src.interfaces       src.services  examples.frontend
   scripts.research                 ──                                     7                  2                                     1                  1                                                                              !! fan-out
         sdk.python                                    ──                                                                           4                  1                  2                                                        1  !! fan-out
           src.live                 ←7                                    ──                                                                                                                                                          hub
           src.diff                 ←2                                                       ──                 ←4                                                                                                                    hub
             python                                                                           4                 ──                                     1                                                                            
      src.synthesis                 ←1                 ←4                                                                          ──                                                                                                 hub
          src.graph                 ←1                 ←1                                                       ←1                                    ──                                                                            
               java                                    ←2                                                                                                                ──                                                         
     src.interfaces                                                                                                                                                                         ──                  2                   
       src.services                                                                                                                                                                         ←2                 ──                   
  examples.frontend                                    ←1                                                                                                                                                                         ──
  CYCLES: none
  HUB: src.live/ (fan-in=7)
  HUB: src.synthesis/ (fan-in=5)
  HUB: src.diff/ (fan-in=6)
  SMELL: sdk.python/ fan-out=8 → split needed
  SMELL: scripts.research/ fan-out=11 → split needed

EXTERNAL:
  validation: run `vallm batch .` → validation.toon
  duplication: run `redup scan .` → duplication.toon
```

### Duplication (`project/duplication.toon.yaml`)

```toon markpact:analysis path=project/duplication.toon.yaml
# redup/duplication | 20 groups | 196f 39252L | 2026-08-16

SUMMARY:
  files_scanned: 196
  total_lines:   39252
  dup_groups:    20
  actionable:    20
  review:        0
  generated:     0
  actionable_L:  133
  review_L:      0
  generated_L:   0
  dup_fragments: 50
  saved_lines:   133
  scan_ms:       1736

HOTSPOTS[7] (files with most duplication):
  src/extractors/markdown-llm.ts  dup=27L  groups=5  frags=5  (0.1%)
  src/communication/llm.ts  dup=27L  groups=5  frags=5  (0.1%)
  src/extractors/nl-llm.ts  dup=22L  groups=6  frags=6  (0.1%)
  src/synthesis/tasks-llm.ts  dup=13L  groups=3  frags=3  (0.0%)
  src/extractors/docs-llm.ts  dup=12L  groups=3  frags=3  (0.0%)
  src/live/contract-check.ts  dup=12L  groups=2  frags=2  (0.0%)
  src/live/model-comparison.ts  dup=12L  groups=2  frags=2  (0.0%)

DUPLICATES[20] (ranked by impact):
  [ff0b7d1fb897f5eb]   EXAC  readPrompt  L=5 N=5 saved=20 sim=1.00
      src/extractors/docs-llm.ts:261-265  (readPrompt)
      src/extractors/markdown-llm.ts:431-435  (readPrompt)
      src/extractors/nl-llm.ts:283-287  (readPrompt)
      src/summary/summarizer.ts:329-333  (readPrompt)
      src/synthesis/tasks-llm.ts:262-266  (readPrompt)
  [09873fe5d7f53db8]   STRU  constructor  L=4 N=5 saved=16 sim=1.00
      src/communication/llm.ts:80-83  (constructor)
      src/extractors/docs-llm.ts:39-42  (constructor)
      src/extractors/markdown-llm.ts:49-52  (constructor)
      src/extractors/nl-llm.ts:47-50  (constructor)
      src/synthesis/tasks-llm.ts:49-52  (constructor)
  [bd6578d73c14c374]   STRU  constructor  L=4 N=5 saved=16 sim=1.00
      src/communication/llm.ts:162-165  (constructor)
      src/extractors/markdown-llm.ts:146-149  (constructor)
      src/extractors/nl-llm.ts:109-112  (constructor)
      src/summary/summarizer.ts:154-157  (constructor)
      src/synthesis/tasks-llm.ts:56-59  (constructor)
  [8f9cb44a5788fdd0]   EXAC  collect  L=9 N=2 saved=9 sim=1.00
      scripts/verify-env-contract.mjs:95-103  (collect)
      scripts/verify-module-boundaries.mjs:59-67  (collect)
  [6363b0c657dbde27]   EXAC  sumUsage  L=9 N=2 saved=9 sim=1.00
      src/live/contract-check.ts:148-156  (sumUsage)
      src/live/model-comparison.ts:206-214  (sumUsage)
  [040774ed1317816e]   EXAC  markDeterministic  L=8 N=2 saved=8 sim=1.00
      src/communication/llm.ts:417-424  (markDeterministic)
      src/extractors/markdown-llm.ts:402-409  (markDeterministic)
  [a81abf06a2409abf]   EXAC  arrow_function  L=6 N=2 saved=6 sim=1.00
      src/communication/llm.ts:418-423  (arrow_function)
      src/extractors/markdown-llm.ts:403-408  (arrow_function)
  [8d69eac96521c6bc]   EXAC  requireStandaloneRoot  L=6 N=2 saved=6 sim=1.00
      src/extractors/ast.ts:188-193  (requireStandaloneRoot)
      src/extractors/configuration.ts:226-231  (requireStandaloneRoot)
  [2e20d0fc42b5b689]   EXAC  errorMessage  L=3 N=3 saved=6 sim=1.00
      src/extractors/docs-llm.ts:267-269  (errorMessage)
      src/interfaces/a2a-task-store.ts:558-560  (errorMessage)
      src/interfaces/a2a.ts:322-324  (errorMessage)
  [13e54260c09235cb]   EXAC  roleOf  L=5 N=2 saved=5 sim=1.00
      src/communication/analyzer.ts:464-468  (roleOf)
      src/communication/llm.ts:476-480  (roleOf)
  [5a74faa98e248ba6]   EXAC  objectValue  L=4 N=2 saved=4 sim=1.00
      src/core/schema.ts:771-774  (objectValue)
      src/operations/validation.ts:18-21  (objectValue)
  [ec475200ea3a5d85]   STRU  constructor  L=4 N=2 saved=4 sim=1.00
      src/evaluation/analysis-policy.ts:204-207  (constructor)
      src/pipeline/event-log.ts:256-259  (constructor)
  [6108e7bc94eb85d0]   EXAC  readJson  L=3 N=2 saved=3 sim=1.00
      scripts/research/audit-changelog-sample.mjs:205-207  (readJson)
      scripts/research/rerank-embedding-shortlist.mjs:160-162  (readJson)
  [cf429410d135f725]   EXAC  clampLine  L=3 N=2 saved=3 sim=1.00
      src/extractors/docs-record.ts:179-181  (clampLine)
      src/extractors/nl-llm.ts:271-273  (clampLine)
  [85958beabc80c768]   EXAC  allowedAction  L=3 N=2 saved=3 sim=1.00
      src/extractors/docs-record.ts:183-185  (allowedAction)
      src/extractors/nl-llm.ts:275-277  (allowedAction)
  [9b7097c5386e9cfa]   EXAC  allowedModality  L=3 N=2 saved=3 sim=1.00
      src/extractors/docs-record.ts:187-189  (allowedModality)
      src/extractors/nl-llm.ts:279-281  (allowedModality)
  [b31b50027fdfb178]   EXAC  round  L=3 N=2 saved=3 sim=1.00
      src/live/contract-check.ts:315-317  (round)
      src/live/model-comparison.ts:216-218  (round)
  [5c374add24a65b35]   EXAC  isRecord  L=3 N=2 saved=3 sim=1.00
      src/llm/openrouter.ts:503-505  (isRecord)
      src/llm/subllm.ts:177-179  (isRecord)
  [dabffb80a2fd2146]   EXAC  nonBlank  L=3 N=2 saved=3 sim=1.00
      src/operations/validation.ts:31-33  (nonBlank)
      src/synthesis/todo-patch.ts:346-348  (nonBlank)
  [21ba1336248390a4]   EXAC  renderIds  L=3 N=2 saved=3 sim=1.00
      src/synthesis/code-change-plan.ts:680-682  (renderIds)
      src/synthesis/todo-patch.ts:317-319  (renderIds)

REFACTOR[20] (ranked by priority):
  [1] ○ extract_function   → src/utils/readPrompt.py
      WHY: 5 occurrences of 5-line block across 5 files — saves 20 lines
      FILES: src/extractors/docs-llm.ts, src/extractors/markdown-llm.ts, src/extractors/nl-llm.ts, src/summary/summarizer.ts, src/synthesis/tasks-llm.ts
  [2] ○ extract_function   → src/utils/constructor.py
      WHY: 5 occurrences of 4-line block across 5 files — saves 16 lines
      FILES: src/communication/llm.ts, src/extractors/docs-llm.ts, src/extractors/markdown-llm.ts, src/extractors/nl-llm.ts, src/synthesis/tasks-llm.ts
  [3] ○ extract_function   → src/utils/constructor.py
      WHY: 5 occurrences of 4-line block across 5 files — saves 16 lines
      FILES: src/communication/llm.ts, src/extractors/markdown-llm.ts, src/extractors/nl-llm.ts, src/summary/summarizer.ts, src/synthesis/tasks-llm.ts
  [4] ○ extract_function   → scripts/utils/collect.py
      WHY: 2 occurrences of 9-line block across 2 files — saves 9 lines
      FILES: scripts/verify-env-contract.mjs, scripts/verify-module-boundaries.mjs
  [5] ○ extract_function   → src/live/utils/sumUsage.py
      WHY: 2 occurrences of 9-line block across 2 files — saves 9 lines
      FILES: src/live/contract-check.ts, src/live/model-comparison.ts
  [6] ○ extract_function   → src/utils/markDeterministic.py
      WHY: 2 occurrences of 8-line block across 2 files — saves 8 lines
      FILES: src/communication/llm.ts, src/extractors/markdown-llm.ts
  [7] ○ extract_function   → src/utils/arrow_function.py
      WHY: 2 occurrences of 6-line block across 2 files — saves 6 lines
      FILES: src/communication/llm.ts, src/extractors/markdown-llm.ts
  [8] ○ extract_function   → src/extractors/utils/requireStandaloneRoot.py
      WHY: 2 occurrences of 6-line block across 2 files — saves 6 lines
      FILES: src/extractors/ast.ts, src/extractors/configuration.ts
  [9] ○ extract_function   → src/utils/errorMessage.py
      WHY: 3 occurrences of 3-line block across 3 files — saves 6 lines
      FILES: src/extractors/docs-llm.ts, src/interfaces/a2a-task-store.ts, src/interfaces/a2a.ts
  [10] ○ extract_function   → src/communication/utils/roleOf.py
      WHY: 2 occurrences of 5-line block across 2 files — saves 5 lines
      FILES: src/communication/analyzer.ts, src/communication/llm.ts
  [11] ○ extract_function   → src/utils/objectValue.py
      WHY: 2 occurrences of 4-line block across 2 files — saves 4 lines
      FILES: src/core/schema.ts, src/operations/validation.ts
  [12] ○ extract_function   → src/utils/constructor.py
      WHY: 2 occurrences of 4-line block across 2 files — saves 4 lines
      FILES: src/evaluation/analysis-policy.ts, src/pipeline/event-log.ts
  [13] ○ extract_function   → scripts/research/utils/readJson.py
      WHY: 2 occurrences of 3-line block across 2 files — saves 3 lines
      FILES: scripts/research/audit-changelog-sample.mjs, scripts/research/rerank-embedding-shortlist.mjs
  [14] ○ extract_function   → src/extractors/utils/clampLine.py
      WHY: 2 occurrences of 3-line block across 2 files — saves 3 lines
      FILES: src/extractors/docs-record.ts, src/extractors/nl-llm.ts
  [15] ○ extract_function   → src/extractors/utils/allowedAction.py
      WHY: 2 occurrences of 3-line block across 2 files — saves 3 lines
      FILES: src/extractors/docs-record.ts, src/extractors/nl-llm.ts
  [16] ○ extract_function   → src/extractors/utils/allowedModality.py
      WHY: 2 occurrences of 3-line block across 2 files — saves 3 lines
      FILES: src/extractors/docs-record.ts, src/extractors/nl-llm.ts
  [17] ○ extract_function   → src/live/utils/round.py
      WHY: 2 occurrences of 3-line block across 2 files — saves 3 lines
      FILES: src/live/contract-check.ts, src/live/model-comparison.ts
  [18] ○ extract_function   → src/llm/utils/isRecord.py
      WHY: 2 occurrences of 3-line block across 2 files — saves 3 lines
      FILES: src/llm/openrouter.ts, src/llm/subllm.ts
  [19] ○ extract_function   → src/utils/nonBlank.py
      WHY: 2 occurrences of 3-line block across 2 files — saves 3 lines
      FILES: src/operations/validation.ts, src/synthesis/todo-patch.ts
  [20] ○ extract_function   → src/synthesis/utils/renderIds.py
      WHY: 2 occurrences of 3-line block across 2 files — saves 3 lines
      FILES: src/synthesis/code-change-plan.ts, src/synthesis/todo-patch.ts

QUICK_WINS[9] (low risk, high savings — do first):
  [1] extract_function   saved=20L  → src/utils/readPrompt.py
      FILES: docs-llm.ts, markdown-llm.ts, nl-llm.ts +2
  [2] extract_function   saved=16L  → src/utils/constructor.py
      FILES: llm.ts, docs-llm.ts, markdown-llm.ts +2
  [3] extract_function   saved=16L  → src/utils/constructor.py
      FILES: llm.ts, markdown-llm.ts, nl-llm.ts +2
  [4] extract_function   saved=9L  → scripts/utils/collect.py
      FILES: verify-env-contract.mjs, verify-module-boundaries.mjs
  [5] extract_function   saved=9L  → src/live/utils/sumUsage.py
      FILES: contract-check.ts, model-comparison.ts
  [6] extract_function   saved=8L  → src/utils/markDeterministic.py
      FILES: llm.ts, markdown-llm.ts
  [7] extract_function   saved=6L  → src/utils/arrow_function.py
      FILES: llm.ts, markdown-llm.ts
  [8] extract_function   saved=6L  → src/extractors/utils/requireStandaloneRoot.py
      FILES: ast.ts, configuration.ts
  [9] extract_function   saved=6L  → src/utils/errorMessage.py
      FILES: docs-llm.ts, a2a-task-store.ts, a2a.ts

EFFORT_ESTIMATE (total ≈ 4.4h):
  medium readPrompt                          saved=20L  ~40min
  medium constructor                         saved=16L  ~32min
  medium constructor                         saved=16L  ~32min
  easy   collect                             saved=9L  ~18min
  easy   sumUsage                            saved=9L  ~18min
  easy   markDeterministic                   saved=8L  ~16min
  easy   arrow_function                      saved=6L  ~12min
  easy   requireStandaloneRoot               saved=6L  ~12min
  easy   errorMessage                        saved=6L  ~12min
  easy   roleOf                              saved=5L  ~10min
  ... +10 more (~64min)

METRICS-TARGET:
  dup_groups:  20 → 0
  saved_lines: 133 lines recoverable
```

### Evolution / Churn (`project/evolution.toon.yaml`)

```toon markpact:analysis path=project/evolution.toon.yaml
# code2llm/evolution | 3812 func | 135f | 2026-08-16
# generated in 0.01s

NEXT[10] (ranked by impact):
  [1] !! SPLIT           src/synthesis/code-change-plan.ts
      WHY: 1310L, 10 classes, max CC=47
      EFFORT: ~4h  IMPACT: 61570

  [2] !! SPLIT-FUNC      WorkspacePreflightError.validateBaselineOption  CC=116  fan=70
      WHY: CC=116 exceeds 15
      EFFORT: ~1h  IMPACT: 8120

  [3] !! SPLIT-FUNC      validateRef  CC=110  fan=61
      WHY: CC=110 exceeds 15
      EFFORT: ~1h  IMPACT: 6710

  [4] !! SPLIT-FUNC      executeAction  CC=83  fan=65
      WHY: CC=83 exceeds 15
      EFFORT: ~1h  IMPACT: 5395

  [5] !! SPLIT-FUNC      root  CC=83  fan=64
      WHY: CC=83 exceeds 15
      EFFORT: ~1h  IMPACT: 5312

  [6] !! SPLIT-FUNC      main  CC=96  fan=45
      WHY: CC=96 exceeds 15
      EFFORT: ~1h  IMPACT: 4320

  [7] !! SPLIT-FUNC      assertOperationPlan  CC=84  fan=28
      WHY: CC=84 exceeds 15
      EFFORT: ~1h  IMPACT: 2352

  [8] !! SPLIT-FUNC      diffUiHtml  CC=52  fan=42
      WHY: CC=52 exceeds 15
      EFFORT: ~1h  IMPACT: 2184

  [9] !! SPLIT-FUNC      parseCommand  CC=63  fan=33
      WHY: CC=63 exceeds 15
      EFFORT: ~1h  IMPACT: 2079

  [10] !! SPLIT-FUNC      extractTypeScriptFile  CC=43  fan=44
      WHY: CC=43 exceeds 15
      EFFORT: ~1h  IMPACT: 1892


RISKS[3]:
  ⚠ Splitting docs/README.md may break 0 import paths
  ⚠ Splitting evaluation/gold/v2/dataset.json may break 0 import paths
  ⚠ Splitting src/synthesis/code-change-plan.ts may break 127 import paths

METRICS-TARGET:
  CC̄:          3.8 → ≤2.7
  max-CC:      116 → ≤20
  god-modules: 25 → 0
  high-CC(≥15): 113 → ≤56
  hub-types:   0 → ≤0

PATTERNS (language parser shared logic):
  _extract_declarations() in base.py — unified extraction for:
    - TypeScript: interfaces, types, classes, functions, arrow funcs
    - PHP: namespaces, traits, classes, functions, includes
    - Ruby: modules, classes, methods, requires
    - C++: classes, structs, functions, #includes
    - C#: classes, interfaces, methods, usings
    - Java: classes, interfaces, methods, imports
    - Go: packages, functions, structs
    - Rust: modules, functions, traits, use statements

  Shared regex patterns per language:
    - import: language-specific import/require/using patterns
    - class: class/struct/trait declarations with inheritance
    - function: function/method signatures with visibility
    - brace_tracking: for C-family languages ({ })
    - end_keyword_tracking: for Ruby (module/class/def...end)

  Benefits:
    - Consistent extraction logic across all languages
    - Reduced code duplication (~70% reduction in parser LOC)
    - Easier maintenance: fix once, apply everywhere
    - Standardized FunctionInfo/ClassInfo models

HISTORY:
  prev CC̄=4.0 → now CC̄=3.8
```

### Validation (`project/validation.toon.yaml`)

```toon markpact:analysis path=project/validation.toon.yaml
# vallm batch | 474f | 227✓ 34⚠ 0✗ | 2026-08-01

SUMMARY:
  scanned: 474  passed: 227 (47.9%)  warnings: 34  errors: 0  unsupported: 0

WARNINGS[34]{path,score}:
  src/operations/validation.ts,0.80
    issues[4]{rule,severity,message,line}:
      complexity.lizard_cc,warning,assertVariableContract: CC=19 exceeds limit 15,62
      complexity.lizard_cc,warning,assertGeneration: CC=16 exceeds limit 15,110
      complexity.lizard_cc,warning,assertOperationPlan: CC=82 exceeds limit 15,153
      complexity.lizard_length,warning,assertOperationPlan: 129 lines exceeds limit 100,153
  scripts/research/rank-intent-graph-embeddings.py,0.90
    issues[3]{rule,severity,message,line}:
      complexity.cyclomatic,warning,main has cyclomatic complexity 27 (max: 15),35
      complexity.lizard_cc,warning,main: CC=27 exceeds limit 15,35
      complexity.lizard_length,warning,main: 133 lines exceeds limit 100,35
  src/core/ignore.ts,0.90
    issues[2]{rule,severity,message,line}:
      complexity.lizard_cc,warning,translateGlob: CC=29 exceeds limit 15,77
      complexity.lizard_length,warning,translateGlob: 107 lines exceeds limit 100,77
  src/core/schema.ts,0.90
    issues[2]{rule,severity,message,line}:
      complexity.lizard_cc,warning,assertIntentRecord: CC=23 exceeds limit 15,74
      complexity.lizard_cc,warning,assertGroundedGenerationMetadata: CC=22 exceeds limit 15,533
  src/diff/text.ts,0.90
    issues[2]{rule,severity,message,line}:
      complexity.lizard_cc,warning,myers: CC=21 exceeds limit 15,140
      complexity.lizard_cc,warning,backtrack: CC=25 exceeds limit 15,172
  src/extractors/communication.ts,0.90
    issues[2]{rule,severity,message,line}:
      complexity.lizard_cc,warning,extractCommunicationIntent: CC=78 exceeds limit 15,54
      complexity.lizard_length,warning,extractCommunicationIntent: 151 lines exceeds limit 100,54
  src/interfaces/a2a-task-store.ts,0.90
    issues[2]{rule,severity,message,line}:
      complexity.lizard_cc,warning,listTasks: CC=41 exceeds limit 15,397
      complexity.lizard_length,warning,listTasks: 107 lines exceeds limit 100,397
  src/pipeline/run.ts,0.90
    issues[2]{rule,severity,message,line}:
      complexity.lizard_cc,warning,runPipeline: CC=63 exceeds limit 15,55
      complexity.lizard_length,warning,runPipeline: 358 lines exceeds limit 100,55
  src/semantic/reranker.ts,0.90
    issues[2]{rule,severity,message,line}:
      complexity.lizard_cc,warning,assertSemanticCandidateSet: CC=22 exceeds limit 15,184
      complexity.lizard_cc,warning,assertSemanticRerankResult: CC=18 exceeds limit 15,311
  src/services/actions.ts,0.90
    issues[2]{rule,severity,message,line}:
      complexity.lizard_cc,warning,executeAction: CC=82 exceeds limit 15,72
      complexity.lizard_length,warning,executeAction: 434 lines exceeds limit 100,72
  examples/backend/src/server.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,handleRequest: CC=18 exceeds limit 15,28
  php/ast_extract.php,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,parseFile: CC=40 exceeds limit 15,77
  python/ast_extract.py,0.95
    issues[2]{rule,severity,message,line}:
      complexity.cyclomatic,warning,iter_python_files has cyclomatic complexity 16 (max: 15),168
      complexity.lizard_cc,warning,iter_python_files: CC=16 exceeds limit 15,168
  sdk/go/examples/basic/main.go,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,run: CC=19 exceeds limit 15,29
  sdk/php/src/Client.php,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,Client::call: CC=21 exceeds limit 15,106
  sdk/rust/examples/basic.rs,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,run: CC=20 exceeds limit 15,27
  src/cli.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,handleExtract: CC=20 exceeds limit 15,518
  src/communication/identity.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,assertParticipantIdentityRegistry: CC=29 exceeds limit 15,51
  src/comparison/workspace.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,commonPipelineOptions: CC=19 exceeds limit 15,192
  src/core/record.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,buildRecord: CC=33 exceeds limit 15,57
  src/core/text.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,inferObject: CC=31 exceeds limit 15,440
  src/evaluation/gold-types.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,assertLinkingCohorts: CC=25 exceeds limit 15,341
  src/extractors/ast/typescript.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,visit: CC=26 exceeds limit 15,77
  src/extractors/docs-record.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,toDocumentIntentRecord: CC=19 exceeds limit 15,25
  src/extractors/nl-llm.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,toIntentRecord: CC=24 exceeds limit 15,175
  src/graph/linker.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,scorePair: CC=18 exceeds limit 15,342
  src/interfaces/a2a-card.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_length,warning,skills: 103 lines exceeds limit 100,55
  src/interfaces/a2a-message.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_length,warning,parseKeyValues: 119 lines exceeds limit 100,67
  src/live/contract-check.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,measureStage: CC=17 exceeds limit 15,115
  src/llm/openrouter.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,request: CC=26 exceeds limit 15,171
  src/synthesis/code-change-path.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,isPlannablePath: CC=40 exceeds limit 15,138
  src/synthesis/code-change-plan.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,proposeCodeChangePlans: CC=22 exceeds limit 15,109
  src/tf/classifier.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,classifyAction: CC=18 exceeds limit 15,69
  src/watch/watcher.ts,0.95
    issues[1]{rule,severity,message,line}:
      complexity.lizard_cc,warning,watchRepository: CC=21 exceeds limit 15,147
```

## Intent

Dependency-free Python SDK for todo2code A2A and the local TypeScript runtime
