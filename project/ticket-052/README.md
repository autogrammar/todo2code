# Ticket 052: Operator checklist for external Validator App autonomy

- **ID**: ticket-052
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-06

## Goal and scope

Promote the ticket-049 operator guide into durable, agent-facing governance
guidance so future agents do not declare autonomy complete after setting a
single GitHub variable.

In scope after approval:

- Link or embed the checklist from `AGENTS.md` (governance-owned).
- Optionally add a small read-only helper script under an owned path that
  prints pass/fail for matrix ∩ config ∩ enabled (if feasible without secrets).
- Restate GOV-APPROVAL vs green `verify` distinction.

Out of scope: changing Validator App code (lives in `subactor/validator-agent`;
listed as external B2–B5 in ticket-049).

## Acceptance criteria

- [ ] AC-01: Human approves the checklist text (or amends it).
- [ ] AC-02: `AGENTS.md` references the checklist and forbids in-repo
  self-dispatch of the Validator.
- [ ] AC-03: Agents have a single command or doc section to verify autonomy
  preconditions before claiming the publication path is unblocked.
- [ ] AC-04: No weakening of trusted approval sources in the manifest.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-grok.md](ai-grok.md)

## Related

- [ticket-049 OPERATOR_GUIDE](../ticket-049/OPERATOR_GUIDE.md)
- [ticket-049 plan](../ticket-049/AUTONOMY_AND_REFACTOR_PLAN.md) §3 phase C3 / D
- ticket-018 trust boundary lineage
