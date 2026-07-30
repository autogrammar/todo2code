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
- [x] Link NL, TODO and documentation declarations to module aggregates through
  normalized capability topics with a precision-oriented three-topic floor.
  On the repository audit this raised AST↔NL from 0 to 10 and AST↔TODO from 1
  to 71 without increasing the 617 AST↔AST relations.
- [x] Distinguish unmeasured documentation coverage from a measured 0% in
  Intent-vs-Reality and workspace trends when no `document` records exist.
- [x] Restrict extracted file paths to recognized extensions so dotted Intent
  DSL fields such as `statement.object` remain symbols rather than false paths.
- [x] Require runtime-owned provenance on every Intent DSL record: converter
  name/version and todo2code version for deterministic generation, plus
  provider/model/response ID for LLM generation and explicit fallback state.
- [ ] Add a deterministic documentation → Intent DSL baseline for headings,
  code blocks and explicit path/symbol references, keeping LLM extraction as
  optional audited enrichment rather than the only source of `document`
  records.
- [x] Extend the gold linking dataset with prose-to-module positive and hard
  negative cases, then publish precision/recall separately for exact-target
  and capability-topic relations.
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
- [ ] Add deterministic converters for repository configuration and
  infrastructure inputs (JSON/YAML/TOML, Docker and CI workflows) so their
  declared behavior is represented in DSL instead of only appearing as AST or
  documentation references.

## P2 — modularity and operations

- [ ] Split language adapters from `src/extractors/ast.ts` into independently
  testable TypeScript/JavaScript, Python, Go, Java and Rust modules behind the
  existing common adapter envelope.
- [ ] Add first-class AST adapters for PHP and other languages present in
  analyzed repositories; until then, report unsupported source files explicitly
  instead of implying complete code-to-DSL coverage.
- [x] Add a CI job with JDK 17+ so the Java fixture cannot be skipped in the
  required validation matrix.
- [x] Add scheduled opt-in live OpenRouter contract checks with redacted audit,
  latency/cost thresholds and no dependency of offline CI on provider uptime.
- [ ] Add A2A streaming/push notifications and a shared transactional
  task-store backend beyond the current atomic filesystem snapshot.
- [ ] Validate public extraction options before they reach `path.resolve`.
  Passing an option object without `sourcePath` currently surfaces as
  `The "paths[1]" argument must be of type string`, which names Node's
  internals instead of the missing field. Found while wiring the live contract
  check against `extractNlIntentAudited`.
- [ ] Guard `.github/workflows/ci.yml` against duplicate top-level keys. Two
  concurrent edits produced a second `schedule:` block, which YAML silently
  resolves to the last one — a workflow can lose a trigger without any error.
  A parse-and-assert step in `make verify` would catch it.
