# Ticket 015: Preserve compound intent in code-change titles

- **ID**: ticket-015
- **Owner**: agent:codex
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Prevent a secondary verb in a compound TODO from producing lossy and duplicated
code-change titles such as `Implement Implement ... and it ...`.

Runtime implementation belongs under `src/`; this directory contains only the
ticket contract and redacted evidence.

## Acceptance criteria

- [x] A regression test reproduces the title emitted by the Koru PLF-003 flow.
- [x] The title preserves both the leading action and the secondary clause.
- [x] Ordinary concise object titles remain unchanged.
- [x] Focused tests, the real deterministic fixture and all repository gates pass.

## Participants

- Technical evidence/fix owner: [`ai-codex.md`](ai-codex.md).
- No human response is required; the source intent is unambiguous and unchanged.

## Evidence

- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
