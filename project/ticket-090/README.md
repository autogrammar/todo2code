# Ticket 090: Hermetic test routing for SubLLM default

- **ID**: ticket-090
- **Owner**: agent:codex under SESSION_EXECUTION_AUTHORIZATION
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-26

## Goal and scope

Keep unit and gold-evaluation suites deterministic when production uses
SubLLM. The default test command explicitly selects the compatibility fixture
transport, while SubLLM bridge tests opt in independently and continue to
exercise direct Z.AI GLM 5.3.

## Acceptance criteria

- [x] AC-01: Scope is approved by the Founder in the originating request.
- [x] AC-02: `npm test` has a hermetic `T2C_USE_SUBLLM=false` environment.
- [x] AC-03: SubLLM bridge tests explicitly opt in and still verify direct Z.AI GLM 5.3.
- [x] AC-04: Full Node and governance verification passes before publication.

## Participants

- Human participant: Founder approval captured in the originating request; no user-* file was created.
- Agent participant: [ai-codex.md](ai-codex.md)
