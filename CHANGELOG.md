# Changelog

## [0.5.1] - 2026-08-16

### Fixed
- Fix ast-unused-imports issues (ticket-4ba5fea1)
- Fix ast-sorted-imports issues (ticket-c3eb2df8)
- Fix ast-string-concat issues (ticket-8022e9d4)
- Fix ast-print-statements issues (ticket-73442493)
- Fix ruff-print-statements issues (ticket-78a74b25)
- Fix string-concat-fstring issues (ticket-5e941e99)
- Fix import-optimization issues (ticket-bfb77511)
- Fix ast-unused-imports issues (ticket-1207cf86)
- Fix ast-sorted-imports issues (ticket-5426b265)
- Fix ast-string-concat issues (ticket-cec0a95c)
- Fix ast-print-statements issues (ticket-cb8d0d20)
- Fix ruff-print-statements issues (ticket-8033862c)
- Fix string-concat-fstring issues (ticket-20d6bd0f)
- Fix ai-boilerplate issues (ticket-58a9aa28)
- Fix import-optimization issues (ticket-735c310d)
- Fix ast-unused-imports issues (ticket-56d37d70)
- Fix ast-sorted-imports issues (ticket-87efcac4)
- Fix ast-print-statements issues (ticket-bd0eb27d)
- Fix ruff-print-statements issues (ticket-f27a6d9f)
- Fix ai-boilerplate issues (ticket-90bfc403)
- Fix import-optimization issues (ticket-3230b5ff)
- Fix ast-unused-imports issues (ticket-8b4a03c1)
- Fix ast-sorted-imports issues (ticket-c31b4b42)
- Fix ast-print-statements issues (ticket-b2d212c4)
- Fix ruff-print-statements issues (ticket-e276cf83)
- Fix magic-numbers issues (ticket-4b9ed48e)
- Fix ai-boilerplate issues (ticket-db6f0e73)
- Fix import-optimization issues (ticket-58094a3d)
- Fix ast-sorted-imports issues (ticket-71e0eb0c)
- Fix ast-missing-return-type issues (ticket-732720bd)
- Fix ruff-sorted-imports issues (ticket-1b95e87a)
- Fix smart-return-type issues (ticket-2fef4e7f)
- Fix ai-boilerplate issues (ticket-e702f60d)
- Fix import-optimization issues (ticket-06011d26)
- Fix ast-unused-imports issues (ticket-099f1873)
- Fix ast-sorted-imports issues (ticket-90085a7c)
- Fix ast-string-concat issues (ticket-c5720ca3)
- Fix ast-print-statements issues (ticket-0fe32656)
- Fix ruff-print-statements issues (ticket-82d944e5)
- Fix string-concat-fstring issues (ticket-6c9c37a3)
- Fix ai-boilerplate issues (ticket-32e56943)
- Fix import-optimization issues (ticket-11fa42a5)
- Fix relative-imports issues (ticket-2ca30104)
- Fix no-relative-imports issues (ticket-adab9407)
- Fix relative-imports issues (ticket-a9a5d9ca)
- Fix import-optimization issues (ticket-adae0c4f)
- Fix no-relative-imports issues (ticket-6b6eb288)
- Fix ast-unused-imports issues (ticket-155ccd5a)
- Fix ast-sorted-imports issues (ticket-43404879)
- Fix magic-numbers issues (ticket-e1b5cb8f)
- Fix import-optimization issues (ticket-a42630d6)
- Fix ast-unused-imports issues (ticket-858b5c0d)
- Fix ast-duplicate-imports issues (ticket-debeb609)
- Fix ast-sorted-imports issues (ticket-6f5cfce3)
- Fix ast-string-concat issues (ticket-4cf163ba)
- Fix string-concat-fstring issues (ticket-5dcdcbf7)
- Fix importchecker-duplicate-imports issues (ticket-64435f7c)
- Fix magic-numbers issues (ticket-a62cce1b)
- Fix llm-generated-code issues (ticket-a21ddd72)
- Fix relative-imports issues (ticket-54646020)
- Fix ast-unused-imports issues (ticket-1c08cd50)
- Fix ruff-sorted-imports issues (ticket-be7783a8)
- Fix magic-numbers issues (ticket-65bcf7fb)
- Fix import-optimization issues (ticket-3b9f2c84)
- Fix no-relative-imports issues (ticket-ab53a2ef)
- Fix ast-unused-imports issues (ticket-136b561e)
- Fix ast-string-concat issues (ticket-adc36dba)
- Fix ast-print-statements issues (ticket-9ef611a4)
- Fix ruff-print-statements issues (ticket-d8100601)
- Fix ruff-sorted-imports issues (ticket-19744070)
- Fix string-concat-fstring issues (ticket-ff16970e)
- Fix magic-numbers issues (ticket-ecb171ec)
- Fix ai-boilerplate issues (ticket-f7463c34)
- Fix import-optimization issues (ticket-f0c3b8cd)
- Fix ast-unused-imports issues (ticket-cf4b5285)
- Fix ast-sorted-imports issues (ticket-185f57cf)
- Fix ast-string-concat issues (ticket-e54ace76)
- Fix ast-print-statements issues (ticket-07617160)
- Fix ruff-print-statements issues (ticket-0fca97a4)
- Fix string-concat-fstring issues (ticket-8e5a44bf)
- Fix ai-boilerplate issues (ticket-d8397164)
- Fix import-optimization issues (ticket-c5c015c0)

## [Unreleased]

### Changed

- Split task synthesis into provider orchestration, structured-response
  contract, grounded materialization and bounded payload modules. The public
  `tasks-llm` API, one-retry policy, provenance and fail-closed validation stay
  unchanged while the orchestrator drops from 554 to 266 lines.
- Audited semantic stages now default to fail-closed `require-llm`: NL,
  TODO/CHANGELOG enrichment, communication enrichment, standalone summaries
  and direct TODO synthesis no longer fall back unless the caller explicitly
  selects `prefer-llm`. Offline demos, tests and smoke checks select
  `deterministic` explicitly; optional documentation LLM and pipeline task
  synthesis remain separately enabled features.

### Added

- Published the ticket-048 GitHub event-log acquisition adapter with explicit
  `--event-path` and `--repository` inputs only. It maps one bounded GitHub
  Actions payload to `t2c.event-log/v1` without reading ambient environment
  variables, preserves canonical provenance and writes output atomically.

- Isolated Docker E2E environments in `Dockerfile.e2e` and `compose.e2e.yml`.
  The core suite covers deterministic Node/Python behavior; the full suite adds
  Go 1.23, JDK 17, Rust 1.85 and PHP, rejects skipped tests and requires parity
  across all five SDK examples. `T2C-E2E-*` codes identify the failed gate and
  provide a documented repair route without hiding command output.

- A dependency-free PHP syntax adapter based on PHP 8
  `token_get_all(..., TOKEN_PARSE)`. It emits namespace, import, type,
  function, method and call facts through the common adapter envelope, shares
  repository ignore scope, caches by the selected source manifest and degrades
  explicitly when the optional PHP runtime is unavailable. A controlled A/B
  on 40 tracked `semcod/redsl` PHP files produced 2,127 unique graph records,
  80 additional relations and 18 fewer warning diagnostics.

- Codestral 2508 is the measured OpenRouter default after a 6/6 live contract
  run at 57,129 ms and $0.037994. Gemini 3 Flash Preview also passed; DeepSeek
  V4 Pro crossed the 900-second budget. Markdown batches now run with bounded
  concurrency while preserving record and response audit order; `weekly`
  improved 218,741→53,362 ms and `nlp2uri` completed 619 records without
  fallback. The total live budget now actively aborts provider requests.

- Intent-vs-Reality grades aligned topics by evidence kind (`RealityRow.evidence`,
  `totals.alignedByEvidence`, and a line in the Markdown report). Configuration
  alone is weaker evidence than a parsed symbol or a commit, and until now both
  produced an identical `aligned`: measured on tracked `HEAD`, 16 of 46 aligned
  topics on `subactor/platform` rest on configuration against 4 of 89 here. The
  grade itself remains descriptive; the later capability gate can keep a topic
  open when configuration and a requirement share only a path, while an
  extracted matching key still proves configuration-backed implementation.
- `npm run live:models` (`make live-model-comparison`): an opt-in live comparison
  of models for the batched TODO/CHANGELOG stage, written as
  `t2c.live-model-comparison/v1`. The stage enriches in bounded 32-record
  batches, so its cost and latency scale with batch count and a single-call
  benchmark cannot answer which model it should use. The artifact reports
  requests, records the stage actually enriched (a rejected response leaves the
  deterministic record in place and does not change the record count), cost and
  time per record, and how often two models return the same action, modality,
  polarity and lifecycle for the same source record. Records are paired by
  source location rather than record ID: IDs are content-derived, so pairing on
  them would compare only the records the models already agreed on and report
  perfect agreement. A model that cannot honour the contract is a comparison
  result rather than a crash, and never wins the recommendation.
- The scheduled live provider check covers all six semantic stages instead of
  two (`t2c.live-contract-check/v2`). It measures the manifest of a
  `require-llm` pipeline run rather than calling stages itself, so it cannot
  drift from what the pipeline does — which is exactly how it came to cover
  two. Budgets are split per stage and per run, and a stage that silently fell
  back to deterministic fails the check even when it reports success.
- A recorded live-check history (`.intent-live/contract-check-history.json`,
  newest 50 runs, restored from CI cache and published as an artifact) with
  median latency and cost per stage. It is reported and never gates: one slow
  provider day should not fail a build, and a trend nobody stores cannot be
  read at all.

- Gold benchmark v2 (`t2c.gold-dataset/v2`, `evaluation/gold/v2/dataset.json`),
  now the dataset behind `npm run evaluate:gold`; v1 stays in the tree and
  stays evaluable through `npm run evaluate:gold:v1`. It adds a
  `documentation-deterministic` extraction channel for the offline Markdown
  baseline, prescriptive-versus-descriptive documentation cases, seven
  `capability-topic` positives and five hard negatives in place of one and two,
  and a `diagnostics` scope that measures per-record diagnostic codes —
  including a false DONE claim and the evidenced DONE that must stay quiet.
- `knownGap` linking cases: a relation the tool ought to find and demonstrably
  cannot, scored and reported separately and never inside precision/recall.
  The Polish-prose-to-English-module barrier is the first one, at 0/1.

### Changed

- Define the backward-compatible `project/` namespace: root-level generated
  files are technical analysis, while only recognised ticket directories,
  participant registries or explicit front matter produce communication DSL.
- Code-change plans reject non-actionable targets before materialisation:
  vendored/cache/build trees, binaries, generated analysis and todo2code run
  artifacts, directory-like and wildcard paths, absolute paths and URIs.
  Text sources such as SVG, lockfiles and ordinary documentation remain valid;
  the policy lives in the dedicated `code-change-path.ts` module instead of
  further growing the code-change planner.

### Changed

- Intent-vs-Reality files a declaration whose own target names no file under the
  single module aggregate it is linked to. Topics are keyed by each record's own
  ticket, path or symbol, so prose the linker had already connected to code
  still counted as "planned, no code" — on a Polish-documented repository, most
  of the corpus. One hop only, and only when every module the declaration
  touches names the same file; connected components stay refused, and the 69
  ambiguous declarations measured on `subactor/platform` keep their old key.

### Fixed

- The A2A server binds `127.0.0.1` by default instead of `0.0.0.0`. The Bearer
  token is optional, so the previous default served repository analysis to
  every reachable client of anyone who never set one: measured by starting
  `t2c a2a` with defaults and receiving 8,806 bytes of commit data over an
  unauthenticated `SendMessage` from this host's LAN address. Network
  deployment is now an explicit choice, which `docker-compose.yml` and
  `scripts/examples-check.sh` already make, and a non-loopback bind without a
  token prints a startup warning.
- Generated-analysis normalization removes detached `/tmp/t2c-analysis.*`
  roots embedded inside historical tracked logs as well as the current source
  root, preventing a fresh `project/index.html` from failing its isolation gate.
- CLI `--help` after a command is non-mutating. In particular,
  `t2c pipeline --help` no longer executes a pipeline or writes `.intent`.
- Polish `zabrania się` and `zabraniają` forms are recognized as required,
  negative prohibitions, avoiding false `CONFLICTING_INTENT` diagnostics
  against equivalent TODO statements.
- The shared Markdown path resolver rejects absolute, Windows-absolute and
  parent-traversal inputs, including traversal introduced by a heading scope.
  Existing, missing, unique and ambiguous repository-relative paths preserve
  their deterministic behavior.
- Deterministic documentation extraction (`t2c/markdown-documentation@2`) shares
  the Markdown path resolver with TODO and CHANGELOG. It was the one converter
  that kept a bare filename, so prose naming `ARCHITECTURE.md` produced a
  root-level path that does not exist while `docs/ARCHITECTURE.md` does. On
  `if-uri/urirun` this cut bare non-existent path tokens from 375 to 100 and on
  `wronai/contract` from 160 to 79, with no record lost and slightly more
  relations, because a resolved path can link to the Git and AST evidence for
  that file.
- The repository basename index skips a directory carrying its own `.git`. A
  nested checkout or agent worktree duplicates every basename and blocks
  resolution repository-wide: on `if-uri/urirun`, 63 worktrees under
  `.claude/worktrees/` shadowed the real `docs/ARCHITECTURE.md`, which 24
  documentation records can now name.
- `compare-workspace` honours `T2C_ALLOW_OUTSIDE_ROOT` for its `--out`
  directory. Every other scoping call site takes the configured value; this one
  hard coded the restriction, so analysing a third-party checkout while keeping
  its artifacts out of that tree failed with `outside configured T2C_ROOT`
  where the same `--out` works for `pipeline`. The default stays closed and an
  escaping directory keeps its absolute form in the manifest; recorded
  `artifacts` paths stay root-relative, which is how consumers resolve them.
- Intent-vs-Reality separates a topic *about* a document from the statements
  merely *written in* it. A declaration that names nothing fell back to its own
  source file inside the `path:` namespace, so unattributable prose joined the
  topic for that file: 283 release notes beside the 20 naming `CHANGELOG.md` on
  `if-uri/urirun`, and 447 beside 40 on `semcod/goal`, making a document look
  like a heavily declared topic with no implementation. The fallback now uses a
  `source:` namespace and is labelled `(unattributed)`. Observed evidence is
  untouched — AST, Git and configuration records always carry their own target
  and never reach the fallback — and urirun's topic count rises 1114 to 1137
  with coverage correcting 25.0% to 24.0%.

- Python AST extraction records bounded module/class named constants and the
  canonical `if __name__ == "__main__"` entrypoint without promoting ordinary
  local variables. Module aggregates expose constant identifiers instead of a
  shared literal description, and external AST cache keys now include the
  adapter contract identity so changed extractors cannot reuse stale facts.
- TODO extraction resolves a bare filename through its Markdown heading scope
  or a unique repository basename. Ambiguous names remain unresolved instead
  of being assigned to an arbitrary file.
- CHANGELOG extraction (`t2c/markdown-changelog@2`) shares that resolver with
  TODO, so a file named by both documents carries one identity in the graph.
  On `wellmanifest/new-project` the released claim about `new-ticket.sh` and
  the plan for `project/new-ticket.sh` described the same file under two
  targets and never linked; the claim now links to its Git evidence. The
  repository is indexed at most once per extraction, and only when a bare
  basename needs it.
- A code-change plan marks a file the repository does not contain as `create`
  instead of `modify`. Documentation routinely plans files that do not exist
  yet, and on `wellmanifest/new-project` five of seventeen planned files —
  including `docs/ARCHITECTURE.md` and `compose.yml` — instructed an executor
  to modify a missing file, which `apply-source-patch` could not accept.
  Plan synthesis stays pure: the caller injects the repository probe, and
  without one the conservative `modify` is kept.
- A code-change plan no longer invents a repository-root file from a bare
  filename, and never targets a home-relative or variable-expanded location.
  A path without a directory is shorthand that never said where the file
  belongs: across seven foreign repositories this proposed creating
  `__init__.py` beside 22 real ones, `pyproject.toml` beside 32, prose
  fragments such as `it.md` and `potr.md`, and — from a release note about
  runtime state — a literal `~` directory via `~/.urirun-host/mesh.json`.
  Removing 18 such instructions on `if-uri/urirun`, `semcod/goal`,
  `semcod/code2llm` and `wellmanifest/new-project` freed bounded plan slots
  for directory-qualified targets. A bare name that does exist at the root
  is still planned as `modify`, and the diagnostic continues to report every
  gap the plan withholds. The cost is real: a plausible root-level
  `compose.yml` is withheld too, because the source never said where it goes.
- Bounded code-change planning prioritizes active
  `PLANNED_NOT_IMPLEMENTED` work over historical changelog audit findings and
  derives each file rationale from the source intent rather than a generic
  diagnostic remediation.

- Code-change titles preserve compound source intent when action inference
  removes a secondary verb. The PLF-003 source now renders as `Implement ...
  and verify it ...` instead of `Implement Implement ... and it ...`.

- A capability-bearing TODO no longer becomes implemented merely because its
  target file exists. `shared_path + module_coverage` remains in the graph for
  navigation, while diagnostics and Intent-vs-Reality require a symbol,
  extracted capability overlap, grounded concrete-fact similarity or accepted
  semantic rerank. Gold now includes the real retry/backoff negative and its
  implemented positive control; an autonomous Koru replay created `PLF-003`,
  verified commit `55a8b15`, and the subsequent analysis produced zero target
  plans.

- Make the opt-in six-stage live contract check usable with an explicit
  structured-output default (`google/gemini-3.6-flash`, measured 6/6 in
  125.486 s for $0.412363). Direct NL, Markdown, documentation and
  communication extraction now get one schema-preserving corrective attempt;
  both rejected and accepted responses retain provider/model/token/cost
  metadata. The live request timeout can no longer be shorter than its stage
  budget, and rendered history includes the run just recorded.

- Match Polish documentation against English identifiers through a reviewable
  PL→EN domain dictionary, including Polish endings on English loanwords
  (`ticketu`, `foundera`). Polish function words no longer pose as topics
  either: `nie` (175), `jest` (110) and `jako` (54) were among the most frequent
  "topics" in the measured corpus, and topic buckets keep only twelve tokens per
  record, so grammar was displacing vocabulary before matching began. The stop
  list also folds its own diacritics — `się`, `może` and `należy` were written
  in a form `keywords` could never produce, so they had never filtered anything.
  A/B on identical content: `aligned` 25 → 43 and implementation coverage
  5,9% → 10,0% on `subactor/platform`, 74 → 82 and 22,0% → 24,4% here.
- `detectModality` reads prohibitions (`nie wolno`, `nie może`, `zabronione`,
  `is not allowed`, `is forbidden`) and periphrastic obligation (`has to`,
  `ma obowiązek`) as requirements rather than `unknown` — or, for `nie może`,
  as `optional`, because the permissive rule matched the `może` inside the ban.
  Polish modals are now matched on the diacritic-folded form as well: `\b` treats
  `ą` as a non-word character, so `\bmuszą\b` could never match the word it named.
- `topicKeywords` folds regular English plurals and the missing inflections of
  existing families (`validated`, `validates`, `links`, `documenting`), guarded
  against `ss`/`us`/`is`/`as`/`os` endings so `status`, `class` and `analysis`
  stay intact. Against a floor of three shared topics, one unfolded plural was
  the difference between finding and missing a module. Measured from tracked
  `HEAD`: relations 24 246 → 24 400 here and 10 875 → 11 002 on
  `subactor/platform`, with `aligned` and implementation coverage unchanged.
- Generate committed analysis and `docs/README.md` from a detached snapshot of
  tracked `HEAD` by default. The new verification gate rejects leaked
  untracked paths, temporary snapshot paths and parser-download failures;
  `prefact -a` is no longer an implicit side effect and requires
  `T2C_APPLY_PREFACT=1`. A compatibility entrypoint also supplies lowercase
  parser IDs to affected `vallm` batch releases and distinguishes reportable
  quality findings from an unavailable parser. Absolute analysis roots are
  normalized to `<PROJECT_ROOT>`, and generated files are not recursively
  consumed as source input.
- Preserve the public diff and gold-evaluation type APIs through explicit type
  exports instead of TypeScript 5 `export type *`; this remains equivalent for
  TypeScript consumers and is understood by the current validation grammar.
- Synchronize generated `docs/README.md` badges and license from `package.json`
  after `code2docs`; the external generator currently falls back to version
  `0.1.0`, a TypeScript badge and MIT for this Node/Apache-2.0 project. Template
  drift fails closed instead of silently publishing incorrect metadata.
- Re-include `.github/workflows/` after the broad hidden-directory ignore rule,
  so CI configuration is actually converted to Intent DSL and can evidence
  completed workflow tasks. Documentation files now also ground changelog
  entries that name their exact path, removing two false code-change plans in
  the repository audit.
- Stabilize live task synthesis and summary without weakening grounding:
  provider-supplied `recordIds` are restricted to the evidence of the cited
  diagnostics, unknown `diagnosticIds` still fail closed, and blank
  response-local proposal keys receive deterministic runtime keys. The
  affected LLM generators now report `generatorVersion: "2"`.
- Stop treating parenthetical labels and bare adjectives such as
  `OpenRouter (recommended)` or `Required secrets` as deontic requirements.
- Scope `detectPolarity` so "without …" / "bez …" complements are not whole-
  sentence negation.
- Restrict configuration file aggregates to explicit path evidence. Reusing
  AST capability-topic matching produced 288 mostly generic cross-source links
  from five config files on `code2llm`; the hardened run retains 2 grounded
  path links and no configuration-to-configuration noise.
- Parenthesize mixed `??`/`||` in configuration file-aggregate format
  resolution so the compiled extractor no longer throws a SyntaxError at runtime.

### Added

- Added `t2c close-code-change` and the `close_code_change` MCP/A2A/TypeScript
  SDK action for evaluating a single plan or plan set against before/after
  graphs. `t2c.code-change-close-result/v1` has a published schema and complete
  deterministic provenance; it never applies changes or marks work DONE.
- Added one deterministic `configuration_file_fact` per discovered config file,
  including empty files, with bounded key inventory, runtime provenance and
  file-level linking. Configuration is also represented as observed reality.
- Added grounded `t2c.code-change-plan/v1` proposals and
  `t2c.code-change-acceptance/v1` re-analysis gates through CLI, MCP, A2A and
  the TypeScript SDK. Plans carry content-bound IDs/hashes, exact evidence,
  risk, rollback and runtime provenance; they never edit source files or mark
  work complete.
- Main pipeline always materialises `code-change-plans.json`,
  `CODE_CHANGE.review.md`, `CODE_CHANGE.review.json` and
  `code-change-source-patches.json` after diagnostics
  (deterministic `codeChangePlanning` stage in the run manifest).
- Added `t2c.code-change-review/v1` hash-bound review briefs plus CLI
  `render-code-change` (also MCP/A2A/SDK). Briefs never apply source edits.
- Added `t2c.code-change-source-patch/v1` structured edit proposals with
  path-bound instructions, optional validated unified diffs, secret heuristic
  rejection and CLI `propose-source-patch` (MCP/A2A/SDK).
- Added `apply-source-patch` with explicit actor + patchHash approval, complete
  multi-file preflight, atomic per-file writes with rollback, symlink rejection
  and an idempotent receipt
  (`t2c.code-change-source-apply-receipt/v1`). Instruction-only edits refuse apply.
- Added `propose-code-change` and `evaluate-code-change` CLI workflows with
  root-confined JSON artifacts and an end-to-end persisted-file test.
- Reject absolute host paths, HTTP routes and parent traversal in
  `target.paths`, and reject hostnames as false symbols, so code-change
  planning cannot crash a finished pipeline on platform docs.
- Extended the offline gold set with bare-basename cases, multi-clause NL,
  non-path route/host extraction and ticket exact-target linking.
- Added `make demollm`, which requires live OpenRouter execution for all six
  semantic pipeline stages, rejects fallback or degraded manifests, reports
  model/token/cost metadata, and is documented with process/sequence diagrams.

- Added a deterministic Markdown documentation baseline for headings, fenced
  examples and explicit path/symbol/ticket references. Offline pipeline runs
  now produce versioned `document` DSL records before optional LLM enrichment.
- Added governed `t2c.variable-contract/v1` and `t2c.operation-plan/v1`
  contracts plus a fail-closed compiler to a non-executing
  `subactor.process-envelope.v2` proposal.
- Added deterministic repository configuration extraction for JSON, YAML,
  TOML, Dockerfile and CI workflow structures through pipeline, CLI, MCP, A2A
  and all five SDKs.
- Added bounded 32-record TODO/CHANGELOG LLM enrichment batches with stable
  input ordering, one shared audit and response provenance on each output
  record.
- Added `verify:workflows`, which rejects duplicate top-level workflow YAML
  keys before CI configuration can silently lose a trigger.
- Limited the Node test runner to four concurrent files so the live Git watch
  integration test is not starved by compiler-backed adapter suites.
- Added an opt-in scheduled OpenRouter contract check for live NL extraction
  and grounded summary generation. It runs both paths in `require-llm`, writes
  a redacted latency/token/cost audit, enforces configurable budgets and stays
  isolated from the required offline CI jobs.
- Added module-level AST facts for every supported language and made them the
  file-level linking/summarization boundary. Low-level calls no longer form a
  quadratic AST-to-AST subgraph merely because they share a source file.
- Added a live Git-repository watch regression test, automatic `TASK.md`
  discovery, explicit `--task none`, and documented `--no-summary-llm`
  support for fast deterministic watch cycles.
- Added `make docker-smoke`; `make validate` and CI now build the production
  image and verify its A2A health endpoint plus `doctor` inside the container.
- Added an end-to-end Polish architecture guide with seven validated Mermaid
  diagrams covering source converters, Intent DSL, evidence linking,
  diagnostics and the validated DSL-to-conclusion-to-NL path.
- Summary generation now materializes and validates grounded
  `t2c.conclusion/v1` objects before deterministic Markdown rendering, with a
  persisted `summary-conclusions.json` artifact and citation-safe fallback.
- `t2c summarize` now exposes the explicit
  `deterministic|prefer-llm|require-llm` mode contract used by NL and Markdown;
  `prefer-llm` is the default and the former `--fallback` switch remains a
  compatibility alias.
- CI now has a required Temurin JDK 17 job for the Java compiler-tree adapter;
  `T2C_REQUIRE_JAVA_TEST=1` turns a missing Java runtime into a test failure
  instead of a local skip.
- Added the strict `t2c.participant-registry/v1` contract at
  `project/participants.json`. Communication front matter can bind an exact
  `participant-id` to runtime-owned human/agent role, Git authors, A2A agent
  IDs and optional human aliases; duplicate external identifiers, unknown IDs,
  role conflicts and display-name-only messages are never guessed into an
  identity.
- Added opt-in audited structured OpenRouter enrichment for `project/<ticket>`
  communication and grounded `t2c.participant-synthesis/v1` summaries for each
  human or agent. Runtime-owned identity, role, ticket, source lines,
  lifecycle and epistemic class cannot be supplied or promoted by the model;
  deterministic and explicit fallback modes remain available through CLI,
  pipeline, MCP and A2A.
- Added the versioned offline `t2c.gold-dataset/v1` benchmark and
  `npm run evaluate:gold` quality gate for NL, captured documentation responses,
  Markdown, linking and DSL2TODO. It reports precision, recall, citation
  completeness, duplicate classification/rate and repeated-run stability.
- Added normalized module-capability topic matching between AST aggregates and
  NL/TODO/document declarations. A three-shared-topic floor keeps the matching
  precision-oriented; the repository audit raised AST↔NL relations from 0 to
  10 and AST↔TODO from 1 to 71 while AST↔AST stayed at 617.
- Every `t2c.intent/v1` record now carries mandatory runtime-owned
  `metadata.generation`: converter name/version and todo2code runtime version
  for deterministic records, plus provider, resolved model and response ID for
  LLM records. Explicit requested/used/degraded/fallback fields make fallback
  provenance auditable. Runtime validation and JSON Schema reject missing or
  internally inconsistent generation envelopes.
- Grounded conclusions, TODO proposals and participant syntheses now identify
  their todo2code generator and generator version alongside the existing
  runtime, mode and optional OpenRouter response provenance.
- Gold linking quality is now reported separately for exact-target and
  capability-topic relations. The dataset includes a positive prose-to-module
  case and a hard negative below the three-topic floor; both classes currently
  achieve 100% precision/recall with zero forbidden-pair violations.

### Fixed

- Suppressed configuration-to-configuration relations based only on repeated
  key vocabulary while preserving shared-ticket and cross-source evidence.
  Re-runs on `code2llm`, `domd` and `pactfix` produced no config↔config noise.
- Code-change review rendering now validates every persisted plan's structure,
  content-bound ID/hash, graph fingerprint and generator provenance before it
  creates the Markdown and audit hashes.
- Bare source filenames now contribute path evidence only when they resolve to
  exactly one repository path. Unique references such as `markdown.ts` link to
  their module aggregate, while ambiguous names require an explicit directory.
- Descriptive documentation is no longer diagnosed as an unimplemented plan.
  Only prescriptive `required` or `recommended` document records participate in
  `PLANNED_NOT_IMPLEMENTED`; TODO and NL plans retain their existing behavior.
- Made the Python AST adapter consume the same `.gitignore`, `.dockerignore`
  and `.intentignore`-filtered file set as the Node adapters. Large repositories
  no longer lose all Python facts when generated project copies overflow the
  helper output buffer.
- Restricted automatic `project/` communication discovery to ticket-shaped
  directories, human/agent filenames, participant registries or explicit
  communication front matter. Generated analysis such as
  `project/batch_1/context.md` is no longer misclassified as agent dialogue.
- Workspace headline trends now use declared business-topic implementation,
  comparable documentation and severe diagnostics. Raw AST-only topic growth,
  source-line movement and record identity churn remain visible without
  misclassifying the overall direction.
- Public NL extraction rejects a missing root/source path with a named option
  error before calling Node path helpers. AST extraction now reports counts of
  discovered unsupported source-language files explicitly.
- Updated project status, pipeline and validation documentation from a fresh
  todo2code self-audit and the current offline example run.
- Validate the raw summary envelope and every provider-owned field before
  creating semantic conclusion IDs. The summary prompt now names the exact
  seven-field contract and requires verbatim top-level diagnostic/record
  citations; a live `require-llm` OpenRouter run produces validated
  `t2c.conclusion/v1` objects instead of falling back on an internal `.trim()`
  error.
- `compare-workspace --out` now applies the same root confinement as other
  artifact-producing actions and rejects absolute or traversing paths outside
  `T2C_ROOT` instead of silently rewriting them below the repository.
- Intent-vs-Reality now treats declaration plus observed implementation as
  `aligned` offline. Documentation coverage remains an independent metric and
  `IMPLEMENTED_NOT_DOCUMENTED` remains a visible diagnostic.
- Markdown TODO/CHANGELOG continuation lines retain their complete statement
  and source range; repository ignores and hard vendor/environment exclusions
  are honored during AST walking; prose alternatives such as
  `backend/frontend` no longer become path targets.
- Split the documentation-to-Intent LLM extractor into focused orchestration,
  chunking, schema, record-repair and type modules. The public API and audited
  output remain unchanged while the former 531-line god module is removed.
- Split the MCP stdio server into protocol orchestration, tool catalog/action
  dispatch, resource access and error modules while preserving modern 2026 and
  initialized legacy request behavior.
- Split the dependency-free Go SDK into stable package constants, public wire
  types, the A2A transport client and action wrappers without changing its
  exported package API.
- Split the deterministic text-diff engine from unified, SVG and HTML
  rendering while keeping every renderer re-exported from the existing public
  `src/diff/text` entrypoint.
- Split the blocking Rust SDK into transport client, action wrappers, wire
  types and error modules, retaining the original crate-root public exports.
- Split the A2A server into HTTP/JSON-RPC routing, agent-card discovery, run
  history, message parsing, shared protocol types and persistent task-store
  modules. The A2A v1.0 and authenticated multi-replica behavior is preserved.
- Split the versioned gold evaluator into dataset validation, extraction
  fixtures, case evaluation, metrics and report orchestration while preserving
  the perfect benchmark result and repeated-run stability.
- Decomposed graph-link candidate indexing and source-direction rules into
  focused helpers while preserving deterministic relation ordering and graph
  fingerprints.
- Stopped treating ticket prefixes such as `T2C` as code symbols and stopped
  action-like inline-code identifiers such as `validateContract` from
  overriding the explicit prose verb. Validation verb forms are recognized
  without misclassifying the noun "validation" as an action.
- File-path extraction now accepts recognized repository extensions instead of
  every dotted token. Intent DSL fields such as `statement.object`,
  `epistemic.basis` and `metadata.generation` remain symbol references, while
  real JSON/YAML/source paths are preserved.
- Intent-vs-Reality and workspace trend reports now label documentation
  coverage as not measured when a run contains no `document` records instead
  of presenting a misleading, confident 0.0%.
- Relicensed the project, all published SDK manifests and bundled license files
  from MIT to Apache License 2.0; README and container/package metadata now use
  the same SPDX identity.

## [0.5.1] - 2026-08-01

### Docs
- Update README.md
- Update TODO.md
- Update project/ticket-018/README.md
- Update project/ticket-018/ai-codex.md
- Update project/ticket-018/changelog.md

### Other
- Update project/ticket-018/ai-codex-logs.txt
- Update project/ticket-018/intent.json
- Update python/.env.example
- Update python/.gitignore
- Update python/tests/test_python.py
- Update rust-ast/tests/placeholder_test.rs

## [0.5.0] - 2026-07-30

### Added

- Defined the grounded `t2c.conclusion/v1` and `t2c.todo-proposal/v1`
  contracts as TypeScript types and published JSON Schemas. Runtime validators
  enforce stable semantic IDs, existing diagnostic/intent citations, graph
  fingerprint consistency, acceptance criteria and explicit LLM/degradation
  provenance before either object can cross a public boundary.
- Added audited structured graph + diagnostics task synthesis through
  OpenRouter. `require-llm` fails with a typed audited error, while a degraded
  `prefer-llm` result keeps semantic conclusions/proposals empty and exposes
  only clearly labelled raw diagnostic actions. The runtime owns public IDs,
  provenance and validation rather than trusting those fields to the model.
- Added deterministic proposal classification against existing TODO records,
  with explicit matching evidence and separate ordered/new/duplicate ID lists.
  Dependency graphs must be complete and acyclic, dependency-first ordering
  respects P0–P3 among ready tasks, and acceptance criteria are non-blank and
  unique after whitespace normalization.
- Added the versioned `t2c.todo-patch/v1` audit and deterministic review
  renderer. It emits only new dependency-ordered proposals while retaining
  duplicate evidence, graph/diagnostic/source fingerprints and complete
  synthesis runtime/model metadata in the adjacent JSON artifact.
- Added explicit hash-bound TODO approval and atomic apply with stale-source and
  tamper rejection, preserved file permissions, an actor/time receipt, crash
  recovery and idempotent repeated apply.
- Exposed the complete propose → review → approved apply workflow as
  `propose-todo`, `render-todo` and `apply-todo` CLI commands and matching
  service, MCP, A2A, TypeScript, Python, Go, Rust and PHP SDK operations.
- Added optional task synthesis to the main pipeline. Successful runs persist
  synthesis, validation and review-only patch artifacts in the versioned run
  manifest; approval remains a separate, explicit operation and its receipt is
  added to the same manifest.
- Extended all five SDK examples and `examples:check` with cross-language
  parity for proposal IDs, duplicate IDs and the rendered patch fingerprint.
- Integrated versioned `project/<ticket>` communication into every main
  pipeline run. Participant analysis and its Markdown projection are persisted
  in the manifest, while communication issues become grounded graph
  diagnostics available to task synthesis and Intent-vs-Reality.
- Added communication-aware run-history and graph-comparison filters for
  participant, role, ticket and issue severity, exposed them in the history UI,
  and verified that watcher changes coalesce under the existing rate limit.

### Fixed

- Added a reproducible `examples:check` command covering the offline pipeline,
  ticket communication, strict backend/frontend compilation, HTTP integration
  and cross-language graph-fingerprint parity for every available SDK.
- Documentation records are repaired deterministically when the model leaves gaps. Measured on a three-document corpus, the model returned the chunk's first line for every record, an empty target for every record and `action: unknown` for every record. The runtime now re-anchors each record to the line whose wording actually matches the statement, backfills `target` with the existing path/symbol/ticket/version extractors, and derives `action`/`modality` from the same dictionaries the deterministic extractors use. Source anchoring went from 33% to 100% correct and empty targets from 100% to 29%. Every repair is recorded in `epistemic.basis` (`runtime_line_reanchor`, `runtime_target_backfill`, `runtime_action_backfill`, `runtime_modality_backfill`), so model output stays distinguishable from runtime inference, and neither the `llm_inference` class nor the 0.85 ceiling is affected.
- `statement.object` no longer accepts the literal placeholder `unknown` as content in the NL and documentation extractors. `action`, `modality` and `lifecycle` are enums containing that token and models copied it into the free-text slot; because `object` seeds the linker's keyword bucket, every such record collided with every other. A placeholder is now treated as an absent value and reported in `metadata.missingFields`.
- The documentation prompt now requires the line that carries the statement rather than the fragment start, maps descriptive documentation to `declare`/`validate`/`preserve`/`depend_on` instead of defaulting to `unknown`, and requires `target` to be filled when the text names a path, symbol, endpoint, ticket or version.

- Made `make demo`, `npm run demo` and the local Python runtime example fully
  deterministic through a public `--no-summary-llm` pipeline option, and added
  the `DEMO-101` participant analysis to the standard demo.
- Replaced stale Git-dependent relation counts and SDK fingerprints in the
  example documentation with current, reproducible expectations.

### Documentation

- Expanded the remaining P0 backlog into an ordered implementation plan for
  audited `TODO.patch` rendering and approval, CLI/MCP/A2A/SDK exposure,
  communication pipeline integration and the final release validation gate.

## [0.4.0] - 2026-07-29

### Added

- Added deterministic `project/<ticket>/` human/agent communication extraction
  to canonical `agent_log` records plus per-participant divergence analysis.
  The CLI, MCP and A2A detect conflicting statements, unanswered requests,
  agent work outside human intent and completion claims without Git/AST
  evidence while keeping ambiguous identities explicit.
- Added `extract_communication` and `analyze_communication` to MCP, A2A and
  every SDK action registry, plus a CLI that emits JSON, Markdown and the
  underlying evidence graph.

### Fixed

- The offline smoke fixture now copies only tracked or intentional untracked
  example sources, preventing ignored `.intent-*` demo artifacts from entering
  the temporary Git history and overflowing the bounded Git extractor output.

### Documentation

- Added a reproducible README walkthrough covering the offline DSL pipeline,
  manifest inspection, A2A/UI startup, audited SDK extraction and an observable
  `require-llm` failure without a silent deterministic fallback.
- Added a current project-status matrix with fresh validation evidence, known
  semantic/runtime limitations and an explicit distinction between the working
  DSL analysis pipeline and the not-yet-implemented structured DSL2TODO loop.
- Reorganized the backlog by priority around validated conclusions,
  `t2c.todo-proposal/v1`, reviewable `TODO.patch`, semantic quality metrics,
  AST signal aggregation and adapter modularization.

## [0.3.0] - 2026-07-29

### Added

- Complete runtime validation for `t2c.intent/v1`, `t2c.graph/v1` and
  `t2c.diff/v1` at linker, diagnostics, diff/reality and summary boundaries,
  including exact keys, enum/range/hash checks, relation endpoints and graph
  statistics.
- Standalone LLM stage audits now include the runtime version and redacted
  effective parameters; documentation-derived records use the same
  `metadata.generation` provenance envelope as NL and Markdown.
- NL and documentation convenience methods in the TypeScript, Python, Go,
  Rust and PHP SDKs. Every runnable example exercises deterministic NL and
  verifies its audit before graph construction.

- Java AST adapter based on the official JDK Compiler Tree API and Rust AST
  adapter based on `syn`; both emit the common `{facts,warnings}` envelope,
  exact source ranges and explicit optional-toolchain degradation.
- Failed-run manifests for every pipeline failure, including NL/Markdown
  `require-llm` aborts and unexpected later-stage errors. They preserve
  completed runtime/configuration/stage evidence while intentionally omitting
  a graph and leaving `latest.json` unchanged.
- OpenRouter response audit with response ID, resolved model/provider, token
  usage and cost whenever returned by the provider.
- Cross-language path and symbol normalization used by record construction,
  linking and Intent-vs-Reality projection.
- Relevance-aware documentation extraction budgets for chunk size/count,
  records per chunk and a separate timeout, including `DOC_CHUNK_BUDGET`
  warnings and target hints from earlier pipeline stages.
- Authenticated `GET /api/runs` history endpoint for complete graph runs under `.intent/runs`.
- Optional `compact: true` graph-diff response containing fingerprints, summary counts and SVG without complete record and relation arrays.
- Go AST adapter (`golang/ast_extract.go`) built on the standard `go/ast` parser, emitting the same `{facts, warnings}` envelope as the Python helper. It records packages, imports, types, functions, package-level vars/consts and calls; methods carry their receiver so `Entry.Describe` resolves from a TODO or commit. Enabled with `T2C_ENABLE_GO_AST` (default true) and `T2C_GO`; `doctor` now reports the Go toolchain.
- Python `TypeScriptRuntime` bridge, runnable example and wheel target for using the canonical Node/TypeScript pipeline, diagnostics, graph diff and Intent-vs-Reality implementation without an HTTP server.
- `t2c watch` change detection that regenerates the report at most once per minute. Two independent timings apply: `--scan-interval` (default 2 s) governs how quickly a change is noticed, `--interval` (default 60 s) is the floor between reports. Changes arriving faster are coalesced rather than queued, and a report never starts while the previous one is still running.
- Gitignore-compatible ignore-file support (`src/core/ignore.ts`) reading `.gitignore`, `.dockerignore` and `.intentignore` in that precedence order, with negation, directory-only rules, `**` and character classes.
- `.intentignore`, seeded by `t2c init`, excluding every dot-directory (`.*/`), the `.intent/` output tree, build output, lockfiles, logs and temporary artefacts.
- Optional persistent A2A task store with atomic snapshots, inter-process locking, restart recovery and cross-replica idempotency, configured through `T2C_A2A_TASK_STORE`.
- Audited NL → Intent DSL extraction through OpenRouter with `deterministic`, `prefer-llm` and `require-llm` modes. Every record identifies LLM or fallback provenance, while failures use stable reason codes instead of silently changing semantics.
- `t2c compare-workspace` and `compare_workspace` MCP/A2A/SDK action for comparing a Git base such as `origin/main` with committed, staged, unstaged and untracked filesystem state. It emits graph diff SVG, two reality projections and deterministic coverage-trend metrics.
- Run-manifest execution audit containing runtime version, redacted configuration fingerprint, requested models and per-stage status, duration, record/warning counts and degradation reason.
- Module-boundary verification for dependency cycles and independence of `src/core`, executed by `npm run verify`.
- Audited hybrid TODO/CHANGELOG extraction: deterministic Markdown establishes lifecycle and release provenance, while one structured OpenRouter request enriches semantic fields in `prefer-llm`/`require-llm` modes.
- Environment-contract verification covering runtime, Docker/Compose and SDK example variables, including optional synchronization checks for the private `.env`.

### Changed

- Split the AST extractor into a small orchestrator, independently exported
  TypeScript/JavaScript, Python, Go, Java and Rust adapters, and shared external
  process/record materialization modules without changing the public envelope.
- Split grounded summary payload selection and Markdown rendering out of the
  LLM/conclusion orchestrator, reducing the former god module while preserving
  response validation and deterministic output.
- TODO and CHANGELOG deterministic conversion now lives in independent
  `todo.ts` and `changelog.ts` modules; `markdown.ts` only composes them and
  the audited LLM enrichment remains a bounded shared orchestration step.
- The public package entry point now exports the audited NL orchestrator,
  target normalization and the source-specific TODO/CHANGELOG converters.
- The documentation structured-response schema now describes and bounds every
  field accepted from the model instead of allowing arbitrary array items.

- Optional TensorFlow is installed only into `adapters/tensorflow` by
  `make install-tf`; the main dependency tree and production image remain at
  zero audit findings. Runtime resolves it through `T2C_TF_MODULE_PATH` and
  records an explicit heuristic fallback when unavailable.
- Run configuration snapshots now include all AST/TensorFlow adapter settings
  and documentation budgets in their fingerprint.
- The history UI uses compact graph diffs, reducing the measured response for the two repository runs from 38.71 MiB to 13.71 KiB.
- NL extraction defaults to `prefer-llm`: configured OpenRouter is primary and the deterministic parser is an explicitly marked degraded fallback. `require-llm` fails instead of falling back.
- All five SDKs expose workspace comparison, and their examples cover the optional origin-to-filesystem flow.
- Run history and the SVG UI expose `succeeded`/`degraded` status and runtime version.
- Workspace comparison classifies simultaneous coverage gains and new gaps as a `mixed` trend and uses deterministic summaries for both sides, avoiding two unnecessary OpenRouter calls.
- All five SDKs expose explicit Markdown extraction mode and the Markdown stage audit; runnable examples select deterministic mode, assert `audit.status=succeeded` and remain offline/reproducible.
- Docker Compose uses `T2C_DOCKER_HOST_PORT` for host mapping, legacy `T2C_URL` was consolidated into `T2C_A2A_URL`, the conflicting `compose.yml` stub was removed, and redundant Dockerfile defaults now come from the TypeScript configuration.

### Fixed

- Failed history entries no longer prevent `GET /api/runs` from listing later
  successful graphs; graph selectors include only runs that actually have one.
- A literal `.intent/runs/<id>/team-summary.md` documentation input can bypass
  the default generated-output exclusion, while recursive `.intent` globs stay
  blocked.
- Nested Cargo `target` and adapter `node_modules` directories no longer inflate
  Docker build context or release ZIP; the image build now uses the committed
  root lockfile and `npm ci`.
- A repository with no commits yet no longer aborts the run. `git log` fails on a freshly initialised repository — the state `t2c init` leaves behind and the first one `t2c watch` encounters — so the Git extractor now degrades to a warning like every other absent source.
- The SVG diff UI now selects the previous and latest run by default, displays both history selectors and computes their comparison automatically.
- Explicitly requested `.intent/runs/<id>/team-summary.md` files can be analyzed as documentation without permitting recursive ingestion of generated `.intent` output.
- Offline A2A/MCP probes now override local LLM/version settings so validation remains deterministic and checks the current runtime version.

### Documentation

- Documented the direct-to-`main` GitHub workflow and the repository-wide prohibition on pull requests.
- Verified Intent vs Reality against a fresh project graph and documented both remote and local Python runtime modes.
- Documented the clean core dependency audit and the unresolved advisory chain in optional `@tensorflow/tfjs-node`; the unsafe `npm audit fix --force` downgrade is explicitly rejected.

## [0.2.0] - 2026-07-29

### Added

- Canonical `t2c.diff/v1` graph comparison with CLI, MCP, A2A and REST access.
- Dependency-free SVG diff frontend and TypeScript/JavaScript plus Python SDKs.
- Automatic OpenRouter model discovery after an invalid model ID.
- Bounded concurrent documentation extraction and indexed graph diagnostics.
- Myers file/Git diff with SVG, HTML and unified renderers plus an intent-vs-reality view.
- Structured-output fallback now skips timeouts and transport/server failures instead of doubling their latency.
- LLM summaries prioritize documentation and declared evidence before applying the AST payload budget.
- Summary payloads cap AST-heavy evidence, relations and diagnostics while retaining the highest-severity findings.
- Generated JSON artifacts up to 128 MiB can be reopened by CLI/API workflows.
- A2A SDKs for TypeScript, Python, Go, Rust and PHP with Intent DSL types and per-language runnable examples.
- Example backend and frontend repositories used as DSL runtime inputs.
- Measured performance analysis in `docs/OPTIMIZATION.md`.
- 43 automated tests covering protocols, SDKs, security and diff/reality renderers.

### Changed

- Linker precomputes keyword sets per record and reuses the similarity score in relation typing; graph construction dropped from 3480 ms to 1717 ms on a 2561-record run with a byte-identical fingerprint.
- Intent-vs-reality topics are keyed by record target instead of relation components, which stops `shared_path` links from collapsing a repository into a single row.
- Two AST facts are no longer linked on a shared file path alone; such a pair now needs a shared symbol or keyword. On a 2561-record run this removed 96% of `related_to` noise (95 549 relations down to 26 099, `intent.graph.json` from 21.4 MiB to 7.7 MiB) while preserving every `implements`, `evidenced_by`, `same_as`, `duplicates` and `releases` relation and leaving the diagnostic report identical.
- Candidate pairs are carried as tuples instead of `"left|right"` keys, and the keyword index is reused for bucketing. Combined with the earlier scoring changes, graph construction dropped from 3480 ms to 641 ms.

### Fixed

- Docker build context now includes the shared TypeScript SDK source required by the main package export.

## [0.1.0] - 2026-07-29

### Added

- Initial todo2code runtime.
- Canonical t2c Intent Evidence DSL.
- Deterministic NL, Git, TypeScript/Python AST, TODO and CHANGELOG extractors.
- OpenRouter-based documentation extractor and grounded team summarizer.
- Intent graph linker and diagnostics.
- Dual-era MCP stdio server and strict A2A v1.0 server.
- MCP 2026-07-28 stateless discovery/results with legacy initialize compatibility.
- A2A v1-only version negotiation, filtering/pagination, idempotency, task ownership and optional Bearer authentication.
- Docker, Compose, Makefile, 15 automated tests and example repository.
