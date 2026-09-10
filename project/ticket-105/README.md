# Ticket 105: Integrate the canonical merge conflict evidence contract

- **ID**: ticket-105
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-10

## Goal and scope

Integrate the merge-conflict fact data introduced by PR #125 as an explicit
public data contract owned by the integration workstream. Preserve the existing
extractor and t2c.intent/v1 wire format, and add a typed projection plus a CI
contract check against real extraction and JSON round-tripping. The records are
observed marker syntax, never Git-index verification or merge authorization.

SESSION_EXECUTION_AUTHORIZATION: the user requested continuation of the
publication-protection and data-contract repair, push, independent merge and
tests. Do not rewrite the already merged ticket-104 or claim its failed
governance run passed. Validator profile strengthening is owned separately by
subactor/validator-agent issue #437 and must be deployed before this publication.

## Acceptance criteria

- [x] AC-01: The additive public conflict-fact type and positive/negative contract tests bind the existing data without changing extraction behavior.
- [ ] AC-02: Local verification, smoke and Docker smoke pass; strengthened independent publication and fresh main CI pass.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
