# Ticket 104: Preserve canonical conflict evidence during code extraction

- **ID**: ticket-104
- **Owner**: human:founder
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-10

SESSION_EXECUTION_AUTHORIZATION: napraw, zmerguj, przetestuj; continue the remaining autonomy acceptance through protected publication.

## Goal and scope

A Python file containing a complete merge conflict currently produces zero canonical records and cannot be edited through SubLLM. Add source-bound conflict facts using the existing DSL contract and ignore/size boundaries. A marker block is observed evidence, not proof of Git index state or authority to pick a side.

## Acceptance criteria

- [x] AC-01: Standard and diff3 blocks retain exact source ranges, stable identity and observed provenance even when AST parsing fails.
- [x] AC-02: Malformed or nested blocks fail closed; ignored, binary and oversized files cannot become fallback context.
- [ ] AC-03: Existing verification passes; an independently merged extractor is qualified through SubLLM with source-hash guarded edits and a negative stale-source case.

Cross-repository evidence belongs in the [canonical autonomy receipt](https://github.com/subactor/docs/blob/main/architecture/analysis/autonomy-execution-receipt.md).
