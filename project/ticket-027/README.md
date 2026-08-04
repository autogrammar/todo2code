# Ticket 027: Repair current code-change helper narrowing

- **ID**: ticket-027
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-04

## Goal and scope

Restore strict TypeScript narrowing in the split code-change implementation
helper. Reuse the arrays already validated by the preceding schema function and
normalize the bounded edit-path split to a definite string. Runtime validation
and patch semantics remain unchanged.

Aggregate verification also showed that the confidence hierarchy test still
reads the pre-split extractor entry modules. Because `test/nl-llm.test.ts` is
owned by the LLM workstream, this ticket points that coverage at the helper
modules where the unchanged confidence ceilings now live.

## Acceptance criteria

- [x] AC-01: The human instructed the agent to continue iterative repair.
- [x] AC-02: Review patch plan collections are compared only after validated
      string-array narrowing.
- [x] AC-03: Edit-path comparison supplies a definite `string[]` without
      dropping or inventing paths.
- [x] AC-04: Complete check and code-change tests pass.
- [x] AC-05: Confidence hierarchy coverage reads the split Markdown/NL helper
      modules and continues to enforce the documented 0.94 > 0.90 > 0.85
      ceilings.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- The user's `kontynuuj` authorizes this exact LLM/synthesis helper repair;
  protected review remains required for merge.
