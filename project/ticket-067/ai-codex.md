---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-067
---
# Participant: codex (AI agent)

## Understanding

The user is correcting an operator failure: an available semantic LLM must not
be disabled merely to make a run deterministic. The durable rule must prefer
LLM where it adds interpretation, but it must not turn model output into facts
or accept invalid structured responses.

## Execution plan

1. Map current LLM defaults and explicit opt-outs across CLI and services.
2. Run a full live pipeline with all six semantic LLM stages.
3. Record any provider/quality failure instead of weakening the contracts.
4. Add a bounded LLM-first operating rule to the public README.
5. Validate governance, links and the bounded diff.

## Actual changes

- Confirmed a configured OpenRouter provider without reading or logging its
  credential.
- Ran a full `require-llm` pipeline twice. The unscoped communication request
  failed its schema after exhausting the response budget; scoping it to the
  active ticket completed the pipeline with all six semantic LLM flags true.
- Added the LLM-first operating rule, explicit exceptions, manifest evidence
  requirement and deterministic trust boundary to README.md.
- Attempted a target-local `AGENTS.md` rule, observed `GOV-SYNC-001`, and
  restored the pinned managed file instead of weakening standard synchronization.
- Kept executable edits outside this policy ticket. A separate interface ticket
  now implements and validates the CLI default; the same-source defect and
  programmatic runtime remain separately governed follow-ups.
- Aligned the public workspace-comparison examples with the interface ticket:
  documentation enrichment is now the default and `--no-docs-llm` is the
  explicit offline choice.
- Aligned the policy with ticket-068's shared MCP/A2A resolver while retaining
  direct service/runtime defaults as a separate workstream.
- Passed governance, complete host verification, Docker smoke, diff, intent
  JSON and ticket-local link validation.

## Blockers

- Broader programmatic defaults depend on resolving same-source enrichment
  conflicts and on active core/runtime workstreams being released.
