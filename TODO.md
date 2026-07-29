# TODO

## P0 — close the DSL analysis loop

- [x] Define and document `t2c.conclusion/v1` and
  `t2c.todo-proposal/v1` schemas. Every conclusion and task must cite existing
  diagnostic and intent-record IDs and carry runtime/model generation metadata.
- [x] Implement audited, structured graph + diagnostics → task synthesis through
  LLM. `require-llm` must fail explicitly; any `prefer-llm` degradation may
  expose raw diagnostic actions but must not claim semantic task generation.
- [ ] Add runtime validation, stable IDs, deduplication against existing TODO
  records, priority/dependency handling and acceptance-criteria validation for
  generated task proposals.
- [ ] Render validated proposals as a reviewable `TODO.patch`. Do not modify
  `TODO.md` automatically; require an explicit human approval/apply step.
- [ ] Expose `propose-todo` and `render-todo` through CLI, MCP, A2A and all SDKs,
  with end-to-end tests covering success, invalid LLM output, timeout,
  duplicates and rejected approval.
- [ ] Integrate `agent_log` communication and per-participant analysis into the
  versioned pipeline manifest, run history, comparison UI and watcher. The
  current fast path is the standalone `communication` CLI/MCP/A2A action.

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
