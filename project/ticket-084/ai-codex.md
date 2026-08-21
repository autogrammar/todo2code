---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-084
---
# Participant: codex (AI agent)

## Understanding

The compare-workspace handler parses markdown and communication modes but not
`--nl-mode`. The comparison then receives ambient `config.nlMode`, so an
operator's explicit deterministic request is ignored and a task file can fail
closed for a missing provider credential. The comparison API itself already
uses configuration consistently; the missing boundary is the CLI adapter.

## Execution plan

1. Add a CLI fixture whose ambient NL mode requires LLM and whose command line
   explicitly selects deterministic mode.
2. Pass the parsed mode in a command-scoped configuration object.
3. Document the option in help and run repository verification.

## Actual changes

- Read governance and the CLI/comparison boundary, reproduced the ignored flag,
  and recorded explicit approval before implementation.
- Passed the parsed NL mode through a command-scoped comparison config and
  documented the option in command help.
- Added a real Git/CLI regression and passed focused, full Node and Docker
  verification.
- Transitioned to `IN_PROGRESS / PUBLICATION`; no merge is claimed locally.

## Blockers

- None for implementation; protected publication remains independent.
