# TODO

## Active tickets

- [ ] [`ticket-002`](project/ticket-002/README.md) — cross-repository semantic
  benchmark and iterative todo2code quality improvements. Current state:
  `ANALYSIS`.

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
- [x] Read prohibitions and periphrastic obligation as deontic modality. Before
  this, `nie wolno` scored `unknown`, `nie może` scored `optional` because the
  permissive rule matched the `może` inside the ban, and `\bmuszą\b` could never
  match at all: JavaScript's `\b` treats `ą` as a non-word character.
- [x] Fold regular English plurals in `topicKeywords`, guarded against `ss`/`us`/
  `is`/`as`/`os` endings and folding `-ies` to `-y`. On its own this added
  relations without moving coverage, because `aligned` never read the graph;
  the topic-anchor change below is what converted relations into the metric.
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
  documentation references. The shipped ignore policy explicitly re-includes
  `.github/workflows/`, so the advertised CI conversion is exercised in real
  repositories, not only in an isolated fixture.

## P2 — modularity and operations

- [x] Make `project.sh` correct and validate generated README metadata against
  `package.json`; external `code2docs` fallback values (`0.1.0`, MIT and a
  TypeScript runtime badge) can no longer be published silently.
- [x] Isolate `project.sh` generators in a detached tracked-only snapshot,
  reject references to untracked inputs, temporary paths and unavailable
  parser downloads, and make source-changing `prefact -a` explicitly opt-in.
- [x] Formalize the backward-compatible `project/` namespace: root-level
  code2llm/redup output is analysis, while communication requires a recognised
  ticket directory, participant registry or explicit front matter. This keeps
  `project/analysis.toon.yaml` stable without creating `agent_log` noise.
- [x] Run clean-room deterministic pipelines against three external mixed
  repositories (`code2llm`, `domd`, `pactfix`) and fix Python ignore-scope
  overflow plus false-positive `project/` communication discovery.
- [x] Re-run clean-room offline pipelines on three further semcod repos
  (`code2logic`, `code2docs`, `redup`): all `succeeded` with deterministic
  code-change planning; fix configuration `??`/`||` SyntaxError that blocked
  the batch.
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
- [x] Extend the corrective retry to the summary stage, which rejected
  fabricated citations the same way but had no second attempt. Both attempts
  stay in the audit and a second fabrication still fails the run.
- [x] Remove the remaining `make demollm` flakiness without accepting invented
  evidence: derive conclusion `recordIds` only from the cited diagnostics,
  continue to reject unknown `diagnosticIds`, and assign blank response-local
  proposal keys in the runtime. Live contract and full six-stage run
  `20260730T185205Z-312a0535` pass with generator version 2.
- [x] Bound the task-synthesis payload consistently. `compactSynthesisPayload`
  collected record IDs from diagnostics and then truncated records to 500, so a
  large repository could ship a diagnostic citing a record the model never saw.
  Diagnostics whose evidence did not survive the record budget are now dropped
  from the payload instead of inviting a fabricated citation.
- [x] Run a clean-room deterministic pipeline against the external
  `subactor/platform` repository (144 Markdown files, 43 configs, `.mjs`
  sources) and fix what it exposed: an absolute host path aborted code-change
  planning, HTTP routes and hostnames were extracted as repository paths and
  code symbols, and configuration declarations formed a quadratic subgraph.
- [x] Give configuration declarations a file-level aggregate, mirroring
  `module_fact` for AST. `configuration_file_fact` carries a bounded inventory
  of declared keys, but links as file evidence only through an explicit path.
  A capability-topic prototype created 288 cross-source links from five files
  on `code2llm` and was rejected; the hardened run keeps exactly 2 explicit
  path links and 0 `system~system` relations.
- [x] Count configuration as observed reality in Intent-vs-Reality and in
  implementation diagnostics. A `system` record is a fact with lifecycle
  `implemented`, and for infrastructure repositories the implementation can be
  the configuration. Semantic impact must be measured again after the
  capability-topic hardening rather than inferred from the rejected noisy run.
- [ ] Reconsider the `system` lane in the Intent-vs-Reality SVG. The lane was
  added to `LANE_ORDER`, but the eight-lane table is now wide enough that the
  topic column truncates earlier; check whether a combined "evidence" column or
  a wider viewBox reads better.
- [ ] Measure whether counting configuration as evidence hides genuine gaps.
  A documented behaviour whose only evidence is a config key is weaker than one
  backed by AST, yet both now yield `aligned`. Consider grading alignment by
  evidence kind instead of treating all observed records as equal.
- [x] Scope `detectPolarity` so "without / bez + dopełnienie" does not negate
  the governing intent (for example "Document X without inventing files");
  covered by the offline gold set and a focused unit test.
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
- [x] Gold v2 (część): capability hard-negative (2 tematy), partial symbol
  still evidenced; bare basename, multi-clause NL, route/host non-paths,
  ticket exact-target.
- [x] Gold v2 (reszta): `evaluation/gold/v2/dataset.json` z kanałem
  `documentation-deterministic` (prescriptive vs descriptive w ekstrakcji),
  zakresem `diagnostics` (false DONE bez dowodu vs DONE z dowodem, partial
  implementation jednego ticketu) oraz siedmioma pozytywami i pięcioma twardymi
  negatywami `capability-topic` zamiast jednego i dwóch. `npm run evaluate:gold`
  liczy teraz v2; v1 pozostaje pod `evaluate:gold:v1`.
- [ ] Powiększyć próbę `capability-topic` na tyle, by zmiana progu trzech
  tematów dawała mierzalny spadek w obie strony. Siedem pozytywów wykrywa
  regresję progu, ale nie pozwala go stroić.
- [x] Dopasowanie ponad barierą językową, krok pierwszy: słownik dziedzinowy
  PL→EN wraz z polskimi końcówkami na angielskich zapożyczeniach (`ticketu`,
  `foundera`), odfiltrowanie polskich słów funkcyjnych (`nie` 175, `jest` 110 i
  `jako` 54 były jednymi z najczęstszych „tematów" korpusu platformy) oraz
  kotwiczenie deklaracji bez własnego celu w powiązanym module. A/B na tej samej
  treści: `aligned` 25 → 43 i coverage 5,9% → 10,0% na `subactor/platform`,
  74 → 82 i 22,0% → 24,4% tutaj.
- [ ] Dopasowanie niezależne od ręcznego słownika (osadzenia albo tłumaczenie
  tematów). Słownik działa dla słownictwa, które w nim jest, nie dla języka;
  gold v2 mierzy resztę jako `knownGap` 0/1
  (`link-topic-polish-vocabulary-outside-dictionary`). Skalowanie słownika
  ręcznie na każdy język i dziedzinę nie jest planem.
- [ ] Zbadać 69 deklaracji `subactor/platform`, które dotykają kilku modułów i
  dlatego celowo nie dostają kotwicy. Rozstrzygnięcie ich wymaga dowodu
  mocniejszego niż wspólne tematy — bez niego wybór modułu byłby zgadywaniem.
- [ ] Zmierzyć, czy wpisy changelogu powinny uczestniczyć w dopasowaniu
  tematycznym. `isModuleTopicSource` obejmuje `module_fact`, `nl`, `todo` i
  `document`, więc wpis wydania dosięga modułu tylko przez jawny ticket, symbol
  lub ścieżkę — co bezpośrednio podnosi `CHANGELOG_WITHOUT_IMPLEMENTATION`.
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
- [x] Filtrowanie celów planu do konkretnych, użytecznych plików: bez katalogów,
  globów, ścieżek hosta/URI, vendoringu, cache/build, binariów oraz dumpów
  `project/` i artefaktów runu todo2code; SVG, lockfile i zwykła dokumentacja
  pozostają dozwolone. Audyt własnego repo zmniejszył szum z 9 do 3 planów.
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
- [x] Structured source patch `t2c.code-change-source-patch/v1`: instrukcje
  per path, opcjonalny unified diff z walidacją path/sekretów, content-bound
  hash; CLI `propose-source-patch`, MCP/A2A/SDK i zapis w pipeline; propozycja
  sama nigdy nie wykonuje apply.
- [x] Apply source patch po hash approval (`apply-source-patch` / MCP): tylko
  gdy każdy edit ma `unifiedDiff`; instruction-only jest odrzucany; receipt
  idempotentny, ma runtime provenance i weryfikuje stan plików przy powtórzeniu;
  pełny preflight, ochrona symlink/root i rollback chronią przed częściowym
  zapisem. LLM wypełniający diff — nadal opcjonalna przyszła gałąź.
- [x] `detectPolarity` nie traktuje „without / bez + dopełnienie” jako
  negacji całego zdania (gold + unit).
- [x] Orkiestracja acceptance: `t2c close-code-change` (plan lub plan-set +
  before/after graph) → `t2c.code-change-close-result/v1` bez auto-DONE.
- [x] `detectModality` nie traktuje nagłówków „(recommended)” / gołych
  przymiotników jako deontycznych (mniej fałszywych PLANNED_NOT_IMPLEMENTED
  na `code2logic`).

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
