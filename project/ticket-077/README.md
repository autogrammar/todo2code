# Ticket 077: DSL manifest for wellmanifest/dsl conformance

- **ID**: ticket-077
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-15

## Goal and scope

Declare `t2c.intent/v1` as a governed DSL by creating a `dsl-manifest.json`
at the repository root, conformant with `wellmanifest.dsl/manifest/v1`.

The manifest binds the existing JSON Schema artifacts (`schemas/intent-record.schema.json`,
`schemas/intent-graph.schema.json`) and documentation (`docs/DSL.md`) with
SHA-256 digests, declares the 17-action command vocabulary, and sets the
LLM boundary to `bidirectional` with `propose-only` model authority.

This ticket owns only `dsl-manifest.json` at the repository root. Command
pages under `docs/<COMMAND>.md` and error/critical catalogs under
`docs/ERROR/` and `docs/CRITICAL/` are deferred to a separate ticket in
the `integration` workstream when it becomes available.

## SESSION_EXECUTION_AUTHORIZATION

Recorded by `devin` from user message "kontynuuj" (2026-08-14). The agent
moves to EDIT without a second confirmation, staying inside `intent.json`
`allowedPaths`.

## Acceptance criteria

- [x] AC-01: `dsl-manifest.json` exists at repository root
- [x] AC-02: Manifest passes `wellmanifest/dsl` schema validation
- [x] AC-03: All declared artifacts have correct SHA-256 digests
- [x] AC-04: Command vocabulary matches `intent-record.schema.json` action enum
- [x] AC-05: LLM boundary declared as `bidirectional` with `propose-only` authority
- [x] AC-06: `findingPolicy` and `publicationPolicy` declared
- [x] AC-07: `dsl_check.py validate` passes
- [x] AC-08: `governance-check.sh` passes

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-devin.md](ai-devin.md)

## Closure evidence

The declared `dsl-manifest.json` and its governed manifest binding are present
on protected `main@a93944f51d47fbf8fe1f3aaea03f17f4fb472d80`; every recorded
acceptance criterion is complete. This stale active projection is closed before
allocating the bounded governance reconciliation ticket.
