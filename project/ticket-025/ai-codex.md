---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-025
---
# Participant: codex (AI agent)

## Understanding

Strict checking after core/interface recovery found two extractor split defects:
readonly literal tuples reject a general string in `includes`, and the markdown
batch constant moved to a helper without being re-exported from the established
module boundary.

## Execution plan

1. Record the exact two-module extractor scope.
2. Preserve type-guard narrowing through readonly string membership.
3. Re-export the existing batch constant without duplicating it.
4. Run check, focused markdown/NL tests and governance.
5. Preserve declared Git authors separately from the registry-owned metadata
   value used on emitted records.
6. Update the stale deterministic documentation release assertion to `0.5.2`;
   route confidence coverage to its owning LLM ticket.

## Actual changes

- Plan completed and the user-authorized repair entered `EDIT`.
- Aggregate test failures identified the exact three same-workstream
  follow-ups above; the user's continuing test-and-repair instruction remains
  the interactive approval boundary.
- Focused tests passed, but governance correctly classified
  `test/nl-llm.test.ts` under `llm`; ticket-025 no longer claims that path.

## Blockers

- None after the user's continuation instruction; merge review is external.
