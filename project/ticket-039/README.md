# Ticket 039: Bounded immutable Git branch snapshot materializer

- **ID**: ticket-039
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-04

## Goal

Add a dependency-free runtime service that reads a bounded set of existing
local Git refs and materializes the immutable topology required before
`t2c.branch/v1` semantic evidence can be assembled. The result binds the
repository, base and candidate names to exact commit/tree/merge-base SHAs,
ahead/behind counts, changed paths, stable patch identities and conservative
textual merge results.

This is the third delivery from ticket-036's Branch Intelligence blueprint and
depends on ticket-037's deterministic projector. It closes only the local Git
observation boundary. A later runtime ticket will combine these facts with
per-tree graph/truth-map analyses; an interfaces ticket will expose the
combined portfolio through CLI, MCP and A2A.

## Read-only boundary

The service may execute only local, read-only Git queries against refs that
already exist in the supplied repository. It must:

- resolve the repository root and every requested ref to an exact commit;
- reject duplicate, symbolic, missing, option-like or over-limit inputs;
- sort candidates independently of caller/ref enumeration order;
- resolve exact tree and merge-base SHAs plus ahead/behind counts;
- calculate stable patch identity from the unique merge-base-to-head
  changeset;
- short-circuit disjoint changed-path sets as textually clean;
- inspect possible collisions in an isolated temporary object directory;
- re-resolve base and candidate refs before returning and reject any movement;
- remove all temporary state on success or failure.

It must not fetch, contact GitHub, call an LLM, checkout into the user's work
tree, update the index, create a ref, write a commit, merge, rebase, push,
force-push, close or delete anything.

## Output boundary

The internal `BranchGitMaterialization` value contains:

- normalized `owner/name` repository identity and todo2code version;
- the caller-supplied base ref with exact commit and tree SHA;
- 1..32 candidate refs with exact head/tree/merge-base SHAs, ahead/behind
  counts, sorted changed paths and stable patch ID or `null` for no patch;
- exactly one sorted interaction for every candidate pair, carrying
  `clean`, `conflict` or fail-closed `unknown` textual status;
- a canonical SHA-256 fingerprint excluding local absolute paths, wall-clock
  time and ref enumeration order.

This internal runtime value is not a second public DSL and is not approval
evidence. Semantic completeness, graph/truth-map fingerprints, PR identities
and recommendations remain absent rather than being fabricated. The next
assembler must map missing semantic evidence to `unknown` before calling the
ticket-037 projector.

## Delivery boundary

- Workstream: `runtime`.
- Accepted base: `main@3b7fdc17076da9c73db2fadaa6aa99742d6e7505`.
- Complexity: `S`; at most two implementation files and one component.
- Proposed implementation paths: `src/services/branch-snapshot.ts` and
  `test/git-branch-snapshot.test.ts`.
- No core-contract, pipeline, CLI, MCP, A2A, SDK, schema, dependency,
  documentation or cross-repository change.

## Acceptance criteria

- [x] AC-01: A human approves this exact read-only input/output and delivery
      boundary.
- [x] AC-02: The service rejects a non-repository root, malformed repository
      identity, unsafe/missing/symbolic refs, duplicate candidates and more
      than 32 candidates.
- [x] AC-03: Base and candidate commit/tree/merge-base SHAs and ahead/behind
      counts match independent Git commands in an offline fixture repository.
- [x] AC-04: Equivalent cherry-picked changes produce the same stable patch
      identity even when commit SHAs differ; a contained branch with no unique
      merge-base-to-head changeset uses `null`.
- [x] AC-05: Disjoint paths are `clean`, a real overlapping textual collision
      is `conflict`, and an unavailable/ambiguous merge check is `unknown`.
- [x] AC-06: Ref input order and generated time cannot alter the canonical
      fingerprint; moving any ref during capture fails closed.
- [x] AC-07: Success and injected failure leave the caller's HEAD, index,
      working tree, refs and object directory unchanged and remove temporary
      state.
- [x] AC-08: The output contains no absolute path, credential, token, command,
      approval flag, semantic completeness claim or mutation instruction.
- [x] AC-09: Focused tests, full offline verification, governance, Lizard and
      Docker core E2E pass without network access or an LLM.
- [x] AC-10: Per-tree todo2code analysis, semantic assembly, PR metadata and
      CLI/MCP/A2A/Goal/Koru/Validator integration remain explicit follow-ups.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

The user explicitly approved continuation and testing of ticket-039 on
2026-08-05 after reviewing the initialized plan. Chat approval authorizes only
the bounded interactive edit. The implementation was independently reviewed
and merged through the protected path; merge authority came from exact-head
Validator App evidence and required checks.

## Validation result

- Implementation commit:
  `1391dd0ba6813dde902627f92f970388ebf60b5c`.
- Focused command:
  `npm run build && node --test dist/test/git-branch-snapshot.test.js` —
  5 passed, 0 failed, 0 skipped.
- Full host `npm run verify`: 368 passed, 1 environment-dependent JDK skip,
  0 failed.
- Docker core E2E: 362 passed, 7 missing-toolchain skips, 0 failed; gold v1/v2
  and the remaining deterministic smoke gates completed successfully.
- Lizard over both implementation files: 603 NLOC, maximum observed CC 9 and
  zero CC/length/argument threshold violations.
- Governance: `GOV-PASS` with 0 errors and 0 warnings.
- No dependency manifest, public interface, LLM boundary or environment
  contract changed.

## Live read-only audit

The built materializer was run in a disposable fresh clone of
`wellmanifest/new-project` against exact base
`13c2f8e21a243fbbd6ea243b173305b0368a9729`. It produced fingerprint
`b9672aca66b1d1590489c23ab06e130218df4cfc16610c975b254c3e44b58c5e`:

- `feat/bounded-delivery-contract`: 7 ahead, 34 behind, 18 unique changed
  paths and a textual conflict with the selected base;
- `plan/governance-010-sync`: 0 ahead, 13 behind, no unique paths and
  `patchId=null`;
- `ticket/003-validator-approval-evidence`: 0 ahead, 31 behind, no unique
  paths and `patchId=null`.

The first live pass exposed and the implementation repaired an incorrect
`base..head` patch identity for contained branches. The final logic uses
`merge-base..head`, so work already contained in the base is not presented as
a reverse patch. The audit created no persistent local checkout and made no
remote mutation.

## Protected completion evidence

- Koru review run
  [30956043365](https://github.com/semcod/todo2code/actions/runs/30956043365)
  passed exact head `29df4507a2dbb55c6a3b296afc51a117ade0f01c`.
- Validator run
  [30956174819](https://github.com/subactor/validator-agent/actions/runs/30956174819)
  approved the same head for `ticket-039` with
  `openrouter/z-ai/glm-5.2`; its final advisory verdict was `APPROVE` with no
  findings.
- Review-triggered CI run
  [30956277125](https://github.com/semcod/todo2code/actions/runs/30956277125)
  passed governance, full verification, Docker smoke and the required Java
  fixture using the exact-head approval evidence.
- The earlier pull-request CI run
  [30956043915](https://github.com/semcod/todo2code/actions/runs/30956043915)
  was rerun after approval so GitHub's required-check rollup no longer retained
  its pre-approval failure under the same governance context. The rerun passed
  without changing the reviewed SHA.
- Protected PR [#44](https://github.com/semcod/todo2code/pull/44) merged as
  `main@2948f4ad5a5c7cf6f399c0f40f824bf159d84ff4`.
