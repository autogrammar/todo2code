# Ticket 040: Detect unsafe workspace state before governed edits

- **ID**: ticket-040
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
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
- Accepted base: `main@db368c020876ccac537538c9e8cac03c9ae2f02f`.
- No CLI, MCP, A2A, SDK, schema publication, `project.sh`, Makefile, workflow,
  dependency manifest, automatic fix, network access or remote mutation.
- Lease acquisition, compare-and-swap push, exact-head Check Run publication
  and post-merge closure automation remain separate follow-up tickets.

## Acceptance criteria

- [x] AC-01: Scope is approved by a human owner.
- [x] AC-02: Invalid roots, option-like or symbolic baseline refs, missing
      checker output, malformed JSON and more than 4096 dirty paths fail closed.
- [x] AC-03: The report binds exact HEAD/baseline SHAs, branch state and
      ahead/behind counts to independently verified local Git results.
- [x] AC-04: Porcelain-v2 parsing deterministically preserves tracked,
      untracked, rename and conflict facts without absolute paths.
- [x] AC-05: Existing governance JSON is retained as authoritative evidence;
      the TypeScript service does not reproduce policy glob or ownership logic.
- [x] AC-06: A clean expected branch yields `PASS`; a dirty, stale, detached or
      wrongly scoped fixture yields stable diagnostics and safe-action enums.
- [x] AC-07: Reordered filesystem/ref enumeration and generated time cannot
      change the report fingerprint.
- [x] AC-08: Success and failure leave HEAD, index, worktree, refs, stash and
      remotes unchanged; output contains no executable command or credential.
- [x] AC-09: Focused tests, full offline verification, governance, complexity
      and Docker core E2E pass without network access or an LLM.
- [x] AC-10: CLI integration and any mutating repair remain explicit follow-up
      scopes requiring separate approval.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

The user approved this exact contract and replacement base
`db368c020876ccac537538c9e8cac03c9ae2f02f` by replying `tak` after plan PR #47
merged. The ticket entered `IN_PROGRESS / EDIT` and the approval was recorded
before either implementation file was created. It has since moved to
`DONE` without widening that approval. Chat approval authorized the bounded
interactive edit; merge authority came from protected exact-head Koru,
Validator App and required CI evidence.

## Validation result

- Added dependency-free `inspectWorkspace()` with bounded local Git reads,
  strict full-ref/root validation, porcelain-v2 parsing, canonical fingerprint
  and the seven stable `WS-*` diagnostic families.
- The service passes the union of baseline-to-HEAD and dirty paths to the
  managed Python checker; only its protected output can select `activeTicket`.
- Focused build and test: 10 passed, 0 failed, 0 skipped.
- Full host verification after synchronizing completed ticket-041: 385 passed,
  0 failed and one missing-JDK skip.
- Docker core E2E passed the full deterministic verification and protocol,
  examples and SDK smoke gates; unavailable language toolchains were explicit
  skips rather than false passes.
- Lizard over both implementation files reports zero CC, function-length or
  argument-count threshold violations; the service is 498 physical lines.
- `make governance` and `git diff --check` pass with zero findings.
- Two exact-head Koru reviews correctly blocked `runGovernance` at CC=16. It
  is now a small orchestrator over checker discovery, argument construction,
  process execution, JSON validation and ticket reading. Command-start/output
  failures retain their owning `WS-*` code and expose only stderr/stdout size
  plus SHA-256, never raw content.

## Live read-only audit

The built service inspected its own in-progress isolated worktree against
`refs/remotes/origin/main`. It correctly returned `BLOCKED` because two
implementation files were uncommitted, retained governance `passed`, resolved
exactly `ticket-040`, reported one local plan/approval commit and emitted
fingerprint `dade38bc751e87da9edcb044bc8f0c0d97f33b5c02c27edf0cafdf937b351d62`.
This is the intended pre-edit safety behavior; no Git state changed.

## Protected completion evidence

- Koru run
  [30986666719](https://github.com/semcod/todo2code/actions/runs/30986666719)
  passed exact head `567424b58234907eb1d7faedf399a700f808da19`
  after two earlier exact-head reviews correctly blocked CC=16.
- Validator run
  [30986780768](https://github.com/subactor/validator-agent/actions/runs/30986780768)
  approved that same head for `ticket-040` and correlation ID
  `t2c-ticket-040-workspace-preflight-20260805-final` using
  `openrouter/z-ai/glm-5.2`. Its semantic verdict was explicitly advisory and
  not the trust root.
- The advisory report first suspected swapped ahead/behind counts and command
  injection, then correctly re-evaluated both: Git reports the baseline-left
  count as `behindBy`, the head-right count as `aheadBy`, and all commands use
  `spawn` argument arrays rather than a shell. Its remaining `@{` concern does
  not pass the branch regex; stale test counts in the PR body were corrected
  without changing the reviewed commit.
- Review-triggered CI run
  [30986929576](https://github.com/semcod/todo2code/actions/runs/30986929576)
  passed governance, full verification, Docker smoke and the required Java
  fixture with current-head Validator evidence.
- Protected PR [#49](https://github.com/semcod/todo2code/pull/49) merged exact
  head `567424b` as
  `main@008bee503b45a78d463d8802b61deb74d23c1124` without an administrative
  bypass.
