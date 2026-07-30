# TODO

## P1 — improve semantic quality and signal

- [x] Build a versioned gold dataset for NL/docs/Markdown → DSL, linking and
  DSL2TODO. Report precision, recall, citation completeness, deduplication rate
  and stability between repeated runs.
- [x] Add audited structured LLM enrichment for communication records and a
  grounded per-participant synthesis. Preserve human/agent identity, ticket,
  source lines and epistemic class as runtime-owned fields.
- [x] Add a participant identity registry mapping stable IDs to Git authors,
  A2A agent IDs and optional human aliases without guessing identity from
  display names.
- [x] Aggregate low-level AST calls and symbols into module/capability topics
  before coverage metrics and team-summary prioritization, while preserving
  links to the original evidence records.
- [ ] Split large TODO/CHANGELOG LLM enrichment into bounded batches with a
  shared audit and deterministic ordering; verify latency and cost against
  `qwen/qwen3.7-plus` and a faster configured model.
- [x] Make summary generation structurally validated through
  `t2c.conclusion/v1` before rendering Markdown, rather than accepting free-form
  narrative as the primary result.
- [x] Add an explicit CLI summary mode
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
- [x] Add a CI job with JDK 17+ so the Java fixture cannot be skipped in the
  required validation matrix.
- [ ] Add scheduled opt-in live OpenRouter contract checks with redacted audit,
  latency/cost thresholds and no dependency of offline CI on provider uptime.
- [ ] Add A2A streaming/push notifications and a shared transactional
  task-store backend beyond the current atomic filesystem snapshot.
