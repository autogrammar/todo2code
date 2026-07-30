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
- [x] Add a deterministic documentation → Intent DSL baseline for headings,
  code blocks and explicit path/symbol references, keeping LLM extraction as
  optional audited enrichment rather than the only source of `document`
  records.
- [x] Extend the gold linking dataset with prose-to-module positive and hard
  negative cases, then publish precision/recall separately for exact-target
  and capability-topic relations.
- [x] Split large TODO/CHANGELOG LLM enrichment into bounded 32-record batches
  with a shared audit, per-record response provenance and deterministic
  ordering.
- [ ] Measure live TODO/CHANGELOG batch latency and cost against
  `qwen/qwen3.7-plus` and a faster configured model; store the redacted
  comparison artifact without making offline CI provider-dependent.
- [x] Make summary generation structurally validated through
  `t2c.conclusion/v1` before rendering Markdown, rather than accepting free-form
  narrative as the primary result.
- [x] Add an explicit CLI summary mode
  `deterministic|prefer-llm|require-llm`, consistent with NL and Markdown
  extraction modes.
- [x] Improve workspace trend metrics so AST line movement and source-identity
  churn do not dominate business-topic coverage changes.
- [ ] Add incremental AST and documentation-chunk caches keyed by content hash
  for very large repositories.
- [x] Resolve unambiguous bare source filenames such as `markdown.ts` against
  the repository tree before linking, while preserving the current rejection
  of prose fragments and refusing ambiguous basename matches. The linker indexes
  basenames owned by exactly one full path; `validation.ts`, `types.ts` and
  `git.ts` name several files here and keep requiring a directory.
- [x] Treat documentation as a plan only when it is prescriptive. Descriptive
  prose used to raise `PLANNED_NOT_IMPLEMENTED`: once the deterministic
  converter emitted `document` records the count went to 579, of which 574 came
  from documentation and 555 had `modality: unknown`. Scoping the rule to
  `required`/`recommended` brought it back to 22.
- [ ] Generate TypeScript runtime validators and OpenRouter response schemas
  from one canonical schema source to prevent manual contract drift.
- [x] Add deterministic converters for repository configuration and
  infrastructure inputs (JSON/YAML/TOML, Docker and CI workflows) so their
  declared behavior is represented in DSL instead of only appearing as AST or
  documentation references.

## P2 — modularity and operations

- [x] Run clean-room deterministic pipelines against three external mixed
  repositories (`code2llm`, `domd`, `pactfix`) and fix Python ignore-scope
  overflow plus false-positive `project/` communication discovery.
- [x] Split language adapters from `src/extractors/ast.ts` into independently
  testable TypeScript/JavaScript, Python, Go, Java and Rust modules behind the
  existing common adapter envelope.
- [ ] Add first-class AST adapters for PHP and other languages present in
  analyzed repositories.
- [x] Report discovered unsupported PHP/Ruby/C#/Kotlin/C/C++ and other source
  files explicitly instead of implying complete code-to-DSL coverage.
- [x] Add a CI job with JDK 17+ so the Java fixture cannot be skipped in the
  required validation matrix.
- [x] Add scheduled opt-in live OpenRouter contract checks with redacted audit,
  latency/cost thresholds and no dependency of offline CI on provider uptime.
- [x] Make `make demollm` execute and verify all six semantic LLM stages
  end-to-end, with no deterministic fallback and a manifest-based PASS gate.
- [x] Give task synthesis one corrective retry when the runtime rejects a
  fabricated citation. Measured before the change: 1 of 6 `make demollm` runs
  completed, with `LLM_RESPONSE_INVALID` sinking three of them on well-formed
  but non-existent record IDs. The retry quotes the validation error back and
  keeps both attempts in the audit; a second fabrication still fails the run.
- [ ] Extend the corrective retry to the summary stage, which rejects
  fabricated citations the same way but has no second attempt.
- [ ] Bound the task-synthesis payload consistently: `compactSynthesisPayload`
  collects record IDs from diagnostics and then truncates records to 500, so a
  large repository can ship a diagnostic citing a record the model cannot see.
  Not reproduced on `examples/` (49 of 49 records included), but the ordering
  invites exactly the fabrication the retry now absorbs.
- [ ] Add A2A streaming/push notifications and a shared transactional
  task-store backend beyond the current atomic filesystem snapshot.
- [x] Validate public extraction options before they reach `path.resolve`.
  Missing `root`, `sourcePath` or `text` now produces a named option error at
  the public deterministic and audited NL boundaries.
- [x] Guard `.github/workflows/ci.yml` against duplicate top-level keys. Two
  concurrent edits produced a second `schedule:` block, which YAML silently
  resolves to the last one — `verify:workflows` now rejects that state before
  a workflow can silently lose a trigger.

## P3 — NL → DSL → sourcecode (plan wdrożenia)

Cel: domknąć pętlę od intencji w języku naturalnym, przez Intent Evidence DSL,
do planowanej zmiany kodu i weryfikacji po re-analizie. System pozostaje
guardem intencji: LLM może proponować, runtime waliduje, człowiek zatwierdza.

### Faza 1 — wiarygodna analiza (fundament)

- [x] Linker: bare basename pliku tylko gdy unikalny w repo (`markdown.ts`);
  niejednoznaczne nazwy (`validation.ts`, `types.ts`) wymagają katalogu.
- [x] Diagnostyka: dokumentacja jest planem tylko przy modality
  `required`/`recommended`; opisowe prose nie podnosi
  `PLANNED_NOT_IMPLEMENTED`.
- [ ] Gold v2: docs prescriptive vs descriptive, partial implement /
  false DONE; więcej hard negatives capability-topic.
- [x] Gold v1+: bare basename unique/ambiguous, multi-clause NL z ticketem,
  NL bez fałszywych path z HTTP/host, ticket exact-target linking.
- [x] Wzmocnić NL→target: odrzucanie absolutnych/HTTP/traversal path i
  hostnames; ticket binding w gold exact-target.
- [ ] Dalsze NL→target: resolution symboli względem AST, actionable
  `missingFields` / `AMBIGUOUS_REQUIREMENT`.
- [ ] Jeden source schematów → TS validators + OpenRouter response schemas
  (patrz też P1).
- [ ] Live latency/cost batch TODO/CHANGELOG (patrz P1).

### Faza 2 — kompletne reality

- [ ] Incremental AST + documentation-chunk cache po content hash (patrz P1).
- [ ] First-class AST adapters dla PHP i innych języków w analizowanych repo
  (patrz P2).
- [ ] Opcjonalnie: testy/CI facts jako evidence `implemented` obok AST+Git.

### Faza 3 — DSL → plan zmiany kodu (wdrożenie bieżące)

- [x] Kontrakt `t2c.code-change-plan/v1`: paths/symbols, evidence
  (recordIds/diagnosticIds/conclusionIds/proposalIds), acceptance criteria,
  risk, rollback, status `proposed`, content-bound ID/hash i runtime provenance.
- [x] Deterministyczne budowanie planów z `PLANNED_NOT_IMPLEMENTED` /
  `CHANGELOG_WITHOUT_IMPLEMENTATION` i powiązanych propozycji TODO
  (bez auto-apply, bez udawania codegen).
- [x] Kontrakt `t2c.code-change-acceptance/v1`: re-diagnose po zmianie,
  cleared vs remaining diagnostics, fail gdy pojawią się nowe blocking.
- [x] CLI/MCP/A2A: `propose_code_change` / `evaluate_code_change` na grafie
  before/after; SDK TypeScript convenience methods.
- [x] Pipeline zapisuje `code-change-plans.json` w każdym udanym runie
  (etap deterministyczny `codeChangePlanning` w manifeście).
- [x] Deterministyczny review brief `CODE_CHANGE.review.md` + audit
  `t2c.code-change-review/v1` (hash-bound, bez apply źródeł); CLI
  `render-code-change`, MCP/A2A/SDK i zapis w pipeline.
- [x] NL/target hardening: odrzucanie HTTP routes, host paths, `..` oraz
  hostnames jako fałszywych symboli (gold + unit).
- [ ] Structured source patch/diff z LLM: tylko dozwolone paths, cytowania,
  brak tajemnic; apply tylko po hash approval (jak TODO.patch).
- [ ] Pełna orkiestracja pętli implement → re-extract → re-diagnose →
  acceptance w jednym poleceniu (dziś kroki są osobne, ale udokumentowane).

### Faza 4 — ops / multi-agent

- [ ] A2A streaming/push + transakcyjny task-store (patrz P2).
- [ ] Branch protection / work permits jako warstwa integracyjna repo/CI
  (poza core runtime).

### Definition of done (ścieżka end-to-end)

1. NL/ticket → Intent DSL z provenance.
2. Multi-source graph + diagnostyka Intent vs Reality.
3. Code-change plan ugruntowany w diagnostyce (nie free-form).
4. Po zmianie kodu re-analiza zamyka targeted diagnostics bez nowych blocking.
5. Brak auto-DONE: człowiek lub uprawniony klient zatwierdza.
