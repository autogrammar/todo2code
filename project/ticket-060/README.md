# Ticket 060: Use canonical runtime version in documentation extraction test

- **ID**: ticket-060
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-08

## Goal and scope

Replace the literal `0.5.0` in the current documentation-extraction behavior
test with the exported `T2C_VERSION`. The test will continue proving runtime
provenance while no longer preserving a stale release identity.

## Acceptance criteria

- [x] AC-01: A human approves the one-test-file scope.
- [x] AC-02: `test/docs.test.ts` asserts current provenance through
      `T2C_VERSION`, not a copied version string.
- [ ] AC-03: Documentation extraction tests pass with ticket-059's runtime
      correction and no historical fixture is changed.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md).

## Approval gate

The human approved tickets 059–063 and transition to `EDIT` after dependencies
on 2026-08-09. Ticket-058 remains the integration coordinator, not an
unfinished implementation prerequisite.

## Non-goals

- No extractor behavior, source, fixture, dependency or Docker change.
- No replacement of historical version evidence.
