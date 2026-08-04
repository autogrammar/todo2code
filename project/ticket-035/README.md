# Ticket 035: Own the Python publication transaction in integration

- **ID**: ticket-035
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-04

## Goal and scope

Make the already planned ticket-019 publication transaction governable. The
transaction spans the root Python manifest, Goal metadata, the Make target and
two Python SDK metadata files. Those paths currently belong to three separate
workstreams, so no single active ticket can own the complete atomic change.

Extend the existing `integration` workstream with only those five publication
paths and classify them as integration-required shared contracts. Refresh the
adoption lock with the pinned `wellmanifest/new-project` generator; do not
change the standard version or source revision.

## Planned changed paths

- `.governance/manifest.json`: add the bounded Python publication paths to the
  existing integration ownership and shared-contract list.
- `.governance/manifest.lock.json`: record the new target-specific manifest
  digest while retaining the published standard provenance.
- `TODO.md`, `project/TICKETS.md`, `project/ticket-035/**`: governance evidence.

## Acceptance criteria

- [x] AC-01: The current user instruction authorizes creating and executing
      this bounded prerequisite; it is not treated as merge approval.
- [x] AC-02: Integration owns exactly `pyproject.toml`, `goal.yaml`, `Makefile`,
      `sdk/python/pyproject.toml` and `sdk/python/README.md` in addition to its
      existing paths.
- [x] AC-03: All five paths are integration-required shared contracts, so an
      SDK or governance ticket cannot silently modify part of the publication
      transaction.
- [x] AC-04: The lock retains standard `wellmanifest/new-project` version
      `0.10.0` and source revision `9706e63d5f121323e9087d0db47a16acdbd276bb`.
- [x] AC-05: The deterministic governance gate passes with zero errors and
      warnings, including a simulated active ticket-019 ownership check.
- [x] AC-06: No runtime source, package metadata or publication command changes
      in this prerequisite ticket.

## Approval boundary

The user's instruction to create task proposals, save them to TODO/tickets and
execute them authorizes the next implementation commit. Protected merge still
requires an exact-head external approval.

## Validation

- Real branch governance: PASS, 0 errors and 0 warnings.
- Simulated active ticket-019 with all five implementation paths and
  `workstream: integration`: PASS, 0 errors and 0 warnings.
- Adoption preview before refresh reported exactly one update:
  `.governance/manifest.lock.json`.
- `git diff --check`: PASS.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md)
