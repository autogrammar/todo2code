# Ticket 030: Repair confidence hierarchy test after extractor refactor

- **ID**: ticket-030
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-04

## Goal and scope

Repair the confidence-hierarchy regression test that failed after the Markdown
and NL confidence clamping logic moved from the orchestration modules into
focused helper modules. The production ceilings remain correct (`0.94`,
`0.90`, `0.85`); the failure is a test-discovery defect, not evidence that an
Intent record contains `confidence: null`.

The implementation is deliberately test-only. It will update the hierarchy
test so it verifies the canonical current locations without changing any
extractor behavior, confidence value, documentation contract or LLM boundary.
No unrelated refactor or generated artifact belongs to this ticket.

## Planned changed paths

- `test/nl-llm.test.ts`: replace the stale source-file assumptions with a
  deterministic check of the current confidence-clamping implementations.
- `project/ticket-030/**`, `TODO.md`, `project/TICKETS.md`: ticket intent and
  verification evidence only.

## Acceptance criteria

- [x] AC-01: Scope is approved by a human owner.
- [x] AC-02: The test distinguishes a missing source-code match from a runtime
      confidence value and no longer reports the former as extractor failure.
- [x] AC-03: The hierarchy remains Markdown `0.94` > NL `0.90` > documentation
      `0.85`, with all three ceilings below deterministic observation levels.
- [x] AC-04: Focused NL/Markdown/document tests pass without a live provider,
      changing production code or accepting a looser confidence ceiling.
- [x] AC-05: The ticket diff contains only its allowed test and governance
      paths; unrelated dirty/generated files remain untouched.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- Current state: `IN_PROGRESS / VALIDATION`.
- Required response from: `unresolved:human`.
- Chat approval authorizes implementation in this interactive session but is
  not trusted merge evidence.
- The ticket was renumbered from the locally drafted `ticket-023` to
  `ticket-030` before publication because remote PR #3 already owns 023. The
  approved implementation scope and code delta did not change.

## Validation evidence

- The freshly emitted `dist/test/nl-llm.test.js` passes `11/11`; the repaired
  hierarchy assertion passes and no live provider is called.
- The complete `npm test` run reports 338 tests: 337 passed, 0 failed and one
  environment-dependent JDK test skipped. The test-only repair was emitted over
  the last healthy build because unrelated source parser errors prevent a new
  whole-project TypeScript emit.
- `npm run verify` reaches `tsc` and stops on three inherited parser errors in
  `src/cli.ts`, `src/core/types/code-change.ts` and
  `src/semantic/reranker/result.ts`. None is in ticket-030 scope.
- Scoped `git diff --check` passes. Whole-repository governance continues to
  report only the pre-existing ticket-018/ticket-019 conflict, dependency,
  workstream ownership and shared `Makefile` overlap.
