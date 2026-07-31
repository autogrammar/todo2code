# Participant: Codex (AI agent)

- **Ticket**: ticket-006
- **Status**: DONE
- **Workflow state**: DONE

## Understanding

Ticket-005 proved that merely sending JSON Schema does not guarantee provider
conformance. The next step is contract fidelity and diagnostics, not semantic
threshold tuning.

## Plan

1. Inventory duplicated provider, published and runtime response definitions.
2. Add failing tests for every live violation observed in ticket-005.
3. Introduce the smallest canonical structural source and precise validator.
4. Keep semantic contracts internal and all network calls opt-in.
5. Run offline gates before any additional paid live comparison.
6. Compare two explicit provider/model routes only on a clean tracked snapshot.
7. Retain no production path unless both protocol and quality boundaries pass.

## Guardrails

- No field renaming or numeric coercion.
- No raw provider payload in logs.
- No untracked repository content.
- No executable file under this ticket.

## Current state

- Added one internal structural source for the TypeScript response shape,
  OpenRouter JSON Schema and exact runtime validation.
- Added a full-verification drift test against the published reranker decision
  schema.
- Added fail-closed diagnostics for the observed `judgments` envelope,
  non-numeric confidence and invalid verdict/reason combinations.
- Error text includes provider, resolved model and response ID, but never the
  raw provider payload or API key.
- Focused offline tests pass 5/5.
- The tracked live comparison rejected both Plus and Flash; Flash added an
  unknown `decision` property to an otherwise structured decision.
- All release gates pass. The hardening is retained, while semantic production
  enablement remains rejected.
