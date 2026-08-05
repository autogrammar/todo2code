# Ticket 041: Immutable branch semantic evidence assembler

- **ID**: ticket-041
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-05

## Goal

Add the bounded runtime assembler between ticket-039's immutable local Git
snapshot and ticket-037's deterministic `t2c.branch/v1` projector. The
assembler consumes already-produced graph and truth-map bundles for the exact
unique tree SHAs in the Git snapshot, validates every binding, derives
conservative assertion changes and pair evidence, and invokes the existing
projector.

The canonical published value remains `t2c.branch/v1`. The assembler may
return an internal in-memory envelope containing the source snapshot
fingerprint, derived `t2c.branch-evidence/v1` and portfolio, but it must not
create another schema, artifact or public interface.

## Input contract

- One validated `BranchGitMaterialization` from ticket-039.
- Exactly one semantic bundle per unique base/candidate tree SHA. A bundle
  contains the exact tree SHA, a valid `t2c.graph/v1`, its matching
  `t2c.truth-map/v1`, and explicit completeness `complete` or `unknown`.
- A shared tree is analysed once and reused by every ref resolving to it.
- Missing, duplicate, conflicting or extra tree bundles fail closed. The
  assembler never invents graph/truth-map fingerprints for an unanalysed tree.
- PR history is not supplied by this ticket, so `pullRequests` remains empty
  until the separate GitHub/interface boundary adds exact-head metadata.

The bundle's `treeSha` is an immutable binding supplied by the future exact-tree
analysis orchestrator. This ticket validates the envelope and semantic
artifacts but does not itself check out or scan trees.

## Derivation rules

- Validate the Git materialization shape and recomputed fingerprint before
  reading semantic evidence.
- Validate every graph and truth map through their existing deterministic
  validators and require matching graph/truth fingerprints.
- Use the existing graph diff identity to identify unchanged, added, removed
  and modified records.
- Anchor removed and modified work to its base truth assertion; anchor a
  genuinely new assertion to its candidate truth assertion. Citations retain
  all relevant record and mapping-relation IDs.
- A conflicted changed assertion remains explicit base semantic conflict.
- Two branches may share semantic identity only through cited common assertion
  evidence. Ambiguous identities, unsupported extraction coverage and
  unanchored cross-branch additions become `semanticEvidence=unknown`, never a
  guessed `disjoint`, `clean` or merge order.
- Preserve ticket-039 textual results independently from semantic results.
- Ordering stays `independent` only when complete evidence proves disjoint
  changes; otherwise it remains `unknown` unless relation-backed evidence
  proves an order. No name, timestamp or array order may decide it.

## Delivery boundary

- Workstream: `runtime`.
- Accepted base: `main@db368c020876ccac537538c9e8cac03c9ae2f02f`.
- Complexity: `S`; at most three implementation files and two components.
- Proposed paths:
  `src/services/branch-snapshot.ts`,
  `src/services/branch-portfolio-assembler.ts`, and
  `test/git-branch-portfolio-assembler.test.ts`.
- No pipeline execution, worktree creation, Git/GitHub call, artifact write,
  dependency, schema publication, CLI/MCP/A2A/SDK or cross-repository change.

## Acceptance criteria

- [x] AC-01: A human approves this exact input, derivation and delivery
      boundary before implementation.
- [ ] AC-02: A strict exported internal validator rejects a malformed or
      tampered `BranchGitMaterialization`, including a wrong fingerprint.
- [ ] AC-03: The assembler requires exactly one valid graph/truth-map bundle
      for every unique tree SHA, reuses shared-tree evidence, and rejects
      missing, extra, duplicate or mismatched bundles.
- [ ] AC-04: Added, removed and modified record evidence maps to cited
      candidate/base truth assertions without fabricating IDs or fingerprints.
- [ ] AC-05: Changed conflicted assertions remain semantic conflicts; ambiguous
      or incomplete semantic mappings produce `unknown` and conservative
      `manual_review` rather than a false merge-ready result.
- [ ] AC-06: Git textual conflict/clean/unknown evidence is copied only from
      the validated immutable snapshot and remains separate from semantics.
- [ ] AC-07: Candidate, semantic-bundle and property ordering plus generated
      time cannot alter the portfolio fingerprint; a changed tree, graph,
      truth-map or Git snapshot does alter or invalidate it.
- [ ] AC-08: The result is the existing `t2c.branch/v1` portfolio with internal
      assembly evidence only; it contains no path, token, approval, mutation
      command, automatic conflict winner or new public schema.
- [ ] AC-09: Focused tests, full offline verification, governance, Lizard and
      Docker core E2E pass without network access, a live LLM or repository
      mutation.
- [ ] AC-10: Exact-tree pipeline orchestration, persistence, PR metadata,
      CLI/MCP/A2A, Goal, Koru and Validator consumption remain explicit
      follow-up tickets.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

The user explicitly approved the assembler contract and instructed autonomous
implementation before any source or test edit. The later `db368c0` refresh
contains only the independently planned ticket-040 governance files and does
not change this ticket's intent, architecture or implementation paths. Chat
approval authorizes only this bounded interactive edit. Protected exact-head
Koru and Validator App evidence remains required before merge; hosted advisory
review must use `openrouter/z-ai/glm-5.2`, never Gemini 3.1 Pro Preview.

The contract was originally reviewed under the concurrently selected ID
`ticket-040`. PR #47 allocated that ID to a non-overlapping workspace-preflight
plan while this work was still validating, so this unchanged assembler scope
was moved to the first free ID, `ticket-041`, on governance-only
`main@db368c0`. No source or test was part of the preceding plan commit.
