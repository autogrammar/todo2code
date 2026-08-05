# Ticket 040: Detect unsafe workspace state before governed edits

- **ID**: ticket-040
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-05

## Goal and scope

Prevent governed work from starting in a stale, dirty or incorrectly scoped
workspace. Add one dependency-free runtime service that observes an existing
local Git worktree, resolves the active ticket through the existing governance
checker and produces a deterministic, read-only `t2c.workspace-preflight/v1`
report.

The motivating incident occurred immediately after a clean-main audit: a
parallel generator modified `TODO.md`, `project/`, `project2.sh` and several
untracked analysis files while another session was preparing a ticket. The
preflight must expose that state before an agent assumes it owns a clean
workspace. It must preserve all user data and must not attempt an automatic
repair.

## Architecture before implementation

The runtime service accepts:

- a repository root;
- one explicit, already-existing local baseline ref such as
  `refs/remotes/origin/main`;
- the expected target branch;
- the actor passed to the managed governance checker.

It returns a bounded report containing:

- canonical repository root identity without exposing its absolute host path;
- current branch or detached state, exact `HEAD` and baseline SHA;
- deterministic ahead/behind counts against the supplied local baseline;
- sorted porcelain-v2 dirty entries, including tracked, untracked, renamed and
  conflicted paths;
- the active ticket resolved by the existing governance checker;
- the checker's existing `GOV-*` diagnostics without reimplementing
  `allowedPaths`, forbidden-path or workstream matching in TypeScript;
- stable workspace diagnostics and enumerated safe actions;
- a canonical fingerprint excluding time, process ID and absolute path.

The service may run only local read-only Git commands and the repository's
existing `.governance/governance_check.py --format json`. It fails closed when
the baseline, checker, JSON report or ticket binding is unavailable.

## Diagnostic contract

The first version is limited to:

- `WS-ROOT-001`: root is not a valid Git worktree;
- `WS-BASE-002`: baseline ref is missing, unsafe or unresolved;
- `WS-BRANCH-003`: current branch differs from the expected target;
- `WS-SYNC-004`: current branch is ahead/behind or diverged from baseline;
- `WS-DIRTY-005`: tracked or untracked workspace changes exist;
- `WS-GOVERNANCE-006`: the managed checker failed or reported diagnostics;
- `WS-TICKET-007`: no unique active ticket is resolved for implementation.

Safe actions are non-executable enum values such as `PRESERVE_CHANGES`,
`USE_ISOLATED_WORKTREE`, `FAST_FORWARD_AFTER_PRESERVE` and
`RESOLVE_TICKET_SCOPE`. No shell command, stash mutation or automatic checkout
is returned or executed.

## Delivery boundary

- Workstream: `runtime`.
- Complexity: `S`; maximum two implementation files and one component.
- Proposed implementation paths: `src/services/workspace-preflight.ts` and
  `test/git-workspace-preflight.test.ts`.
- Accepted base: `main@45221496ef7391d3eceb4f07b6a4dece5ae1ced5`.
- No CLI, MCP, A2A, SDK, schema publication, `project.sh`, Makefile, workflow,
  dependency manifest, automatic fix, network access or remote mutation.
- Lease acquisition, compare-and-swap push, exact-head Check Run publication
  and post-merge closure automation remain separate follow-up tickets.

## Acceptance criteria

- [ ] AC-01: Scope is approved by a human owner.
- [ ] AC-02: Invalid roots, option-like or symbolic baseline refs, missing
      checker output, malformed JSON and more than 4096 dirty paths fail closed.
- [ ] AC-03: The report binds exact HEAD/baseline SHAs, branch state and
      ahead/behind counts to independently verified local Git results.
- [ ] AC-04: Porcelain-v2 parsing deterministically preserves tracked,
      untracked, rename and conflict facts without absolute paths.
- [ ] AC-05: Existing governance JSON is retained as authoritative evidence;
      the TypeScript service does not reproduce policy glob or ownership logic.
- [ ] AC-06: A clean expected branch yields `PASS`; a dirty, stale, detached or
      wrongly scoped fixture yields stable diagnostics and safe-action enums.
- [ ] AC-07: Reordered filesystem/ref enumeration and generated time cannot
      change the report fingerprint.
- [ ] AC-08: Success and failure leave HEAD, index, worktree, refs, stash and
      remotes unchanged; output contains no executable command or credential.
- [ ] AC-09: Focused tests, full offline verification, governance, complexity
      and Docker core E2E pass without network access or an LLM.
- [ ] AC-10: CLI integration and any mutating repair remain explicit follow-up
      scopes requiring separate approval.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

The user asked to continue after reviewing the workspace-doctor recommendation.
This ticket now makes the first bounded delivery exact. Current state:
`PLAN / WAIT_FOR_APPROVAL`; no source or test file has been edited. A separate
explicit approval of this contract is required before transition to `EDIT`.
