# Ticket 076: Add standalone code2dsl docs2dsl and config2dsl APIs

- **ID**: ticket-076
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-14

## Goal and scope

Expose three small, independently callable source-to-DSL APIs over the existing
extractors:

- `code2dsl` converts supported repository source files through the current
  multi-language AST coordinator;
- `docs2dsl` resolves explicitly supplied files or documentation patterns and
  runs the deterministic documentation converter;
- `config2dsl` converts supported repository configuration and infrastructure
  files.

Every API accepts a repository root plus an explicit `T2CConfig`, can be called
without constructing the full pipeline, and returns the existing
`ExtractionResult` contract. Requiring explicit configuration preserves the
deterministic no-LLM/no-secret-environment import boundary; a standalone
converter must not silently read ambient provider configuration. Before the
result crosses the new API boundary, all emitted records are validated as
`t2c.intent/v1`. The result is intentionally partial: it contains only evidence
owned by that input channel and makes no repository-completeness claim.

`ExtractionResult` remains an adapter envelope; each item in `records` is the
canonical DSL document. The ticket does not invent a second collection schema
or mislabel warnings/cache metadata as semantic DSL content.

The existing `extractAstIntent`, `extractDocumentationBaseline` and
`extractConfigurationIntent` functions remain compatible. Because their
modules are already re-exported by `src/index.ts`, the additive APIs require no
package-manifest, root-export or pipeline change.

The inspected Wellmanifest standards and their exact applicability are recorded
in [STANDARDS.md](STANDARDS.md). They require facade parity with the existing
SSOT, one-way module dependencies, strict canonical-record validation and a
descriptive/no-authority boundary. Experimental or uncommitted standards remain
design inputs only; this ticket does not fabricate a standards lock or claim
formal conformance.

## Acceptance criteria

- [x] AC-01: The human owner approves this bounded API design.
- [x] AC-02: `code2dsl`, `docs2dsl` and `config2dsl` are independently
      callable from the package root with a common `{ root }` entry shape and
      a required explicit `T2CConfig`.
- [x] AC-03: Each API returns only its own channel's records plus warnings (and
      existing AST cache evidence where applicable), without invoking the full
      pipeline, graph, synthesis, LLM or mutation paths.
- [x] AC-04: Every returned record passes the existing strict
      `assertIntentRecords` validator and retains source provenance.
- [x] AC-05: `docs2dsl` accepts explicit resolved files or resolves bounded
      include/exclude patterns, using the configured documentation patterns by
      default.
- [x] AC-06: Existing extractor APIs and pipeline behavior remain unchanged.
- [x] AC-07: For identical explicit inputs and configuration, each facade has
      record, warning and applicable cache parity with its canonical extractor;
      no extraction logic is copied into a facade.
- [x] AC-08: The facades do not import one another, mutate the analyzed
      repository, produce authority/execution artifacts or expose actual `.env`
      secret material.
- [x] AC-09: Focused tests, full Node verification, module-boundary validation,
      governance and Docker smoke
      pass before completion is reported.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

The human owner explicitly approved ticket-076 and requested implementation on
2026-08-14. The ticket is now `IN_PROGRESS / PUBLICATION`. Conversation
approval is an audit note, not trusted merge authorization.

## Verification evidence

- Public-root regression tests prove facade/canonical parity, strict record
  validation, source-channel isolation, bounded documentation discovery and
  rejection of foreign paths.
- The configuration fixture proves `.env.example` remains discoverable while
  actual `.env` content is neither emitted nor leaked.
- `npm run verify` passed, including TypeScript build, the full Node suite,
  transitive no-LLM checks and module-boundary validation (124 modules, 545
  internal imports, no cycles and independent `core`). The existing JDK-only
  Java test remained skipped because the JDK is not installed.
- `./project/governance-check.sh`, `make docker-smoke` and `git diff --check`
  passed on 2026-08-14.
- The implementation is ready for protected exact-head review and remains
  `IN_PROGRESS / PUBLICATION` until that external delivery boundary completes.

## Non-goals

- No separate npm packages, repository split or runtime dependency.
- No new DSL schema or envelope; the canonical record schema remains
  `t2c.intent/v1`.
- No claim of formal conformance with experimental standards and no dependency
  on their local working-tree paths.
- No `dsl-manifest.json`, modularity workspace or standards lock; those belong
  to a separately approved integration ticket with immutable revisions and
  artifact digests.
- No CLI, MCP, A2A, pipeline, graph, synthesis or LLM behavior change.
- No claim that a single source channel represents the complete repository.
- No removal or signature change of existing extractor functions.
