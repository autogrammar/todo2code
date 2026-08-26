# Ticket 083: Keep workspace comparison bounded and outside analysed state

- **ID**: ticket-083
- **Owner**: agent:codex
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-21

## Goal and scope

Make `compare-workspace` observationally pure with respect to the repository it
analyses. Its requested output directory must control both pipeline artifacts
and extractor caches, including when that directory is outside the repository.
Generated evidence must not appear in the captured Git status or in either
intent graph. A generated graph that exceeds the generic JSON-document ceiling
but remains within the comparison-specific resource budget must be readable by
the comparator without weakening limits for unrelated JSON consumers.

## Acceptance criteria

- [x] AC-01: The human owner explicitly requested implementation and continued
      autonomous testing on 2026-08-21.
- [x] AC-02: An external `outputDir` receives current-workspace artifacts and
      caches without creating `.intent` in the analysed repository.
- [x] AC-03: Comparison status is captured before output creation and excludes
      the selected in-repository output directory when it already exists.
- [x] AC-04: Focused, full Node, governance and Docker checks pass.
- [x] AC-05: `compare-workspace` accepts the observed 142,557,246-byte Platform
      graph under an explicit 256 MiB ceiling while still rejecting graphs
      above that bounded comparison limit.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

The user's request to implement the missing ticket-to-code verification loop,
followed by explicit continuation, authorizes this bounded defect repair. This
conversation note is not merge authorization; protected exact-head Validator
evidence remains required.

On 2026-08-25 the Subactor coding-agent independently reproduced the live
failure on `PLF-8091`; the Founder asked the supervisor to continue and repair
autonomization defects found through observation. Exact stderr proved that both
pipelines completed but the comparator rejected a 142,557,246-byte generated
graph at the generic 128 MiB read ceiling.

## Non-goals

- No change to comparison scoring or authority semantics.
- No automatic application, approval, merge or ticket closure.
- No new dependency or public schema.
- No unbounded graph reads and no increase to the generic JSON read ceiling.

## Verification evidence

- The focused workspace suite passes 3/3, including repeated in-tree output and
  external output with cache ownership assertions.
- `npm run verify` passes 421 tests with one existing JDK-only skip; type,
  module, environment, workflow, generated-analysis, structured-response and
  schema gates pass.
- `make docker-smoke`, governance and diff checks pass locally. Protected
  exact-head review remains pending.
- The 2026-08-25 exact Platform replay passed `compare-workspace` with a
  142,557,246-byte generated graph and zero stderr. It then surfaced the real
  semantic delta (`blocking +2`) instead of a file-size stack trace.
- Current verification passes 426 tests (425 pass, one JDK-only skip), focused
  workspace 4/4, governance with zero findings and Docker smoke.

## Closure evidence

Protected PRs #98 and #100 merged the isolated-output and bounded large-graph
repairs; both are ancestors of `main@a93944f51d47fbf8fe1f3aaea03f17f4fb472d80`.
