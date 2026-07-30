# Subactor operation-plan DSL

`todo2code` can turn grounded intent into a proposed operational plan without
becoming an executor. The boundary has three contracts:

1. `t2c.variable-contract/v1` declares a variable's type, source,
   classification, freshness and AQL-visible readers/writers. Every variable
   grants `authority:founder` read and write authority. Other principals receive
   only explicitly declared access.
2. `t2c.operation-plan/v1` binds evidence, a capability snapshot, exact URI
   processes, effects, reversibility, risk, rollback and independent
   expectations to a deterministic `planHash`. Its lifecycle is always
   `proposed`, including plans synthesized by an LLM.
3. `compileSubactorProcessEnvelope` resolves declared non-secret variables and
   projects the proposal to `subactor.process-envelope.v2`. It performs no I/O,
   creates no ticket and executes no route.

Every URI payload field must refer to a variable contract. The compiler rejects
missing and excess bindings, a mismatched source, wrong type, stale observation
or a secret value. A route that needs credentials must receive a governed Vault
locator such as `sftp_vault_entry_id`, not the secret itself.

Commands must declare rollback, an exercise and independent readback. Unknown or
false reversibility and `boundary`/`governance` risk require both
`humanApproval=true` on the step and a decision assigned to
`authority:founder`. The generated Process Envelope therefore reaches the
existing Subactor ticket/readiness controls; it does not bypass them.

This split keeps responsibilities explicit:

- `todo2code`: evidence and proposed semantics;
- `autonom`: recurring observation and scheduling;
- Subactor AQL/Planfile/controllers: authority, decision forms and execution.
