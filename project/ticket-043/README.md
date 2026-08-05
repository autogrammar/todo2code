# Ticket 043: Add a governed workspace preflight command

- **ID**: ticket-043
- **Owner**: human:founder
- **Status**: DONE
- **Workflow state**: DONE
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
- Accepted base: `main@1d926eb1bc540ff25377c47bc7c22590f8579288`.
- Complexity: `XS`; at most three implementation files and one component.
- Implementation paths: `Makefile`, `scripts/workspace-preflight.mjs` and
  `test/workflow-validation.test.ts`.
- No change to `src/**`, `project.sh`, governance policy, workflow, package
  manifests, schemas, CLI/MCP/A2A/SDK, network access or Git mutation.
- Automatic invocation by ticket creation and branch-name discovery remain
  separate follow-up work because they require governance/interface ownership.

## Acceptance criteria

- [x] AC-01: Scope is approved by a human owner.
- [x] AC-02: Missing or unsafe expected-branch/baseline input fails before the
      workspace observer runs and help is successful and non-mutating.
- [x] AC-03: A valid invocation emits exactly one schema-valid canonical JSON
      report and maps `PASS` to exit 0 and `BLOCKED` to a documented non-zero
      exit without changing report evidence.
- [x] AC-04: The wrapper imports the existing runtime service and contains no
      Git command, governance matcher, diagnostic derivation or repair logic.
- [x] AC-05: Before/after HEAD, index, worktree, refs, stash and remotes are
      identical for successful and blocked fixture runs.
- [x] AC-06: Focused tests, full offline verification, governance, Docker smoke
      and `git diff --check` pass without a network call or live LLM.

## Participants

- Human participant: `human:founder`, evidenced by the active approval session;
  no user-* file was generated or edited.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

The Founder approved this exact command, scope and accepted base in the active
session with an explicit `tak`, authorizing the transition to `EDIT`.
Implementation was completed inside that boundary and independently validated
before protected merge.

## Validation evidence

- Focused command boundary: 5/5 tests passed, including real Make invocation,
  canonical stdout, exit mapping and complete before/after Git state equality.
- Live clean-worktree invocation returned one canonical report, exit 0,
  `PASS`, active `ticket-043` and only the expected ahead-only warning.
- `make verify` passed 391 tests (390 pass, one declared local JDK skip), and
  `make governance`, `make docker-smoke` plus `git diff --check` passed without
  a live LLM call.
- The first hosted run exposed inherited GNU Make directory banners in the
  Make-boundary test. Commit `b405ae8` isolates that subprocess with
  `--no-print-directory`; the exact hosted invocation now passes locally.
- Lizard reported no threshold violations; wrapper maximum complexity is
  `CC=9`, below the project limit of 15.

## Protected completion evidence

- Koru run
  [30991223497](https://github.com/semcod/todo2code/actions/runs/30991223497)
  passed exact head `87ce55cea08fdfab01dc1c81f8bed093d17d5912` using
  `openrouter/z-ai/glm-5.2` and published an attested report.
- Validator App run
  [30991349104](https://github.com/subactor/validator-agent/actions/runs/30991349104)
  approved the same head as `ifuri-validator-agent[bot]` for `ticket-043` and
  correlation ID `todo2code-pr56-87ce55cea08f`, using
  `openrouter/z-ai/glm-5.2`; its semantic output remained advisory.
- Review-triggered CI run
  [30991457928](https://github.com/semcod/todo2code/actions/runs/30991457928)
  passed governance, full verification, required Java and Docker smoke.
  Rerun [30991224257](https://github.com/semcod/todo2code/actions/runs/30991224257)
  replaced the historical pre-review governance failure with exact-head
  approval evidence.
- Protected PR [#56](https://github.com/semcod/todo2code/pull/56) merged exact
  head `87ce55c` without administrative bypass as
  `main@4a7445a06e79248f162595272912f017a9b28708`.
