# Ticket 031: Define repository-scoped evidence identity

- **ID**: ticket-031
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-04

## Goal and scope

Establish a deterministic repository identity for Intent DSL records produced
from multi-repository workspaces. A run scoped to Subactor Core currently sees
AST facts from `core` but cannot safely incorporate the managed architecture
documents stored in the sibling `docs` repository. The resulting
`IMPLEMENTED_NOT_PLANNED`, `IMPLEMENTED_NOT_DOCUMENTED` and `UNLINKED_RECORD`
warnings are therefore incomplete evidence, not proof that implementation or
documentation is absent.

This first slice is deliberately smaller than the complete cross-repository
feature. It adds an optional, canonical repository root at record construction
time so identical paths and symbols in different repositories cannot collapse
to the same content-derived record ID. Existing single-repository callers that
omit the field retain their current IDs and behavior.

## Bounded delivery contract

- Outcome: repository-qualified records have collision-free deterministic IDs
  while legacy single-repository records remain byte-for-byte compatible.
- Workstream: `core-dsl`.
- Complexity: `S`; estimate 25 minutes, hard stop at 30 minutes.
- Implementation budget: at most three files and one core component.
- Planned implementation paths: `src/core/repository-scope.ts`,
  `src/core/record.ts`, `test/target-repository-scope.test.ts`.
- Non-goals: no external filesystem reads, CLI flags, pipeline wiring, linker
  changes, LLM inference, diagnostic suppression or automatic ticket creation.

## Architecture decision

Repository scope is immutable provenance supplied by a trusted extraction
boundary, not inferred from prose. `buildRecord` may receive an optional
canonical relative repository root. When present it is recorded in metadata
and included in the ID seed; when absent, the existing seed is unchanged.
Absolute paths, traversal and ambiguous empty aliases fail closed. This keeps
identity construction in `src/core` and leaves extraction/linking integration
for separately approved dependent slices.

Rollback is a direct revert of the new helper and optional `buildRecord`
input. No persisted schema, public CLI, UI, dependency or runtime service is
changed by this slice.

## Acceptance criteria

- [x] AC-01: Scope is approved by a human owner.
- [x] AC-02: `buildRecord` accepts optional trusted repository provenance,
      stores its canonical value and incorporates it into new record IDs.
- [x] AC-03: Repository roots are relative canonical aliases; absolute paths,
      parent traversal, empty aliases and separator ambiguity are rejected.
- [x] AC-04: Omitting repository provenance preserves every existing record ID
      and metadata contract.
- [x] AC-05: Equal record content and source paths under `core` and `docs`
      produce different, repeatable IDs with attributable provenance.
- [x] AC-06: Focused tests and `npm run verify` pass without changing linker,
      pipeline, CLI or extractor behavior.
- [x] AC-07: Cross-repository warnings remain advisory evidence and are not
      converted into TODO entries or executable tickets.
- [x] AC-08: Follow-up work is explicitly split into external-document scope
      ingestion and repository-aware linker reconciliation; this slice does not
      claim the complete Subactor Core↔Docs capability.

## Current blockers

- The ticket commit is based on a broken `main` snapshot. Its clean overlay on
  the existing aggregate repair `56081b6` reports 342 total tests (341 pass,
  one optional JDK skip, zero failures) and passes Docker smoke. Publication
  waits for the already implemented tickets 023–027 to be integrated, followed
  by a rebase; no additional parser repair is required in ticket 031.
- The complete capability needs later integration slices after this identity
  foundation: one to ingest allowlisted sibling documentation and one to
  reconcile explicit cross-repository symbol/path targets.

## Participants

- Human participant: interactive operator; approval recorded as the 2026-08-04
  `kontynuuj` instruction without creating or modifying a `user-*` file.
- Agent participant: [ai-codex.md](ai-codex.md)
