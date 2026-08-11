# Ticket 069: Prevent same-source LLM self-conflicts

- **ID**: ticket-069
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: WAIT_FOR_DEPENDENCIES
- **Created**: 2026-08-11

## Goal and scope

Prevent alternate extractions of the same source span from contradicting one
another solely because deterministic and LLM converters assigned opposite
polarity. The linker must retain real conflicts between independent statements
while recognizing overlapping same-source evidence as extraction variants.

## Acceptance criteria

- [x] AC-01: A scoped live six-stage LLM run demonstrates five false blocking
  conflicts between identical or overlapping source lines.
- [ ] AC-02: A focused regression fails before the fix for deterministic/LLM
  variants and communication/document variants of one source span.
- [ ] AC-03: Same-source variants cannot create `CONFLICTING_INTENT` merely due
  to alternate polarity extraction.
- [ ] AC-04: Distinct source statements with genuine opposite intent still
  produce a blocking conflict.
- [ ] AC-05: Gold, focused, full, governance and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Authorization and blocker

The user authorized LLM-first todo2code behavior. This measured quality defect
must be fixed before widening programmatic LLM defaults. Implementation is
blocked because remote ticket-059 is `IN_PROGRESS / VALIDATION` and reserves
the `core-dsl` workstream.
