# Ticket 085: Scope governed documentation to its source channel

- **ID**: ticket-085
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-25

## Goal and scope

Prevent deterministic documentation extraction from treating acceptance
criterion labels such as `AC-01` in every `project/ticket-NNN/**` document as
one repository-wide ticket. Documentation records sourced from a governed
ticket directory inherit that source ticket when their text contains no
stronger ticket reference; criterion labels remain local to the source ticket.

Participant-owned `ai-*.md` and `user-*.md` files remain communication input;
the generic documentation extractor must not ingest the same bytes a second
time and manufacture self-conflicts from different heuristic polarity.

## Acceptance criteria

- [x] AC-01: The human owner requested continued autonomous repair and testing
      of Subactor and its reusable `todo2code` boundary on 2026-08-25.
- [x] AC-02: Records sourced from `project/ticket-101/**` and
      `project/ticket-102/**` bind criterion labels to `TICKET-101` and
      `TICKET-102`, respectively, instead of the global topic `AC-01`.
- [x] AC-03: A real non-criterion ticket reference in ticket documentation
      remains authoritative and is not replaced by the source ticket.
- [x] AC-04: Focused, full Node, governance and Docker checks pass.
- [x] AC-05: Governed participant Markdown is emitted only by the communication
      extractor, while ticket README documentation remains in the document
      lane; the `PLF-8091` replay adds no participant self-conflicts.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

The user's repeated instruction to continue implementing, testing and improving
Subactor autonomy authorizes this bounded reusable defect repair. Protected
exact-head Validator evidence remains required before merge.

Live comparison after repairing the graph-size boundary showed that the same
`project/ticket-118/ai-codex.md` paragraphs entered as both `INT-AGENT` and
`INT-DOC`. Different polarity classification created three blocking pairs and
a net `blocking +2`; this is reusable extractor evidence, not a reason to
rewrite the Platform ticket to appease the observer.

## Non-goals

- No scoring, authority, mutation or comparison-threshold change.
- No global weakening of ticket extraction.
- No public schema or dependency change.
- No suppression of ticket README documentation or typed communication.

## Verification evidence

- Focused deterministic documentation suite: 7/7 passed.
- Full `npm run verify`: 425 passed, one existing JDK-only skip, zero failures.
- `make docker-smoke`: passed.
- Governance and `git diff --check`: zero errors and zero warnings.
- Exact `PLF-8091` replay with the graph-ceiling repair loaded the 142,557,246
  byte graph and changed the blocking diagnostic count from 13 to 12
  (`blocking -1`), with no stderr and the pinned base/head SHA preserved.
