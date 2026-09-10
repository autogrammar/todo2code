# Ticket 102: Adopt published integration validation base fix

- **ID**: ticket-102
- **Owner**: agent:openai
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-10

## Goal and scope

Adopt the independently merged fix from wellmanifest/new-project ticket-210
using its immutable published revision. Preserve target ownership, packaging
bindings, Docker requirements, protected tests and independent review.

SESSION_EXECUTION_AUTHORIZATION: user continuation on 2026-09-10 authorizes
this bounded adoption, tests and protected publication, not self-approval.
The upstream fix was independently merged as PR 319, source revision
`d1f35ed1b8be60f50a6739984c947a30379ead5b`, and is bound in intent.json.

## Acceptance criteria

- AC-01: Adopt the exact published source through the managed generator; no
  hand-edited managed checksums, unrelated code or generated reports.
- AC-02: Governance, verification and Docker smoke tests pass; independently
  merge the exact PR head and observe the post-merge main CI result.

## Risk

The original default-branch gate falsely combined historical merged tickets.
Preserve all required checks and observe a fresh main run after merge.
Primary-checkout dirty work remains outside this publication.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
