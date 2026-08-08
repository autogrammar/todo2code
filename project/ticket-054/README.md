# Ticket 054: Todo2code-driven repair and skills expansion

- **ID**: ticket-054
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-08

## Goal and scope

Define a fail-closed, cross-repository delivery plan in which todo2code
produces deterministic, provenance-bound diagnostics, repair-agent may turn an
approved bounded plan into a pull request, and validator-agent independently
validates the exact PR head. Use that chain to restore the skills-agent
orchestrator before adding a small set of todo2code-grounded skills.

This ticket owns coordination evidence only. Executable changes must be made
through separate governed branches and PRs in the repository that owns each
path: `subactor/skills-agent`, `subactor/repair-agent`, or
`subactor/validator-agent`. It does not authorize a target repository to
self-dispatch its trusted reviewer.

## Verified current state

- repair-agent is scheduled hourly and consumes the exact `repair.v1` process
  from skills-agent. Run `31268075840` passed at repair-agent main
  `f9332b4af310b20dd47c75a7fcd1774b0567a800`, but it ran with
  `DRY_RUN=true` and returned `idle: No Ready for repair ticket available`.
- The last recorded live Repair attempt (`31011601205`) reached the bounded
  target branch stage but was blocked by the OpenRouter key total limit. There
  is still no end-to-end paid Repair PR followed by Validator hand-off.
- validator-agent is live. Recent scheduled and direct runs pass, including
  exact-head approvals used by todo2code and new-project. Its protected model
  variable is `openrouter/z-ai/glm-5.2`.
- The local validator-agent checkout is still on
  `fix/hosted-checks-via-check-runs`, whose remote branch is gone. It is clean,
  but should be returned to `main` before local development resumes.
- skills-agent contains 15 ready task packages plus versioned process
  contracts. Fourteen task packages validate; `0014_publication-freeze` has
  ten schema violations and blocks every scheduled discovery run, including
  run `31268951039` on skills-agent main
  `325f98c415d7f3ad5f21fdf1a050b05a25322694`.
- skills-agent still configures both developer and validator model variables
  as Gemini 3.1 Pro Preview instead of the required GLM 5.2 route.
- A deterministic todo2code pipeline over skills-agent succeeded with graph
  fingerprint `7a8e77e2b9fdccfa954dfd1b230be031e0b1308a914715d7182e16e0017a5211`.
  Its output also exposed stale historical TODO paths under
  `src/todo_agent/**`; these proposals are evidence to reconcile, not patches
  to apply automatically.
- repair-agent's local main worktree contains unrelated modifications to
  `.gitignore` and staged `scripts/main.py`; this work is preserved and is not
  part of ticket-054.

## Proposed delivery order

1. Repair skills-agent `0014_publication-freeze` against the current task
   schema and add a regression proving one invalid package cannot silently
   disable the entire scheduled fleet.
2. Align skills-agent's protected model variables and examples with
   `openrouter/z-ai/glm-5.2`.
3. Add pilot skill `0015_todo2code-governance-health`: todo2code runs
   deterministically and read-only, Doctor emits bounded diagnostics, Repair
   is disabled, and Validator checks provenance and reproducibility.
4. After the pilot passes, add `0016_todo2code-dependency-repair`: Repair may
   create only a ticket-owned PR from an approved, grounded plan; Validator
   checks a clean exact-head checkout and may reject independently.
5. Add `0017_todo2code-branch-lifecycle-repair` only after the same identities,
   PR-only mutation and exact-head hand-off are proven end to end.
6. Restore a real Ready-for-repair fixture, resolve the OpenRouter key limit,
   and record one complete Repair PR → Validator decision without auto-merge.

## Acceptance criteria

- [x] AC-01: Human approves this ordering and the three proposed skill IDs.
- [ ] AC-02: skills-agent discovery validates all registered task packages and
  no scheduled run is blocked by the current `0014` schema mismatch.
- [ ] AC-03: The pilot consumes an immutable todo2code run manifest, graph
  fingerprint and diagnostics without treating model output as fact.
- [ ] AC-04: Repair mutates only through a ticket-owned PR and never receives
  Validator credentials or merge authority.
- [ ] AC-05: Validator independently binds repository, PR, current head SHA,
  ticket and actor after required checks pass.
- [ ] AC-06: One live bounded repair reaches a real PR and exact-head Validator
  decision; additional skills remain `todo` until their own review and tests.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md).

## Approval gate

The human owner approved continuation after reviewing this plan on 2026-08-08.
This records the transition to `EDIT`; it is not trusted merge authorization.

The rebased coordination-only diff passes governance and is ready for
protected exact-head review. Cross-repository implementation remains pending.

## Non-goals

- No direct push to `main`, automatic merge, or self-review.
- No write to repair-agent's dirty local worktree.
- No automatic application of todo2code code-change proposals.
- No weakening of skills-agent schemas to accept `0014` as-is.
- No executable cross-repository change in this planning PR.
