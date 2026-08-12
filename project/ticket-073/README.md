# Ticket 073: Define analysis budget DSL

- **ID**: ticket-073
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-12

## Goal and scope

Define a strict, canonical `t2c.analysis-policy/v1` DSL that lets todo2code
bound semantic-analysis cost without replacing semantic reasoning with a
deterministic approximation. Deterministic signals select the necessary LLM
stages and evidence slices; each selected stage retains an explicit request
and token ceiling, exact-evidence cache identity and fail-closed provider
policy.

This ticket supplies the dependency-free core contract, canonical
parser/renderer, deterministic stage selection and budget calculation. Runtime,
CLI and provider wiring remain a separate workstream so the contract can be
reviewed before it controls live calls.

## Acceptance criteria

- [ ] AC-01: A human approves this bounded contract before source changes.
- [ ] AC-02: One typed policy renders and parses byte-for-byte in canonical
      `t2c.analysis-policy/v1` form.
- [ ] AC-03: Unknown vocabulary, duplicate stages, invalid trigger topology and
      stage budgets exceeding global ceilings fail closed.
- [ ] AC-04: Deterministic trigger selection includes mandatory stages, selects
      only matching conditional stages and calculates exact maximum usage.
- [ ] AC-05: The contract requires LLM for selected semantic stages, allows no
      deterministic semantic fallback and makes provider/budget exhaustion
      explicit.
- [ ] AC-06: Focused, host, governance and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

Current state is `PLAN / WAIT_FOR_APPROVAL`. The user's earlier instruction to
continue followed a concrete recommendation for a bounded cost-analysis DSL;
the transition to `EDIT` will be recorded only after this plan exists in an
independent commit.

## Non-goals

- No CLI flag, environment variable, pipeline scheduling or provider call.
- No model selection, mutable provider pricing or credential change.
- No deterministic substitute for intent, refactoring or documentation
  reasoning.
- No public SDK/interface or `src/core/types.ts` change.
