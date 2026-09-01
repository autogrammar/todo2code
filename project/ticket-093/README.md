# Ticket 093: Split workspace comparison into focused modules

- **ID**: ticket-093
- **Owner**: Founder session (STARTER-066 / Koru decide)
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-01

## Goal and scope

Split `src/comparison/workspace.ts` (~508 lines) into focused modules for
deadline policy, trend reporting, and git/pipeline helpers. Keep `workspace.ts`
as the stable public import surface (STARTER-066).

## Acceptance criteria

- [ ] AC-01: Session execution authorization for autonomous refactor delivery.
- [ ] AC-02: `workspace.test.ts` passes unchanged behavior.
- [ ] AC-03: `workspace.ts` facade ≤ 200 lines; helpers in `workspace-*.ts`.

## Participants

- Human participant: user:tom via session authorization.
- Agent participant: [ai-cursor.md](ai-cursor.md)
