# Ticket 037: Deterministic branch comparison contract

- **ID**: ticket-037
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-04

## Goal

Define the dependency-free core `t2c.branch/v1` read model that compares a
bounded set of immutable branch snapshots against one exact base snapshot.
The projector consumes already-materialized Git and semantic evidence; it does
not fetch a remote, resolve mutable refs, call an LLM or mutate a branch.

This is the second delivery from ticket-036's Branch Intelligence blueprint.
It turns exact snapshot facts into deterministic pairwise interactions and
conservative recommendations that Goal, Koru and validator-agent can later
consume through separate adapters.

## Input boundary

Every input binds:

- repository identity and tool/schema version;
- exact base SHA and tree SHA;
- for each candidate: branch name, head SHA, tree SHA, merge-base SHA,
  ahead/behind counts and zero-or-more PR identities;
- a deterministic textual merge result supplied by a later Git runtime;
- graph and truth-map fingerprints plus the explicit assertion changes used by
  semantic comparison;
- explicit semantic completeness for each candidate and pair, so absent proof
  cannot be interpreted as `disjoint`;
- relation-backed citations for every non-independent ordering claim;
- optional stable patch identity for equivalent cherry-pick detection.

An unknown or missing fact stays `unknown`; the core must never infer a clean
merge, reviewer identity or branch freshness from a display name.

## Output boundary

The sorted, fingerprinted `t2c.branch/v1` portfolio contains:

- exact repository/base/head/merge-base bindings;
- one result per candidate and one result per relevant candidate pair;
- cited record, relation and assertion IDs for semantic findings;
- classifications `disjoint`, `overlap`, `duplicate`, `ordered_after`,
  `textual_conflict`, `semantic_conflict` or `unknown`;
- recommendations limited to `merge_ready`, `merge_after`, `conflict`,
  `duplicate`, `stale`, `rebase_required` or `manual_review`;
- a canonical fingerprint that excludes wall-clock metadata.

Recommendations are a read model, not authorization. In particular,
`duplicate` and `stale` never mean that a branch may be deleted.

## Delivery boundary

- Workstream: `core-dsl`.
- Complexity: `S`; at most two implementation files and one component.
- Proposed implementation paths: `src/core/branch-portfolio.ts` and
  `test/graph-branch-portfolio.test.ts`.
- No Git subprocess, pipeline, cache, CLI, MCP, A2A, Protobuf, schema
  publication, Goal/Koru/Validator change or documentation outside this
  ticket.

## Acceptance criteria

- [x] AC-01: A human approves this exact input/output and recommendation
      boundary.
- [x] AC-02: The projector rejects malformed SHA, repository, count, enum,
      graph/truth-map and cross-reference bindings.
- [x] AC-03: Every candidate and interaction is bound to the exact base, head
      and merge-base SHAs; a changed base invalidates the fingerprint.
- [x] AC-04: Textual and semantic conflict evidence is retained separately and
      either conflict forces the conservative `conflict` recommendation.
- [x] AC-05: Equivalent stable patch identities are classified `duplicate`
      without treating different commit IDs as unique work.
- [x] AC-06: Contained/no-unique-evidence branches are `stale`; missing or
      ambiguous evidence is `manual_review`, never guessed as merge-ready.
- [x] AC-07: Pair ordering, record ordering and generated time do not change
      IDs or the portfolio fingerprint.
- [x] AC-08: The result contains no mutation command, approval boolean, token,
      credential or automatic conflict winner.
- [x] AC-09: Focused tests, full offline verification, governance, Lizard and
      Docker core E2E pass without a network or LLM.
- [x] AC-10: Runtime materialization, public interfaces/docs, Goal, Koru and
      Validator remain explicit follow-up tickets.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

The user explicitly approved ticket-037 after reviewing this input/output and
recommendation contract. Current state: `IN_PROGRESS / VALIDATION`. Chat approval
authorizes this bounded interactive edit only; merge still requires protected
exact-head evidence.

## Validation result

- Focused branch portfolio suite: 14 passed, 0 failed.
- Full host verification: 363 passed, 1 environment-dependent skip, 0 failed.
- Docker core E2E: 357 passed, 7 toolchain-dependent skips; both gold datasets,
  CLI, MCP, A2A and examples passed with `T2C-E2E-000`.
- Lizard: 499 NLOC, zero threshold violations, maximum function CC 11.
- Governance: `GOV-PASS` with 0 errors and 0 warnings.
- No Git/GitHub mutation, LLM call, runtime dependency or cross-workstream
  implementation change was introduced.
