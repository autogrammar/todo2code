# Ticket 022: Git evidence for umbrella workspaces

- **ID**: ticket-022
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: VALIDATION
- **Created**: 2026-08-01

## Goal and scope

Allow the existing deterministic Git extractor to analyze an umbrella directory
whose children are independent Git repositories. Today the Subactor root is not
itself a work tree, so the pipeline emits `Git repository not available` and
loses the history of 41 repository roots that supply its code.

The extractor will discover bounded, nested repository roots, extract each
history independently and express changed paths relative to the umbrella root.
It remains read-only and does not add an executor, ticket publisher, MCP/A2A
mutation, checkout, fetch, commit or push operation.

## Planned behavior

1. Preserve target-path, commit ordering and count behavior for a root that is
   already one Git repository, apart from the added repository provenance and
   audited extractor-version increment.
2. When the root is not a repository, walk real directories in deterministic
   order, without following symlinks. Stop descending as soon as a repository
   root is found so vendored/worktree repositories inside it are not counted.
3. Bound discovery to 100 repositories and four concurrent repository readers;
   report truncation and per-repository failures without hiding successful
   evidence from other repositories.
4. Interpret `count` per discovered repository. Prefix changed and previous
   paths with the repository path relative to the umbrella root so they align
   with AST, TODO and documentation paths in the shared graph.
5. Record the repository-relative root in metadata and bump deterministic Git
   extraction provenance from `t2c/git@1` to `t2c/git@2`.
6. Add isolated regression tests for nested repositories, path collisions,
   nested-repository pruning, symlink refusal, empty histories and the unchanged
   single-repository contract.
7. Repeat the deterministic Subactor pipeline and compare Git record count,
   warnings, graph links and downstream diagnostics against the ticket-021
   baseline.

## Acceptance criteria

- [x] AC-01: A human approves this exact plan before source or test edits.
- [x] AC-02: A normal single Git repository retains unprefixed target paths and
      the requested commit ordering/count.
- [x] AC-03: An umbrella root discovers every bounded top-level/nested repository
      exactly once and does not follow symlinks or descend into a discovered repo.
- [x] AC-04: Same-named files from different repositories receive distinct,
      umbrella-relative paths and stable record IDs.
- [x] AC-05: One empty or unreadable repository produces a scoped warning while
      evidence from healthy siblings remains available.
- [x] AC-06: Discovery and extraction are deterministic and bounded; no analyzed
      repository or its Git state is modified.
- [x] AC-07: Focused tests, `npm run verify`, `make governance` and Docker smoke
      pass or report only independently owned pre-existing governance findings.
- [x] AC-08: A comparable Subactor run replaces the root-level Git-unavailable
      warning with grounded child-repository history and does not regress the
      autonomy-safety result from ticket-021.

## Participants

- Human participant: unresolved; no human-owned file was created.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- Current state: `IN_PROGRESS / EDIT`.
- Approval evidence: user response `zatwierdzam ticket 022 i kolejne` on
  2026-08-01 after the exact bounded plan was presented. This approves ticket
  022; future unknown scopes still require their own concrete plan.
- Chat approval permits interactive implementation only. Protected merge still
  requires independent GitHub review or signed attestation.

## Risks and stop conditions

- `src/pipeline/**`, CLI, MCP/A2A, core schemas/types, package/build files and
  Subactor repositories are outside this ticket.
- Repository discovery must not cross the supplied root or follow symlinks.
- If correct behavior requires a new public option or schema field, stop and
  create an integration ticket rather than widening this scope.

## Implementation and validation result

- A root that is already a Git work tree still emits unprefixed paths in newest
  first commit order. The extractor provenance is now `t2c/git@2` and records
  `metadata.repositoryRoot` (`.` for a single repository).
- A non-Git umbrella uses deterministic breadth-first discovery bounded to 100
  repositories and 10,000 directories. It excludes common generated/vendor
  roots, refuses symlinked directories and `.git` markers, stops below every
  discovered checkout and reads four repositories concurrently while retaining
  stable output order.
- Changed and previous rename paths are namespaced relative to the umbrella.
  Per-repository short/empty-history and read failures are scoped warnings;
  healthy siblings remain available.
- Focused Git tests: 5/5 PASS. Full `npm run verify`: 338 tests discovered,
  337 passed, one explicit missing-JDK skip, zero failures. `make docker-smoke`:
  PASS.
- Comparable Subactor pipeline: 326 commits from 39 member repositories and
  2,697 namespaced changed paths. The other two raw `.git` directories observed
  by recursive `find` are correctly pruned inside an already discovered
  `vendor`/coding-agent `work` checkout.
- Same-snapshot control without Git had 133,043 records, 294,423 relations and
  14,396 diagnostics. With Git it has 133,369 records, 336,215 relations and
  14,121 diagnostics: +326 records, +41,792 relations and 275 fewer diagnostics.
  268 of 326 commit records link to other evidence; 58 remain explicitly
  unlinked. Git exposes 169 implemented-but-undocumented findings and clears
  442 unlinked-record findings plus two planned-not-implemented findings.
- Composing this graph with ticket-021's planner produces 44 plans, including
  43 remediation-oriented `Resolve` plans and zero unsafe inverted plans.
- `make governance` reports no ticket-022 finding. The global gate remains
  blocked only by the four inherited ticket-018/019 findings, so protected
  merge/push remains blocked pending their reconciliation and independent review.
