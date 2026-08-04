# Ticket 027: Repair current code-change helper narrowing

- **ID**: ticket-027
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-04

## Goal and scope

Restore strict TypeScript narrowing in the split code-change implementation
helper. Reuse the arrays already validated by the preceding schema function and
normalize the bounded edit-path split to a definite string. Runtime validation
and patch semantics remain unchanged.

## Acceptance criteria

- [x] AC-01: The human instructed the agent to continue iterative repair.
- [ ] AC-02: Review patch plan collections are compared only after validated
      string-array narrowing.
- [ ] AC-03: Edit-path comparison supplies a definite `string[]` without
      dropping or inventing paths.
- [ ] AC-04: Complete check and code-change tests pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- The user's `kontynuuj` authorizes this exact LLM/synthesis helper repair;
  protected review remains required for merge.
