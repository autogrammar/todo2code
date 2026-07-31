# Preprompt and technical directives (ticket-005)

- **Task title**: Audited cross-language reranking
- **Created**: 2026-07-31
- **Governance source**: `wellmanifest/new-project`

## Requirements

1. Use retrieval only to produce a bounded shortlist.
2. Require a separate structured decision with explicit abstention.
3. Ground every accepted decision in repository-owned records, paths, symbols
   or capability terms.
4. Preserve exact-target precedence and the deterministic offline linker.
5. Record provider/model/revision, input hashes, scores and cited evidence.
6. Cache model-derived output by content and model identity.
7. Evaluate tracked snapshots only; never transmit untracked or private data.
8. Reject the approach unless it clears gold and real-repository precision
   gates.
9. Store executable source outside `project/ticket-*`.

## Referenced evidence

- `project/ticket-004/iteration-01.md`
- `project/ticket-004/audit.md`
- `evaluation/gold/v2/dataset.json`
- `src/graph/linker.ts`
- `src/core/text.ts`
- `docs/READINESS.md`

## Approval boundary

Initialization records the user's request to continue, but implementation waits
for review of `README.md` and `ai-codex.md` as required by `P-CORE-008`.
