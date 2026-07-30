# Changelog

## [Unreleased]

### Added

- Summary generation now materializes and validates grounded
  `t2c.conclusion/v1` objects before deterministic Markdown rendering, with a
  persisted `summary-conclusions.json` artifact and citation-safe fallback.
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

### Fixed

- Stopped treating ticket prefixes such as `T2C` as code symbols and stopped
  action-like inline-code identifiers such as `validateContract` from
  overriding the explicit prose verb. Validation verb forms are recognized
  without misclassifying the noun "validation" as an action.

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
