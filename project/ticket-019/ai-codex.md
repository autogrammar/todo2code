---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-019
---
# Participant: codex (AI agent)

## Understanding

The user wants `goal -a` to publish the existing dependency-free Python SDK as
the root PyPI distribution `todo2code`. They selected one root manifest, removal
of `sdk/python/pyproject.toml`, and an SDK-only artifact. The root project must
still remain a Node.js application; Goal therefore needs to detect both stacks.

The shared `dist/` directory is acceptable when handled append-only. TypeScript
uses paths below `dist/src`, while Python build writes two top-level archive
files. Publication is already bounded to `dist/todo2code-{version}*`, so neither
the JavaScript tree nor unrelated artifacts are passed to Twine.

Removing the nested manifest requires migrating `make python-wheel` from
`pip wheel ./sdk/python` to the repository root. Tickets 018 and 035 are DONE;
the latter now makes all five publication paths integration-owned shared
contracts. Ticket-019 is therefore routed to the `integration` workstream.

## Execution plan

1. Record the resolved dependencies and integration workstream in a plan-only
   commit before changing build metadata.
2. Add root PEP 517/621 metadata mapping `todo2code` and `todo2code_sdk` from
   `sdk/python`, preserving Apache-2.0 metadata and Python >=3.10.
3. Update Goal's project types/version file, remove the nested manifest, migrate
   the wheel target and correct SDK installation/build documentation.
4. Seed `dist/` with a sentinel TypeScript file, run an isolated root build and
   prove the sentinel survives.
5. Inspect wheel/sdist member lists, run `twine check`, install the wheel into a
   clean virtual environment and verify imports/version/dependency metadata.
6. Run Goal detection and `goal --dry-run -a`, then the repository verification,
   SDK examples and governance checks.
7. Record evidence, commit the bounded implementation and submit it through the
   protected exact-head review workflow requested by the user.

## Actual changes

- Updated only governance scope: integration now owns the transaction,
  ticket-018 and ticket-035 are explicit completed dependencies, and the stale
  ticket-018 conflict was removed.
- No package or build metadata changed in this plan commit.
- Added the root `todo2code` PEP 517/621 manifest with an explicit
  `sdk/python` package mapping and no runtime dependencies.
- Added Python to Goal detection/versioning, migrated `make python-wheel` to
  the root manifest, removed the nested manifest and updated SDK commands.
- Built and inspected the wheel and sdist, verified them with Twine, installed
  the wheel in a clean environment and confirmed both public import paths.
- Passed full repository verification, SDK examples and Docker E2E core.
- Detected that Goal 2.1.284 executes publication despite its global
  `--dry-run` flag. The bounded Python artifacts were therefore published as
  PyPI 0.5.1; npm rejected the subsequent operation with `ENEEDAUTH`, and an
  independent lookup found no npm release.

## Blockers

- None for implementation or local validation. Exact-head external review remains
  required before merge.
