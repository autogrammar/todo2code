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
`pip wheel ./sdk/python` to the repository root. `Makefile` is currently in the
allowed scope of active governance ticket-018; editing it from ticket-019 would
violate the non-overlap contract.

## Execution plan

1. Obtain explicit human approval for ticket-019 and resolve the Makefile scope
   conflict with ticket-018.
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
7. Record evidence without publishing, committing or pushing unless separately
   requested.

## Actual changes

- None; waiting for approval.

## Blockers

- Human approval is required before implementation.
- Active ticket-018 currently claims `Makefile`; ticket-019 cannot safely
  migrate `make python-wheel` until that overlap is released or routed through
  an approved integration ticket.
