# Ticket 070: Default programmatic pipelines to LLM-first

- **ID**: ticket-070
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: WAIT_FOR_DEPENDENCIES
- **Created**: 2026-08-11

## Goal and scope

Align programmatic `PipelineOptions`, MCP/A2A and service-action defaults with
the CLI LLM-first profile: omitted task synthesis should request an audited LLM
unless the caller explicitly selects offline behavior. Preserve explicit modes,
fail-closed contracts, provenance and deterministic authority boundaries.

## Acceptance criteria

- [x] AC-01: The human explicitly requires LLM wherever it can improve a
  todo2code result.
- [ ] AC-02: Omitted programmatic/service task mode resolves to the LLM-first
  policy with an explicit offline escape hatch.
- [ ] AC-03: MCP and A2A schema descriptions state the effective default and
  do not misreport `disabled`.
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
