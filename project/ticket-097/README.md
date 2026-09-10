# Ticket 097: Explicit canonical configuration input paths

- **ID**: ticket-097
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-10

## Goal and scope

Expose explicit configuration input paths through the existing canonical
config2dsl parser while preserving repository boundaries, ignored files and
record identity. The user requested continued publication, protected merge and
tests on 2026-09-10. PR #119 supplies the published compact governance baseline;
the accepted base is its observed merge c0d8abdcdf6ed8ffba9b2336507f842bd06e6686.

## Acceptance criteria

- [ ] AC-01: Explicit configuration paths preserve canonical records and reject invalid boundaries.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Bounded implementation intent

SESSION_EXECUTION_AUTHORIZATION: wykonaj zadania; prior push and protected merge authorization persists. Add optional explicit configuration paths to canonical config2dsl so preallocated governance JSON can be represented without uploading original files. Keep conventional discovery and ignore policy. Reject traversal, absolute paths, unsupported formats and oversized path inventories.
