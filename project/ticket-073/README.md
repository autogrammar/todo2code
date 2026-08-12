# Ticket 073: Define analysis budget DSL

- **ID**: ticket-073
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-12

## Goal and scope

Define a strict, canonical `t2c.analysis-policy/v1` DSL that lets todo2code
bound semantic-analysis cost without replacing semantic reasoning with a
deterministic approximation. Deterministic signals select the necessary LLM
stages and evidence slices; each selected stage retains explicit request,
token and elapsed-time ceilings, exact-evidence cache identity and fail-closed
provider policy. Every request ceiling includes retries and response-repair
calls.

This ticket supplies the dependency-free core contract, canonical
parser/renderer, deterministic stage selection and budget calculation. Runtime,
CLI and provider wiring remain a separate workstream so the contract can be
reviewed before it controls live calls.

## Acceptance criteria

- [x] AC-01: A human approves this bounded contract before source changes.
- [x] AC-02: One typed policy renders and parses byte-for-byte in canonical
      `t2c.analysis-policy/v1` form.
- [x] AC-03: Unknown vocabulary, duplicate stages, invalid trigger topology and
      stage budgets exceeding global ceilings fail closed.
- [x] AC-04: Deterministic trigger selection includes mandatory stages, selects
      only matching conditional stages and calculates exact maximum requests,
      tokens and elapsed time.
- [x] AC-05: The contract requires LLM for selected semantic stages, allows no
      deterministic semantic fallback and makes provider/budget exhaustion
      explicit.
- [x] AC-06: Focused, host, governance and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

The plan and intent were committed independently as `f2e68ae` before any
source change. The user's instruction `kontynuuj` followed the concrete
recommendation for this bounded cost-analysis DSL and authorizes the transition
to `IN_PROGRESS / EDIT` on 2026-08-12. This approval does not authorize merge;
protected exact-head review remains required.

## Non-goals

- No CLI flag, environment variable, pipeline scheduling or provider call.
- No model selection, mutable provider pricing or credential change.
- No deterministic substitute for intent, refactoring or documentation
  reasoning.
- No public SDK/interface or `src/core/types.ts` change.

## Verification and measured LLM evidence

- The focused contract suite passes 8/8 tests, including exact round-trip,
  trigger selection, cache binding and fail-closed request/token/time budgets.
- `npm run verify` passes 414 tests with 0 failures and one expected local JDK
  skip; the gold benchmark remains at 100% for every gated metric.
- Governance reports 0 errors and 0 warnings, dependency audit reports 0
  vulnerabilities and Docker smoke passes.
- A real all-semantic-stage `require-llm` pipeline used 43 provider responses,
  498,533 input tokens and 153,176 output tokens for 1.303208672 USD. Every
  selected semantic stage remained LLM-backed; no deterministic semantic
  fallback occurred.
- The repository-wide run was `degraded` because documentation was deliberately
  capped at 12 of 320 chunks, the local JDK was absent and one historical
  ticket-018 response violated its old schema. Its 920,279 ms Markdown stage
  demonstrated why elapsed-time ceilings are part of the policy.
- LLM synthesis found ambiguous action-less wording in this ticket preprompt.
  The requirements now use explicit `Implement`, `Read`, `Require`, `Reduce`
  and `Prohibit` actions. Broad historical suggestions without ticket-local
  evidence were not adopted.
