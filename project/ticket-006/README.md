# Ticket 006: Canonical structured-output conformance

- **ID**: ticket-006
- **Owner**: tom-sapletta-com
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Make structured LLM responses fail with precise, auditable contract diagnostics
and remove drift between the response schema sent to a provider, the published
JSON Schema and runtime validation. Start with the experimental semantic
reranker because ticket-005 measured three different provider violations on a
tracked repository.

Executable implementation belongs in `src/`, regression coverage in `test/`
and optional live reproducers in `scripts/research/`. This ticket directory is
limited to governance, decisions, logs and captured evidence.

## Acceptance criteria

- [x] AC-01: One canonical structural definition supplies or verifies the
  provider response schema, published JSON Schema and TypeScript-facing shape.
- [x] AC-02: Runtime validation reports the exact failing property and response
  identity without persisting source payloads or secrets.
- [x] AC-03: Wrong envelope names, missing decisions, string/percent confidence,
  unknown fields and invalid verdict/reason combinations fail closed.
- [x] AC-04: No implicit coercion and no fallback to raw retrieval; any
  corrective retry is bounded, audited and retains both response identities.
- [x] AC-05: Offline tests cover conforming and non-conforming providers without
  network access.
- [x] AC-06: A clean tracked-repository live check compares at least two
  explicitly identified provider/model routes before any production retention.
- [x] AC-07: The deterministic linker, CLI, MCP and A2A remain unchanged unless
  the quality and privacy gates pass.
- [x] AC-08: Full verification, both gold versions, examples, dependency audit
  and smoke gates pass.
- [x] AC-09: No executable source is stored under `project/ticket-006`.

## Non-goals

- Accepting provider output by renaming fields or coercing values.
- Lowering evidence or citation requirements.
- Enabling semantic reranking by default.
- Editing a human-owned participant file from the agent process.

## Participants

- Human scope: current conversation; no agent-authored `user-*` file.
- [`ai-codex.md`](ai-codex.md)

## Evidence

- [`preprompt.md`](preprompt.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
- [`changelog.md`](changelog.md)
- [`../ticket-005/audit.md`](../ticket-005/audit.md)

## Approval

- **Decision**: approved to investigate and continue subsequent todo2code
  tickets
- **Evidence**: current user instruction
- **Date**: 2026-07-31

The agent deliberately does not materialize that decision as a human-authored
participant file. A human or trusted intake boundary must do so.

## Conclusion

The conformance hardening is retained; semantic production enablement remains
rejected. The provider schema, runtime validator and TypeScript shape now share
one internal definition, while full verification checks it against the
published result schema. Diagnostics identify the exact property plus provider,
resolved model and response ID without retaining the raw response.

Neither tested route met the contract. `qwen/qwen3.7-plus` produced three
different envelope/type violations in ticket-005.
`qwen/qwen3.7-flash` added the forbidden property
`response.decisions[0].decision`. Both failed before graph mutation. No
reranker was exported or enabled.
