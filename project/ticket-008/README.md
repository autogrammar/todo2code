# Ticket 008: Cross-repository governance standard hardening

- **ID**: ticket-008
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Upstream the measured todo2code governance findings into
`wellmanifest/new-project`: keep human and agent intent separately typed, make
missing ownership explicit, prevent executable code in ticket directories and
avoid collisions between ticket indexes and generated analysis artifacts.

Implementation belongs to the governance hub's policies, templates, scripts
and tests. This ticket directory contains only governance and captured evidence.

## Acceptance criteria

- [x] AC-01: The target standard never auto-creates `user-*` for an agent.
- [x] AC-02: Agent plans carry explicit participant ID, role, ticket and typed
  sections understood by todo2code.
- [x] AC-03: Missing human ownership remains `unresolved:human` and produces a
  non-empty response route during communication analysis.
- [x] AC-04: Ticket indexing uses `project/TICKETS.md` and preserves an
  analysis-owned `project/README.md`.
- [x] AC-05: A second ticket is rejected while an unfinished ticket exists.
- [x] AC-06: Traversal and malformed CLI arguments fail closed.
- [x] AC-07: Ticket directories are documented as governance/evidence only.
- [x] AC-08: Isolated shell tests and the todo2code integration check pass.
- [x] AC-09: Changes are committed and pushed to both `main` branches.

## Participants

- Human scope: current conversation; no agent-authored `user-*` file.
- [`ai-codex.md`](ai-codex.md)

## Evidence

- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
- Upstream commit: `wellmanifest/new-project@72e5f6c`

## Conclusion

The upstream 0.6.0 standard now matches the ownership behavior measured by
todo2code. Its generated agent plan is parsed as agent intent, it invents no
human participant, and the missing approval owner is routed as
`unresolved:human`. The hub itself remains free of task tickets.
