# Ticket 014: Distinguish path presence from implemented intent

- **ID**: ticket-014
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Prevent a TODO capability from becoming `aligned` merely because its declared
target file already contains unrelated AST facts. Compare the semantic intent
(action/object/topics/symbol) with evidence inside the target before claiming
implementation, then expose unresolved ambiguity to the appropriate human or
agent instead of silently choosing.

Runtime implementation belongs under `src/`; this directory contains only the
ticket contract and redacted evidence.

## Acceptance criteria

- [x] AC-01: A real fixture reproduces the false alignment: retry/backoff aimed
  at an existing queue file produces no `PLANNED_NOT_IMPLEMENTED` plan.
- [x] AC-02: Gold contains the existing-path/unrelated-capability case and a
  positive existing-path/implemented-capability control.
- [x] AC-03: Path evidence alone cannot close a capability-bearing declaration;
  a symbol or sufficiently specific topic match is also required.
- [x] AC-04: Ambiguous evidence abstains and names who must answer; runtime never
  edits a human-owned `user-*` record to manufacture consent.
- [x] AC-05: Koru discovery creates tickets only for remaining grounded gaps,
  and re-analysis closes the targeted diagnostic after a verified patch.
- [x] AC-06: Gold, full verification and cross-repository regression pass.

## Participants

- Human policy owner: `unresolved:human` only when ambiguity or autonomous-risk
  policy needs a decision.
- Technical evidence/fix owner: [`ai-codex.md`](ai-codex.md).

## Evidence

- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
