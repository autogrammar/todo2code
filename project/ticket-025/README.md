# Ticket 025: Repair current extractor split contracts

- **ID**: ticket-025
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-04

## Goal and scope

Repair two extractor regressions introduced by the current helper splits:
preserve the literal-union type guards for NL action/modality membership, and
retain the public `MARKDOWN_LLM_BATCH_RECORDS` export expected by the existing
batching contract. No behavior, batch size or LLM policy changes are in scope.

Aggregate tests exposed three follow-ups in the same extractor workstream: the
communication split compares the registry's Git authors with itself instead
of the declared front-matter value, the confidence-contract test still reads
the pre-split module files, and the deterministic documentation test still
expects release `0.5.0` instead of canonical `0.5.2`.

## Acceptance criteria

- [x] AC-01: The human instructed the agent to continue iterative repair.
- [ ] AC-02: NL action/modality guards narrow strings without unsafe runtime
      acceptance.
- [ ] AC-03: The markdown batching constant remains exported from the public
      extractor module and its tests compile.
- [ ] AC-04: Focused extractor tests and aggregate verification pass.
- [ ] AC-05: Registry alignment compares declared Git authors with the
      canonical registry entry and emits the established mismatch warning.
- [ ] AC-06: Deterministic documentation asserts canonical release `0.5.2`;
      confidence hierarchy coverage is routed to its owning LLM ticket.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- The user's `kontynuuj` instruction authorizes this exact extractor repair;
  protected review remains required for merge.
