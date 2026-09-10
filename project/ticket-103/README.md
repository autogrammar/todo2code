# Ticket 103: Adopt repeated published adoption validation

- **ID**: ticket-103
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-10

## Goal and scope

Adopt published wellmanifest/new-project 0.20.22 at
`dc2240c22d49391845fef07f32664f37b904504f`, independently merged in source PR 320.
The previous main run failed governance because a fresh published clone retained
multiple historical adoption tickets without local terminal receipts. The
upstream regression covers repeated adoptions while preserving explicit bases,
clean-published-head checks and conservative handling of ambiguous targets.

SESSION_EXECUTION_AUTHORIZATION: the user authorized the isolated 0.20.22 release
and continuation through green CI. This authorizes the bounded adoption, tests,
ticket-branch push and independent protected review/merge; it is not a review
receipt or permission to bypass a required check.

Change only the generated adoption payload and exact workflow/package bindings.
Preserve runtime features, historical ticket prose, generated reports and other
sessions' dirty changes. Raw logs and receipts remain outside Git.

## Acceptance criteria

- [x] AC-01: The immutable 0.20.22 adoption and target-owned revision bindings pass the managed gate.
- [ ] AC-02: Local verify, smoke and Docker smoke pass; independent exact-head review/merge and fresh main CI succeed.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
