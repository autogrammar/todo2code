---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-031
---
# Participant: codex (AI agent)

## Understanding

The observed Subactor run is technically successful and has no blocking
diagnostics, but a Core-only root cannot see managed documentation in the
sibling Docs repository. The first safe change is not to suppress warnings or
guess links. It is to make repository provenance part of record identity while
preserving existing single-repository IDs.

## Execution plan

1. Obtain explicit approval for AC-01..AC-08.
2. Add a pure repository-root canonicalizer under `src/core`.
3. Extend `buildRecord` with optional repository provenance, including it in
   metadata and the ID seed only when explicitly supplied.
4. Add focused compatibility, collision and invalid-root tests.
5. Run the focused test, `npm run verify` and governance attribution checks.
6. Stop at 30 minutes; do not add CLI/pipeline/linker work to this slice.

## Actual changes

- None; waiting for approval.

## Blockers

- Human approval is required before implementation.
- External Docs ingestion and cross-repository linker reconciliation require
  their own dependent tickets after this bounded foundation.
