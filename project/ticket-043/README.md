# Ticket 043: Add a governed workspace preflight command

- **ID**: ticket-043
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-05

## Goal and scope

Make ticket-040's existing read-only workspace observer usable at the normal
pre-edit boundary without adding another policy implementation. Add one
explicit `make preflight PREFLIGHT_EXPECTED_BRANCH=<branch>` entry point that
builds the current checkout and invokes a dependency-free Node wrapper over
`inspectWorkspace()`.

The command accepts an explicit expected branch and an optional already-local
full baseline ref, defaulting to `refs/remotes/origin/main`. It prints the
canonical `t2c.workspace-preflight/v1` JSON report, returns success only for a
`PASS` verdict and returns a stable non-zero exit for `BLOCKED`. It never
fetches, stashes, checks out, resets, cleans or otherwise mutates Git state.

## Architecture before implementation

- `Makefile` owns discoverability, build ordering and explicit variables.
- `scripts/workspace-preflight.mjs` owns only argument parsing, invocation,
  JSON output and process exit mapping.
- `src/services/workspace-preflight.ts` remains the sole owner of Git,
  governance, diagnostic and fingerprint semantics and is not modified.
- `test/workflow-validation.test.ts` verifies help, required branch input,
  stable exit behavior and the non-mutating command boundary.

## Delivery boundary

- Workstream: `integration` because `Makefile` and `scripts/**` are shared
  integration contracts.
- Accepted base: `main@4d9a793d13e6eb0fd0a8b60e59692b6aa5f173ef`.
- Complexity: `XS`; at most three implementation files and one component.
- Implementation paths: `Makefile`, `scripts/workspace-preflight.mjs` and
  `test/workflow-validation.test.ts`.
- No change to `src/**`, `project.sh`, governance policy, workflow, package
  manifests, schemas, CLI/MCP/A2A/SDK, network access or Git mutation.
- Automatic invocation by ticket creation and branch-name discovery remain
  separate follow-up work because they require governance/interface ownership.

## Acceptance criteria

- [ ] AC-01: Scope is approved by a human owner.
- [ ] AC-02: Missing or unsafe expected-branch/baseline input fails before the
      workspace observer runs and help is successful and non-mutating.
- [ ] AC-03: A valid invocation emits exactly one schema-valid canonical JSON
      report and maps `PASS` to exit 0 and `BLOCKED` to a documented non-zero
      exit without changing report evidence.
- [ ] AC-04: The wrapper imports the existing runtime service and contains no
      Git command, governance matcher, diagnostic derivation or repair logic.
- [ ] AC-05: Before/after HEAD, index, worktree, refs, stash and remotes are
      identical for successful and blocked fixture runs.
- [ ] AC-06: Focused tests, full offline verification, governance, Docker smoke
      and `git diff --check` pass without a network call or live LLM.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

This plan records the user's instruction to continue improving efficiency,
but it remains in `PLAN / WAIT_FOR_APPROVAL`. No implementation path may be
edited until the human approves this exact command, scope and accepted base.
