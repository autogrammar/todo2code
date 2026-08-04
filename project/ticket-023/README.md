# Ticket 023: Repair current core and semantic parser contracts

- **ID**: ticket-023
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-04

## Goal and scope

Repair parser/type regressions that remain on current commit `bf82943` without
reverting its parallel module refactors. Restore the truncated source-patch and
TODO artifact declarations, remove obsolete duplicate diagnostic declarations,
restore missing type imports, synchronize `T2C_VERSION` with canonical release
`0.5.2`, and close the stray schema guard in the newly split semantic reranker.
CLI and interface files remain outside this workstream.

After parser recovery, strict TypeScript checking exposed four additional
current-refactor defects in the same workstream: an explicit `undefined`
optional walk matcher, validator records not narrowed after runtime checks,
two local variables shadowing their predicate functions, and an optional
reranker response ID passed without null normalization. These exact files are
included in the continuing core-dsl repair.

Full aggregate tests then exposed a semantic regression in the refactored
linker: object similarity is computed but no longer added to the pair score,
and the scaled contribution is incorrectly returned as raw `textScore`. The
continuing repair restores the pre-split scoring contract without reverting
the helper extraction.

## Acceptance criteria

- [x] AC-01: The human instructed the agent to continue the diagnosed repair.
- [x] AC-02: Core artifact types parse and expose the intended public contract
      exactly once.
- [x] AC-03: The semantic reranker validates its schema header and parses after
      the current refactor.
- [x] AC-04: Runtime and package/SDK versions consistently report `0.5.2`.
- [x] AC-05: Focused core/semantic validation passes; remaining diagnostics are
      attributed to other workstreams.
- [x] AC-06: Strict optional-property and runtime-validator types pass without
      weakening validation or changing evidence semantics.
- [x] AC-07: Text similarity contributes once to pair scoring while
      `textScore` retains the unscaled similarity used by diagnostics and gold
      evaluation.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- The user's 2026-08-04 instruction `kontynuuj`, after receiving the completed
  diagnostic and branch handoff, authorizes this current-HEAD repair.
- Chat authorization is not trusted merge evidence; protected review remains
  required.
