# Ticket 090: Hermetic test routing for SubLLM default

- **ID**: ticket-090
- **Owner**: founder
- **Status**: ACTIVE
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-26

## Goal and scope

Keep the unit and gold-evaluation suites deterministic after ticket-089 makes
SubLLM the production default. The test command must explicitly select the
legacy fixture transport, while SubLLM bridge tests opt in independently and
continue to exercise direct Z.AI GLM 5.3.

The Founder explicitly authorized continuation and repair. `--force-new` was
used because stale ticket-054 still reserves the integration workstream in its
publication phase but has no open pull request.

## Acceptance criteria

- [x] AC-01: Scope is approved by the Founder in the originating request.
- [x] AC-02: `npm test` has a hermetic `T2C_USE_SUBLLM=false` environment.
- [x] AC-03: SubLLM bridge tests explicitly opt in and still verify direct Z.AI GLM 5.3.
- [x] AC-04: Full local Node 22 verification passes (429 passed, 1 skipped, 0 failed); hosted verification is publication evidence.

## Participants

- Human participant: Founder approval captured in the originating request; no user-* file was created.
- Agent participant: [ai-antigravity.md](ai-antigravity.md)
