# Preprompt and technical directives (ticket-003)

- **Task title**: Residual changelog diagnostic audit
- **Created**: 2026-07-31
- **Governance source**: `wellmanifest/new-project`

## Requirements

1. Continue the iterative external-repository hardening from ticket-002.
2. Reproduce the current residual changelog findings on the same seven commits.
3. Select the review sample deterministically, without LLM labeling.
4. Preserve sampled text, targets and source identity in a portable artifact.
5. Distinguish real unsupported release claims from diagnostic false positives.
6. Require cross-repository repetition and a hard negative before code changes.
7. Measure each retained change independently and reject unsafe hypotheses.
8. Keep external repositories and unrelated workspace changes untouched.

## Referenced evidence

- `project/ticket-002/baseline.json`
- `project/ticket-002/iteration-01.json`
- `project/ticket-002/iteration-01.md`
- `docs/READINESS.md`
- `evaluation/gold/v2/dataset.json`

## Approval boundary

The user's `kontynuuj` message followed the explicit recommendation to place
the residual changelog audit in a separate ticket. It approves this recorded
scope; unrelated `new-project` implementation remains outside the ticket.
