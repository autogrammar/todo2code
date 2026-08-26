# Ticket 089: Use public SubLLM direct Z.AI GLM 5.3

- **ID**: ticket-089
- **Owner**: agent:codex under SESSION_EXECUTION_AUTHORIZATION
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-26

## Goal and scope

Make the public `subactor/subllm` policy the default route for every semantic
LLM request. The central policy selects direct Z.AI GLM 5.3. Keep the legacy
OpenRouter path only behind an explicit `T2C_USE_SUBLLM=false` compatibility
override; never silently bypass a requested or default SubLLM route.

## Acceptance criteria

- [x] AC-01: Scope is explicitly approved by the Founder in the originating request.
- [x] AC-02: SubLLM is enabled when no routing environment variable is set.
- [x] AC-03: The resolved direct Z.AI route uses `glm-5.3` and the public Todo2code repository URL.
- [x] AC-04: `T2C_USE_SUBLLM=false` remains the only explicit compatibility opt-out.
- [x] AC-05: The repository verification suite passes before publication.

## Participants

- Human participant: Founder approval captured in the originating request; no user-* file was created.
- Agent participant: [ai-codex.md](ai-codex.md)
