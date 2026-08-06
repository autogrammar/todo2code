---
participant-id: agent:claude
participant: claude
role: agent
ticket: ticket-048
---
# Participant: claude (AI agent)

## Understanding

Ticket-047's adapter works and is fully tested, but it cannot reach protected
`main`. Three independent obstacles were confirmed by running the CI-equivalent
governance check locally rather than the working-tree check that `make
governance` performs:

- the plan and the implementation share one commit (`GOV-INTENT-003`),
- the ticket was closed to `DONE` before publication, so it no longer
  authorizes its own implementation paths (`GOV-TICKET-001`),
- its `.env.example` follow-up touches a path no workstream owns, and the
  manifest that would have to grant that ownership is hash-locked to the pinned
  upstream standard.

The third obstacle has a cause inside the adapter: two `process.env` fallbacks
that `verify:env` propagates into an `.env.example` requirement. Removing them
is both the governance fix and the better boundary — a bounded acquisition step
should take its input explicitly, not inherit ambient process state.

## Execution plan

1. Cut the branch from the protected base the PR targets, so `.env.example`
   never appears in the diff.
2. Commit this plan and `intent.json` alone, before any implementation.
3. Republish the adapter with `--event-path` and `--repository` required and no
   `process.env` read; carry the tests, fixture and documentation across.
4. Add one case asserting the adapter still fails closed when those variables
   are set in the child environment but the flags are absent.
5. Verify with the CI-equivalent base/head governance check, `make verify`,
   `make docker-smoke` and `npm run verify:env`.

## Actual changes

- `scripts/github-event-log.mjs`: both `process.env` reads removed. The event
  path resolves only from `--event-path`, and the repository only from
  `--repository` or the payload's own `repository.full_name`. The missing
  repository error now names the flag.
- `test/workflow-validation.test.ts`: added a case that sets
  `GITHUB_EVENT_PATH` and `GITHUB_REPOSITORY` in the child environment and
  asserts the adapter still fails closed on both, writes no output file, and
  never echoes the ambient repository value.
- `docs/EVENT_LOG_DSL.md`: documents the required flags, states that the
  adapter reads no environment variable, and records why an environment-reading
  acquisition boundary cannot be published in this repository at all.
- `test/fixtures/event-log/v1/github-event-payloads.json`: carried across
  unchanged from ticket-047.
- `TODO.md`, `project/TICKETS.md`, `project/ticket-047/**`: record carried and
  registered.

## Blockers

- None. The three obstacles in the plan are resolved: the plan sits in an
  earlier commit, this ticket is active over its own implementation paths, and
  `npm run verify:env` passes with `.env.example` byte-identical to the
  protected base.
