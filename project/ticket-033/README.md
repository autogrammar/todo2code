# Ticket 033: Restore communication prompt resolution after module split

- **ID**: ticket-033
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-04

## Goal and scope

Restore runtime resolution of `communication-to-intent.system.md` after the
communication LLM implementation moved one directory deeper. The copied path
logic still climbs three levels, which resolves from
`dist/src/communication/llm` to `dist/prompts`; repository prompts live at the
root `prompts` directory, requiring four levels from the compiled helper.

The repair changes only the relative prompt root in the helper. It will not
copy prompts into `dist`, change provider fallback behavior, weaken
`require-llm`, edit tests or contact a live provider. One production file is
allowed and expected implementation time is under 30 minutes.

## Planned changed paths

- `src/communication/llm/implementation-helpers.ts`: correct the prompt root
  for the module's new filesystem depth.
- `project/ticket-033/**`, `TODO.md`, `project/TICKETS.md`: intent and evidence.

## Acceptance criteria

- [x] AC-01: Scope is approved by a human owner.
- [ ] AC-02: The communication prompt resolves from both compiled test/runtime
      execution without relying on stale artifacts.
- [ ] AC-03: Both audited communication enrichment tests pass using their
      mocked provider and no live request.
- [ ] AC-04: `require-llm` and correction validation behavior remain strict.
- [ ] AC-05: Clean build, focused/full tests, diff scope and governance evidence
      are recorded without changing tests or prompt contents.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- Current state: `IN_PROGRESS / EDIT` after explicit chat approval.
- Chat approval authorizes this interactive implementation only; trusted merge
  evidence must remain independent and bound to the final SHA.
