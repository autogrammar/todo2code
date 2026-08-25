# Ticket 085: Scope documentation acceptance criteria to their source ticket

- **ID**: ticket-085
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-25

## Goal and scope

Prevent deterministic documentation extraction from treating acceptance
criterion labels such as `AC-01` in every `project/ticket-NNN/**` document as
one repository-wide ticket. Documentation records sourced from a governed
ticket directory inherit that source ticket when their text contains no
stronger ticket reference; criterion labels remain local to the source ticket.

## Acceptance criteria

- [x] AC-01: The human owner requested continued autonomous repair and testing
      of Subactor and its reusable `todo2code` boundary on 2026-08-25.
- [x] AC-02: Records sourced from `project/ticket-101/**` and
      `project/ticket-102/**` bind criterion labels to `TICKET-101` and
      `TICKET-102`, respectively, instead of the global topic `AC-01`.
- [x] AC-03: A real non-criterion ticket reference in ticket documentation
      remains authoritative and is not replaced by the source ticket.
- [x] AC-04: Focused, full Node, governance and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

The user's repeated instruction to continue implementing, testing and improving
Subactor autonomy authorizes this bounded reusable defect repair. Protected
exact-head Validator evidence remains required before merge.

## Non-goals

- No scoring, authority, mutation or comparison-threshold change.
- No global weakening of ticket extraction.
- No public schema or dependency change.

## Verification evidence

- Focused deterministic documentation suite: 6/6 passed.
- Full `npm run verify`: 424 passed, one existing JDK-only skip, zero failures.
- `make docker-smoke`: passed.
- Governance and `git diff --check`: zero errors and zero warnings.
