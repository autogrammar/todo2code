# TODO

## P0 — close the DSL analysis loop (execute in this order)

- [x] Define and document `t2c.conclusion/v1` and
  `t2c.todo-proposal/v1` schemas. Every conclusion and task must cite existing
  diagnostic and intent-record IDs and carry runtime/model generation metadata.
- [x] Implement audited, structured graph + diagnostics → task synthesis through
  LLM. `require-llm` must fail explicitly; any `prefer-llm` degradation may
  expose raw diagnostic actions but must not claim semantic task generation.
- [x] Add runtime validation, stable IDs, deduplication against existing TODO
  records, priority/dependency handling and acceptance-criteria validation for
  generated task proposals.

### P0.4 — reviewable TODO patch and human approval

- [x] Define a versioned `t2c.todo-patch/v1` artifact containing the source TODO
  content hash, graph/diagnostic fingerprints, selected proposal IDs, duplicate
  classifications, runtime/model audit and rendered patch hash.
- [x] Implement a deterministic renderer that takes only `newProposalIds`, uses
  dependency-first order, groups P0–P3 tasks, and includes acceptance criteria,
  targets, dependencies and evidence IDs in reviewable Markdown.
- [x] Write `TODO.patch` and its JSON audit beside the synthesis artifacts.
  Rendering must never modify `TODO.md`.
- [x] Implement an explicit approval/apply operation. It must verify the patch
  hash and unchanged source TODO hash, reject missing/wrong approval, apply
  atomically and preserve a receipt identifying the approving actor and time.
- [x] Test stable rendering, empty/new/duplicate-only results, stale source TODO,
  tampered patch, rejected approval, successful apply and repeated apply.
- [x] Document the complete review flow and recovery behavior in README and DSL
  documentation.

### P0.5 — expose DSL2TODO through every interface

- [ ] Add CLI commands `propose-todo`, `render-todo` and `apply-todo` with
  `prefer-llm|require-llm`, explicit input/output paths and machine-readable
  JSON results.
- [ ] Add matching service actions and expose them through MCP and A2A without
  weakening root-path, authentication, body-size or task-ownership checks.
- [ ] Add TypeScript, Python, Go, Rust and PHP SDK methods and runnable examples
  for propose → review → approved apply.
- [ ] Persist synthesis, validation, patch and approval artifacts in the run
  directory and list them in the versioned manifest/history API.
- [ ] Add end-to-end tests for LLM success, invalid structured output, timeout,
  missing model/configuration, duplicates, dependency cycle, rejected approval,
  stale/tampered patch and successful idempotent apply.
- [ ] Extend `examples:check` so all five SDK examples agree on proposal IDs,
  duplicate classification and patch fingerprint.

### P0.6 — communication analysis in the main runtime

- [ ] Add `project/<ticket>/` and `agent_log` inputs to the main pipeline without
  requiring a separate communication command.
- [ ] Store per-participant analysis, identity ambiguity and communication issue
  IDs as versioned run artifacts with manifest stage audit and failure state.
- [ ] Include participant/request/plan/claim divergence in graph diagnostics,
  grounded task synthesis and Intent-vs-Reality without turning agent claims
  into facts.
- [ ] Expose communication artifacts and filters in run history, comparison API
  and the UI, including participant, role, ticket and issue severity.
- [ ] Make `t2c watch` react to communication changes and coalesce them under the
  existing scan/report rate limits.
- [ ] Add pipeline/history/UI/watcher end-to-end tests for multiple humans,
  multiple agents, unresolved identities, contradictions, unanswered requests,
  work outside intent and claims without Git/AST evidence.

### P0.7 — release the closed loop

- [ ] Re-run `npm run verify`, `npm run examples:check`, Docker smoke tests and
  every SDK example with secrets disabled/redacted.
- [ ] Update README, DSL, requirements, project status, TODO and CHANGELOG with
  measured results and remaining limitations.
- [ ] Prepare the next semantic release only after all P0 acceptance checks pass;
  synchronize `VERSION` and manifests, commit directly to `main`, then create
  and push the matching annotated tag according to `CONTRIBUTION.md`.

## P1 — improve semantic quality and signal

- [ ] Build a versioned gold dataset for NL/docs/Markdown → DSL, linking and
  DSL2TODO. Report precision, recall, citation completeness, deduplication rate
  and stability between repeated runs.
- [ ] Add audited structured LLM enrichment for communication records and a
  grounded per-participant synthesis. Preserve human/agent identity, ticket,
  source lines and epistemic class as runtime-owned fields.
- [ ] Add a participant identity registry mapping stable IDs to Git authors,
  A2A agent IDs and optional human aliases without guessing identity from
  display names.
- [ ] Aggregate low-level AST calls and symbols into module/capability topics
  before coverage metrics and team-summary prioritization, while preserving
  links to the original evidence records.
- [ ] Split large TODO/CHANGELOG LLM enrichment into bounded batches with a
  shared audit and deterministic ordering; verify latency and cost against
  `qwen/qwen3.7-plus` and a faster configured model.
- [ ] Make summary generation structurally validated through
  `t2c.conclusion/v1` before rendering Markdown, rather than accepting free-form
  narrative as the primary result.
- [ ] Add an explicit CLI summary mode
  `deterministic|prefer-llm|require-llm`, consistent with NL and Markdown
  extraction modes.
- [ ] Improve workspace trend metrics so AST line movement and source-identity
  churn do not dominate business-topic coverage changes.
- [ ] Add incremental AST and documentation-chunk caches keyed by content hash
  for very large repositories.
- [ ] Generate TypeScript runtime validators and OpenRouter response schemas
  from one canonical schema source to prevent manual contract drift.

## P2 — modularity and operations

- [ ] Split language adapters from `src/extractors/ast.ts` into independently
  testable TypeScript/JavaScript, Python, Go, Java and Rust modules behind the
  existing common adapter envelope.
- [ ] Add a CI job with JDK 17+ so the Java fixture cannot be skipped in the
  required validation matrix.
- [ ] Add scheduled opt-in live OpenRouter contract checks with redacted audit,
  latency/cost thresholds and no dependency of offline CI on provider uptime.
- [ ] Add A2A streaming/push notifications and a shared transactional
  task-store backend beyond the current atomic filesystem snapshot.
