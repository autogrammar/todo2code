# TODO

## Active tickets

- [ ] [`ticket-054`](project/ticket-054/README.md) — restore skills-agent
  discovery, prove a todo2code → Repair PR → independent Validator hand-off,
  then add three bounded todo2code-grounded skills. Current state:
  `IN_PROGRESS / PUBLICATION`; executable changes remain in target repositories.

## Backlog tickets

- [ ] [`ticket-073`](project/ticket-073/README.md) — define a canonical
  analysis-policy DSL for deterministic selection of detailed LLM stages,
  bounded evidence and request/token ceilings without semantic fallback.
  Current state: `PLAN / WAIT_FOR_APPROVAL`.
- [ ] [`ticket-058`](project/ticket-058/README.md) — synchronize release,
  runtime, SDK and generated-provenance version identity and add a deterministic
  drift gate. Plan and owner-ticket creation are approved; current state:
  `BLOCKED / WAIT_FOR_DEPENDENCIES` while ticket-054 reserves `integration`.
- [ ] [`ticket-051`](project/ticket-051/README.md) — wire
  `scripts/github-event-log.mjs` into CI with explicit flags only. Current
  state: `PLAN / WAIT_FOR_APPROVAL`; ticket-048 is now merged.
- [ ] [`ticket-052`](project/ticket-052/README.md) — promote the Validator
  autonomy operator checklist into agent-facing governance (`AGENTS.md`).
  Current state: `PLAN / WAIT_FOR_APPROVAL`.

## Completed tickets
- [x] [`ticket-072`](project/ticket-072/README.md) — redacts credentials,
  contextual credential identifiers and provider management URLs once at the
  OpenRouter boundary while preserving actionable diagnostics and fail-closed
  `require-llm`. Koru, independent GLM-5.2 review and protected checks passed;
  PR #84 merged as `main@790b867`. Current state: `DONE / DONE`.
- [x] [`ticket-062`](project/ticket-062/README.md) — adopted immutable
  new-project v0.14.0 at exact SHA `a22eb47`, preserved all eight target
  workstreams, assigned `test/python-runtime.test.ts` to `sdk`, aligned the
  reusable workflow caller and passed protected PR #77. Current state:
  `DONE / DONE`; merge `main@a762580`.
- [x] [`ticket-055`](project/ticket-055/README.md) — identifies OpenRouter
  usage with explicit `OPENROUTER_APP_NAME`, falling back to the analysed
  project's folder name. Koru, Validator App and protected checks approved
  exact head `7aae643`; PR #74 merged as `main@d0659ca`. Current state: `DONE`.
- [x] [`ticket-056`](project/ticket-056/README.md) — restored both Docker E2E
  profiles by supplying `make` and respecting the unlocked Rust library
  contract. Koru, Validator App and protected checks approved exact head
  `1752f3d`; PR #72 merged as `main@5f8e831`. Current state: `DONE`.
- [x] [`ticket-050`](project/ticket-050/README.md) — adopted immutable
  new-project v0.13.2, assigned `CHANGELOG.md` and `.env.example` to the
  governance workstream, and made governance checks recoverable while retaining
  fail-closed exact-head approval. Koru, Validator and protected checks passed;
  PR #70 merged as `main@f60d3cc`. Current state: `DONE`.
- [x] [`ticket-049`](project/ticket-049/README.md) — Validator autonomy audit,
  operator guide and refactor plan accepted by the user on 2026-08-08. Sibling
  tickets 050–052 retain independent approval and ownership gates. Current
  state: `DONE`. See
  [AUTONOMY_AND_REFACTOR_PLAN.md](project/ticket-049/AUTONOMY_AND_REFACTOR_PLAN.md).
- [x] [`ticket-053`](project/ticket-053/README.md) — documents the existing
  CI-form governance check as a blocking pre-push gate. Koru and Validator
  approved exact head `079de29`; protected PR #67 merged as `main@100a7d2`
  and its implementation branch was deleted. Current state: `DONE`.
- [x] [`ticket-048`](project/ticket-048/README.md) — republished ticket-047's
  GitHub acquisition adapter with explicit-only inputs and no ambient
  `process.env` fallback. Validator approval and all protected checks passed on
  exact head `92f99dc`; PR #66 merged as `main@f1b3d5d`. Current state: `DONE`
  for publication purposes; the ticket-local historical status remains part of
  the merged audit record.
- [x] [`ticket-047`](project/ticket-047/README.md) — built the first GitHub
  acquisition adapter for the `t2c.event-log/v1` codec, mapping one bounded
  `push`, `pull_request`, `pull_request_review` or completed `workflow_run`
  payload onto the closed event vocabulary. Host, governance, Docker and
  focused checks passed locally, but the work never reached protected `main`:
  it carries no Koru or Validator approval, and its squashed commits are
  rejected by CI governance. Republication is tracked as ticket-048. Current
  state: `DONE`.
- [x] [`ticket-046`](project/ticket-046/README.md) — generates a canonical,
  atomic `logs.dsl.txt` beside every succeeded, degraded and failed pipeline
  manifest. Koru and Validator approved exact head `1180e45` with
  `openrouter/z-ai/glm-5.2`; protected PR #62 merged as `main@c1decdb` and its
  implementation branch was deleted. Current state: `DONE`.
- [x] [`ticket-045`](project/ticket-045/README.md) — defined the canonical,
  tamper-evident `t2c.event-log/v1` contract and validated its 17-event
  `logs.dsl.txt` fixture. Koru and Validator approved exact head `46210e1`
  with `openrouter/z-ai/glm-5.2`; protected PR #60 merged as `main@a66eb40`
  and its implementation branch was deleted. Current state: `DONE`.
- [x] [`ticket-044`](project/ticket-044/README.md) — adopted immutable
  new-project 0.11.0 and its canonical work-classification package through
  local Goal. Koru and Validator approved exact head `80f860c` with
  `openrouter/z-ai/glm-5.2`; protected PR #58 merged as `main@aae9ec5` and its
  implementation branch was deleted. Current state: `DONE`.
- [x] [`ticket-043`](project/ticket-043/README.md) — exposed ticket-040's
  deterministic read-only observer through `make preflight`, with canonical
  stdout, stable exit codes and complete Git-state non-mutation tests. Koru and
  Validator approved exact head `87ce55c` with `openrouter/z-ai/glm-5.2`;
  protected PR #56 merged as `main@4a7445a`. Current state: `DONE`.
- [x] [`ticket-042`](project/ticket-042/README.md) — bounded the aggregate
  semantic deadline of `compare-workspace` across both pipelines and all
  document chunks with 2x scaling and a 40-minute ceiling. Koru and Validator
  approved exact head `5b51880` with `openrouter/z-ai/glm-5.2`; protected PR
  #52 merged as `main@2c16449`. Current state: `DONE`.
- [x] [`ticket-040`](project/ticket-040/README.md) — bounded, read-only
  workspace preflight binding exact local Git state, managed governance and the
  active ticket before governed edits. Ten focused tests plus host, Docker,
  governance and complexity gates passed; Koru and Validator approved exact
  head `567424b` with `openrouter/z-ai/glm-5.2`; protected PR #49 merged as
  `main@008bee5`. Current state: `DONE`.
- [x] [`ticket-041`](project/ticket-041/README.md) — strict immutable Git
  materialization validation and exact-tree graph/truth-map evidence assembly
  into the existing `t2c.branch/v1` projector. Focused, host, Docker,
  governance and complexity gates passed; Koru and Validator approved exact
  head `3779613` with `openrouter/z-ai/glm-5.2`; protected PR #48 merged as
  `main@f188025`. Current state: `DONE`.
- [x] [`ticket-021`](project/ticket-021/README.md) — assigned root-level
  generated analysis formats to the integration workstream without changing
  ticket-directory ownership or the managed wrapper. Koru and Validator
  approved exact head `9e2feff` with `openrouter/z-ai/glm-5.2`; PR #33 merged
  as `main@8ebeb66`. Current state: `DONE`.
- [x] [`ticket-039`](project/ticket-039/README.md) — bounded, read-only local
  Git materializer for exact branch/tree/merge-base/ahead-behind, stable patch
  identity and textual collision evidence. Focused, full host/Docker,
  governance, complexity and live branch checks passed; Koru and Validator
  approved exact head `29df450` with `openrouter/z-ai/glm-5.2`; PR #44 merged
  as `main@2948f4a`. Current state: `DONE`.
- [x] [`ticket-037`](project/ticket-037/README.md) — deterministic,
  fail-closed `t2c.branch/v1` projection over immutable branch evidence.
  Fourteen focused tests, full host/Docker verification, Koru and Validator
  approved exact head `50d6dba` with `openrouter/z-ai/glm-5.2`; PR #42 merged
  as `main@b5d2417`. Current state: `DONE`.
- [x] [`ticket-038`](project/ticket-038/README.md) — reconciled ticket-036's
  stale pending-review narrative with protected completion evidence. Koru and
  Validator approved exact head `670894d` using
  `openrouter/z-ai/glm-5.2`; PR #40 merged as `main@ed35d3f`. Current state:
  `DONE`.
- [x] [`ticket-036`](project/ticket-036/README.md) — deterministic,
  provenance-preserving `t2c.truth-map/v1` core projection. Koru and Validator
  approved exact head `65b4bc1` with `openrouter/z-ai/glm-5.2`; PR #35 merged
  as `main@15d2b26`. Current state: `DONE`.
- [x] [`ticket-034`](project/ticket-034/README.md) — scales each OpenRouter
  request timeout from bounded input, output and structural-complexity pressure,
  retaining the configured default at baseline and increasing by `2x` steps up
  to `8x` and 600 seconds. Exact-head Validator approval used
  `openrouter/z-ai/glm-5.2`; implementation merged in PR #31 as
  `main@6116961`. Current state: `DONE`.
- [x] [`ticket-019`](project/ticket-019/README.md) — published the
  dependency-free Python SDK from one root `pyproject.toml`, passed package,
  application, SDK, Docker and protected exact-head validation, and merged PR
  #28 as `main@e333ace`. Current state: `DONE`.
- [x] [`ticket-035`](project/ticket-035/README.md) — declared the five atomic
  Python publication paths as integration-owned shared contracts, preserved the
  immutable standard provenance and passed exact-head Validator review plus all
  protected checks. Implementation merged as `main@a2441f8`; current state:
  `DONE`.
- [x] [`ticket-020`](project/ticket-020/README.md) — role-bound trusted intake
  with persistent manager/user/dev assignments, CQRS/event sourcing, strict
  schemas, dependency-free Protobuf codecs and Python/TypeScript CLI, MCP and
  A2A parity. Implementation commit `06a2faa` is contained in protected main;
  current focused validation passes 9/9, full verification has 0 failures and
  policy 0.10.0 governance passes.
- [x] [`ticket-018`](project/ticket-018/README.md) — adopted hardened
  `wellmanifest/new-project` 0.10.0 at immutable merge `9706e63`, moved trusted
  App authority outside PR control, switched Koru to `z-ai/glm-5.2`, passed
  exact-head App review and protected checks, and merged as `main@6ad85bd`.
- [x] [`ticket-017`](project/ticket-017/README.md) — repaired mutating command
  help, Polish prohibition polarity and repository-bound path resolution;
  independently audited the concurrent path/action-planning baseline and added
  isolated Docker E2E `core` and full-toolchain gates. Current state: `DONE`.
- [x] [`ticket-009`](project/ticket-009/README.md) — canonical structured
  response contracts. All seven production OpenRouter boundaries now generate
  their provider schema and runtime parser from one typed source, retain
  rejected-response metadata and fail closed without semantic coercion.
  Published as `d0fc143`; current state: `DONE`.
- [x] [`ticket-008`](project/ticket-008/README.md) — upstream governance
  hardening. `wellmanifest/new-project` 0.6.0 now uses role-typed participant
  templates, explicit unresolved ownership, active-ticket reuse and a separate
  `project/TICKETS.md` index that cannot overwrite generated analysis. Current
  state: `DONE`.
- [x] [`ticket-007`](project/ticket-007/README.md) — explicit unresolved
  response routing. Every communication issue now names a known participant or
  the role sentinel `unresolved:human` / `unresolved:agent`; no participant is
  guessed or created. Current state: `DONE`.
- [x] [`ticket-006`](project/ticket-006/README.md) — canonical structured-output
  conformance. Retained exact fail-closed diagnostics and a schema drift gate;
  rejected both tested Qwen routes before graph mutation. Current state:
  `DONE`.
- [x] [`ticket-005`](project/ticket-005/README.md) — audited communication and
  cross-language reranking. Retained section-aware `user-*`/`ai-*` Intent DSL
  plus explicit response ownership; rejected the live semantic candidate after
  three fail-closed provider contract violations and zero demonstrated coverage
  improvement. Current state: `DONE`.
- [x] [`ticket-004`](project/ticket-004/README.md) — language-independent topic
  matching benchmark. Rejected unsafe raw embeddings and added a separately
  reported 6-positive/6-negative cross-language gold cohort. Current state:
  `DONE`.
- [x] [`ticket-003`](project/ticket-003/README.md) — deterministic audit of
  residual changelog diagnostics and one evidence-gated correction. Removed
  547 false review findings with stable graphs. Current state: `DONE`.
- [x] [`ticket-002`](project/ticket-002/README.md) — cross-repository semantic
  benchmark and iterative todo2code quality improvements. Current state:
  `DONE`.

## P1 — improve semantic quality and signal

- [x] Build a versioned gold dataset for NL/docs/Markdown → DSL, linking and
  DSL2TODO. Report precision, recall, citation completeness, deduplication rate
  and stability between repeated runs.
- [x] Add audited structured LLM enrichment for communication records and a
  grounded per-participant synthesis. Preserve human/agent identity, ticket,
  source lines and epistemic class as runtime-owned fields.
- [x] Convert governance `user-*` and `ai-*` sections to typed Intent DSL
  without ingesting ticket evidence/logs, reject unstructured migration
  silently losing content, and attach the required role plus participant IDs
  to every communication divergence.
- [x] Route a required response when the required role has no participant
  record. Ticket-006 correctly returns `responseRequiredRole=human` but an
  empty `responseRequiredFrom` because the agent refused to fabricate a
  human-owned `user-*` file. Ticket-007 now emits the explicit role sentinel
  `unresolved:human` or `unresolved:agent`, never a guessed identity.
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
- [x] Measure the complete live pipeline against explicit structured-output
  models. Qwen failed documentation/communication after correction, GPT-5.4
  Mini failed NL after correction, and Gemini 3.6 Flash passed all six stages
  in 125.486 s for $0.412363. The redacted comparison is in ticket-012 and the
  opt-in live history; offline CI remains provider-independent.
- [x] Make summary generation structurally validated through
  `t2c.conclusion/v1` before rendering Markdown, rather than accepting free-form
  narrative as the primary result.
- [x] Add an explicit CLI summary mode
  `deterministic|prefer-llm|require-llm`, consistent with NL and Markdown
  extraction modes.
- [x] Improve workspace trend metrics so AST line movement and source-identity
  churn do not dominate business-topic coverage changes.
- [x] Add incremental AST and documentation-chunk caches keyed by content hash
  for very large repositories. TypeScript is cached per file, external adapters
  per language manifest and Markdown per chunking input; corrupt cache fails
  open and provider responses are deliberately never cached.
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
- [x] Generate TypeScript runtime validators and OpenRouter response schemas
  from one canonical schema source to prevent manual contract drift.
- [x] Add deterministic converters for repository configuration and
  infrastructure inputs (JSON/YAML/TOML, Docker and CI workflows) so their
  declared behavior is represented in DSL instead of only appearing as AST or
  documentation references. The shipped ignore policy explicitly re-includes
  `.github/workflows/`, so the advertised CI conversion is exercised in real
  repositories, not only in an isolated fixture.

## P2 — modularity and operations

- [x] Split the task-synthesis god module into provider orchestration,
  structured-response contract, grounded materialization and bounded payload
  selection without changing its public API or fail-closed behavior.
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
- [x] Add a first-class dependency-free PHP syntax adapter. It uses
  `token_get_all(..., TOKEN_PARSE)`, preserves the shared fact envelope and
  fails open when PHP is absent; A/B on `redsl` converted 40 tracked files into
  2,127 unique records and removed 18 warning diagnostics.
- [ ] Add first-class syntax adapters for other languages present in analyzed
  repositories.
- [x] Report discovered unsupported PHP/Ruby/C#/Kotlin/C/C++ and other source
  files explicitly instead of implying complete code-to-DSL coverage.
- [x] Add a CI job with JDK 17+ so the Java fixture cannot be skipped in the
  required validation matrix.
- [x] Add scheduled opt-in live OpenRouter contract checks with redacted audit,
  latency/cost thresholds and no dependency of offline CI on provider uptime.
- [x] Extend the scheduled live check from two stages to all six, with per-stage
  and per-run budgets and a recorded result history. It now measures the
  manifest of a `require-llm` pipeline run instead of calling selected stages
  itself, which is how it drifted to two: a bespoke caller cannot go out of date
  against a pipeline it does not run. History is reported and never gates —
  `t2c.live-contract-check/v2`, 50 runs, restored from CI cache and published as
  an artifact.
- [ ] Collect enough scheduled live runs for the recorded median latency and
  cost per stage to describe anything. The contract and storage exist; the
  trend does not yet.
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
  continue to reject unknown `diagnosticIds`. The historical runtime assigned
  blank response-local proposal keys; ticket-009 now rejects them and relies on
  the corrective retry because inventing a key changes provider intent. Live
  contract and full six-stage run `20260730T185205Z-312a0535` passed with
  generator version 2 before that hardening.
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
- [x] Measure whether counting configuration as evidence hides genuine gaps, and
  grade alignment by evidence kind. Measured on tracked `HEAD`: 16 of 46 aligned
  topics on `subactor/platform` rest on configuration alone against 4 of 89 here,
  so an undifferentiated headline reads the same for a repository whose evidence
  is a third weaker. `RealityRow.evidence` and `totals.alignedByEvidence` now
  report the split; neither changes what counts as `aligned`, because a
  behaviour whose implementation *is* configuration is implemented.
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
  implementation jednego ticketu), ośmioma pozytywami `capability-topic`,
  czternastoma parami zabronionymi oraz osobnym kohortem cross-language
  (6 oczekiwanych, 6 zabronionych). `npm run evaluate:gold` liczy teraz v2; v1
  pozostaje pod `evaluate:gold:v1`.
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
- [ ] Dopasowanie niezależne od ręcznego słownika. Gold v2 mierzy obecnie 0/6
  oczekiwanych relacji PL/DE/ES/FR i 0/6 naruszeń par zabronionych. Ticket-004
  odrzucił surowy próg embeddingów: E5 uszeregował 6/6 par syntetycznych, ale
  zaproponował dwa błędne nowe linki na `subactor/platform`; wzajemny top-1
  usunął błędy kosztem zerowego wzrostu pokrycia. Ticket-005 dodał osobno
  mierzone, ugruntowane kontrakty rerankera i osiągnął 6/6 na przejrzanych
  fixture'ach, lecz trzy rzeczywiste odpowiedzi Qwen/OpenRouter złamały
  wymagany kształt lub typ danych. Żadna relacja nie powstała, a eksperyment
  nie został wyeksportowany produkcyjnie. Następny kandydat musi najpierw
  dowieść stabilności provider/schema na śledzonym repozytorium, a dopiero
  potem wzrostu pokrycia.
- [ ] Zbadać 69 deklaracji `subactor/platform`, które dotykają kilku modułów i
  dlatego celowo nie dostają kotwicy. Rozstrzygnięcie ich wymaga dowodu
  mocniejszego niż wspólne tematy — bez niego wybór modułu byłby zgadywaniem.
- [x] Zmierzone i odrzucone: wpisy changelogu **nie** powinny trafić do
  `isModuleTopicSource`. Na `subactor/platform` ze 111 diagnostyk
  `CHANGELOG_WITHOUT_IMPLEMENTATION` dopasowanie tematyczne sięgnęłoby dokładnie
  jednego modułu w 8 przypadkach (7%) przy 15 niejednoznacznych; w tym repo ze
  121 diagnostyk — 7 (6%) przy **105 niejednoznacznych (87%)**. Wpis wydania
  opisuje zwykle zmianę w kilku modułach naraz, więc dopuszczenie go do
  dopasowania tematycznego kupiłoby kilka procent mniej diagnostyk za setkę
  arbitralnych relacji.
- [ ] Rozważyć węższy wariant tego samego: pozwolić kotwicy z
  Intent-vs-Reality (`indexModuleAnchors`) objąć wpis changelogu, gdy trafia
  w dokładnie jeden moduł. To 8 i 7 przypadków wyżej, bez wpuszczania
  niejednoznacznych do grafu — ale zmienia znaczenie
  `CHANGELOG_WITHOUT_IMPLEMENTATION`, więc wymaga decyzji, nie samego pomiaru.
- [x] Wzmocnić NL→target: odrzucanie absolutnych/HTTP/traversal path i
  hostnames; ticket binding w gold exact-target.
- [x] Dalsze NL→target: resolution symboli względem AST bez zgadywania
  między modułami; `missingFields` / `AMBIGUOUS_REQUIREMENT` wskazują
  konkretne pole i kandydujące ścieżki (ticket-011).
- [x] Jeden source schematów → TS validators + OpenRouter response schemas
  (patrz też P1).
- [x] Live latency/cost batch TODO/CHANGELOG: ticket-013 porównał trzy modele,
  wybrał Codestral 2508 i dodał współbieżność 3; `weekly` 218,741→53,362 ms,
  a `nlp2uri` przeszedł 619 rekordów / 20 żądań w 194,750 ms.
- [ ] Rozstrzygnąć jakość, nie tylko koszt, przy wyborze modelu dla batcha
  TODO/CHANGELOG. `npm run live:models` na 267 rekordach tego repo pokazał, że
  `mistralai/codestral-2508` i `google/gemini-3-flash-preview` zgadzają się co
  do action/modality/polarity/lifecycle tylko w **169 z 267 rekordów (63,3%)** —
  tańszy model nie odpowiada tak samo, a porównanie nie mówi, który ma rację.
  Potrzebne są przypadki gold nad polami wzbogacenia, nie kolejny przebieg live.
- [x] [`ticket-014`](project/ticket-014/README.md) — nie uznawać nowej
  możliwości za zaimplementowaną wyłącznie dlatego, że wskazany plik istnieje;
  wymagany dodatkowy dowód symbolu/tematu albo jawna abstencja. Gold ma parę
  negatyw/pozytyw, a Koru PLF-003 przeszedł wykrycie, patch, pytest i re-analizę.
- [x] [`ticket-015`](project/ticket-015/README.md) — zachować złożoną intencję
  `implement ... and verify ...` w tytule code-change; klasyfikacja czasownika
  pomocniczego nie może tworzyć `Implement Implement ... and it ...`.

### Faza 2 — kompletne reality

- [x] Incremental AST + documentation-chunk cache po content hash (patrz P1).
- [x] First-class PHP syntax adapter (patrz P2 i ticket-016).
- [ ] First-class adapters dla pozostałych języków w analizowanych repo.
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
