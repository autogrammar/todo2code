---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-054
---
# Participant: codex (AI agent)

## Understanding

The ecosystem already has the intended Doctor → Repair → Validator split, but
the paths are not currently one working chain. Standalone repair-agent is
scheduled and healthy in dry-run mode, validator-agent is actively approving
exact PR heads, while skills-agent discovery is completely blocked by the
invalid `0014_publication-freeze` package. Adding more skills before restoring
discovery would increase inventory without increasing capability.

Todo2code can provide a useful deterministic evidence plane: its offline
pipeline produced a successful immutable run and graph over skills-agent.
Its proposed edits must remain advisory because stale TODO declarations can
produce grounded-looking plans for paths that no longer exist.

## Execution plan after approval

1. Create a skills-agent repair PR for `0014`, schema validation isolation and
   GLM 5.2 configuration alignment.
2. Require its normal CI and independent validator-agent exact-head approval.
3. Add the read-only `0015_todo2code-governance-health` pilot as a separate
   skills-agent PR and validate the todo2code manifest/graph contract.
4. Prove one correlation-bound Doctor → Repair PR → Validator rejection or
   approval cycle with auto-merge disabled.
5. Only then add dependency and branch-lifecycle repair skills in separate PRs.
6. Record results in this ticket and close it after all cross-repository
   evidence is immutable and reproducible.

## Actual changes

- Audited local code, current GitHub workflow runs and protected variables.
- Ran todo2code deterministically against skills-agent with all LLM stages
  disabled; the run succeeded and wrote artifacts only under `/tmp`.
- Created this coordination plan only. No implementation or external state was
  changed.

## Blockers

- Explicit approval of the proposed skill IDs and phased ordering.
- The OpenRouter Repair key total limit must be resolved before live Repair can
  prove a paid patch/PR hand-off.
- repair-agent's existing local changes belong to another workstream and must
  not be included.
