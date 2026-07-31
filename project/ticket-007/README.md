# Ticket 007: Explicit unresolved response routing

- **ID**: ticket-007
- **Owner**: tom-sapletta-com
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Ensure every communication divergence names a concrete respondent or an
explicit unresolved-role sentinel. The measured regression case is ticket-006:
an agent-only ticket correctly requires a human response but currently emits
an empty `responseRequiredFrom` array.

Executable implementation belongs in `src/`, regression coverage in `test/`
and public behavior documentation in `docs/`. This directory contains only
governance, decisions, logs and captured evidence.

## Acceptance criteria

- [x] AC-01: `responseRequiredFrom` is never empty for a communication issue.
- [x] AC-02: A missing human respondent is represented as
  `unresolved:human`; a missing agent respondent as `unresolved:agent`.
- [x] AC-03: Known participant IDs retain priority and are never replaced by a
  sentinel.
- [x] AC-04: Rendering and diagnostic projection expose the sentinel without
  converting it into an identity claim.
- [x] AC-05: Tests reproduce an agent-only ticket and cover both resolved and
  unresolved routing.
- [x] AC-06: No `user-*` file or participant registry entry is created by the
  agent.
- [x] AC-07: Full offline verification and gold evaluation pass.
- [x] AC-08: No executable source is stored under `project/ticket-007`.

## Non-goals

- Guessing a person from repository ownership, display names or Git history.
- Dispatching an external notification.
- Creating human-owned governance evidence from the agent process.
- Changing communication severity or semantic conflict detection.

## Participants

- Human scope: current conversation; no agent-authored `user-*` file.
- [`ai-codex.md`](ai-codex.md)

## Approval

- **Decision**: approved to continue subsequent todo2code tickets
- **Evidence**: current user instruction
- **Date**: 2026-07-31

The agent records the existence of the instruction but does not materialize it
as human-authored participant content.

## Evidence

- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
- [`changelog.md`](changelog.md)

## Conclusion

Issue construction now fills an otherwise empty route with a role-specific
sentinel. The real ticket-006 audit changed three human-required issues from an
empty list to `unresolved:human`; no participant was inferred. Offline tests,
both gold versions and all five SDK examples pass.
