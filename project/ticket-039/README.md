# Ticket 039: Bounded immutable Git branch snapshot materializer

- **ID**: ticket-039
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
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
- calculate stable patch identity from the base-to-head changeset;
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

- [ ] AC-01: A human approves this exact read-only input/output and delivery
      boundary.
- [ ] AC-02: The service rejects a non-repository root, malformed repository
      identity, unsafe/missing/symbolic refs, duplicate candidates and more
      than 32 candidates.
- [ ] AC-03: Base and candidate commit/tree/merge-base SHAs and ahead/behind
      counts match independent Git commands in an offline fixture repository.
- [ ] AC-04: Equivalent cherry-picked changes produce the same stable patch
      identity even when commit SHAs differ; an empty changeset uses `null`.
- [ ] AC-05: Disjoint paths are `clean`, a real overlapping textual collision
      is `conflict`, and an unavailable/ambiguous merge check is `unknown`.
- [ ] AC-06: Ref input order and generated time cannot alter the canonical
      fingerprint; moving any ref during capture fails closed.
- [ ] AC-07: Success and injected failure leave the caller's HEAD, index,
      working tree, refs and object directory unchanged and remove temporary
      state.
- [ ] AC-08: The output contains no absolute path, credential, token, command,
      approval flag, semantic completeness claim or mutation instruction.
- [ ] AC-09: Focused tests, full offline verification, governance, Lizard and
      Docker core E2E pass without network access or an LLM.
- [ ] AC-10: Per-tree todo2code analysis, semantic assembly, PR metadata and
      CLI/MCP/A2A/Goal/Koru/Validator integration remain explicit follow-ups.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

The implementation remains blocked in `WAIT_FOR_APPROVAL`. Chat approval will
authorize only the bounded interactive edit. A protected exact-head review or
verified attestation remains required merge evidence.
