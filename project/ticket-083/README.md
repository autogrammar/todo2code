# Ticket 083: Keep workspace comparison evidence outside analysed state

- **ID**: ticket-083
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-21

## Goal and scope

Make `compare-workspace` observationally pure with respect to the repository it
analyses. Its requested output directory must control both pipeline artifacts
and extractor caches, including when that directory is outside the repository.
Generated evidence must not appear in the captured Git status or in either
intent graph.

## Acceptance criteria

- [x] AC-01: The human owner explicitly requested implementation and continued
      autonomous testing on 2026-08-21.
- [x] AC-02: An external `outputDir` receives current-workspace artifacts and
      caches without creating `.intent` in the analysed repository.
- [x] AC-03: Comparison status is captured before output creation and excludes
      the selected in-repository output directory when it already exists.
- [x] AC-04: Focused, full Node, governance and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

The user's request to implement the missing ticket-to-code verification loop,
followed by explicit continuation, authorizes this bounded defect repair. This
conversation note is not merge authorization; protected exact-head Validator
evidence remains required.

## Non-goals

- No change to comparison scoring or authority semantics.
- No automatic application, approval, merge or ticket closure.
- No new dependency or public schema.

## Verification evidence

- The focused workspace suite passes 3/3, including repeated in-tree output and
  external output with cache ownership assertions.
- `npm run verify` passes 421 tests with one existing JDK-only skip; type,
  module, environment, workflow, generated-analysis, structured-response and
  schema gates pass.
- `make docker-smoke`, governance and diff checks pass locally. Protected
  exact-head review remains pending.
