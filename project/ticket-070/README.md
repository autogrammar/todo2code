# Ticket 070: Default programmatic pipelines to LLM-first

- **ID**: ticket-070
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: WAIT_FOR_DEPENDENCIES
- **Created**: 2026-08-11

## Goal and scope

Align direct programmatic `PipelineOptions` and service-action defaults with the
user-facing LLM-first profile: omitted task synthesis should request an audited
LLM unless the caller explicitly selects offline behavior. MCP/A2A normalization
and discovery are delivered by their owning interfaces ticket-068. Preserve
explicit modes, fail-closed contracts, provenance and deterministic authority
boundaries.

## Acceptance criteria

- [x] AC-01: The human explicitly requires LLM wherever it can improve a
  todo2code result.
- [ ] AC-02: Omitted programmatic/service task mode resolves to the LLM-first
  policy with an explicit offline escape hatch.
- [x] AC-03: The owning ticket-068 normalizes MCP/A2A inputs and states their
  effective defaults; this runtime ticket does not edit interface-owned paths.
- [ ] AC-04: Provider absence or invalid output remains audited and fail-closed
  under `require-llm`; `prefer-llm` remains visibly degraded.
- [ ] AC-05: Pipeline/service regressions, full, governance and Docker checks
  pass after ticket-069 removes same-source false blocking conflicts.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Authorization and blockers

The user authorized the LLM-first behavior. Implementation remains blocked
because remote ticket-061 is `IN_PROGRESS / VALIDATION` in the runtime
workstream and owns `test/pipeline.test.ts`. It also depends on ticket-069 so a
broader default does not amplify false blocking conflicts.
