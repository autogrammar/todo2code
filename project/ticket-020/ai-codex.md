---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-020
---
# Participant: codex (AI agent)

## Understanding

The user wants role-aware communication to become enforceable rather than a
filename convention. A previously verified user must keep the same role in
later tickets, and a message submitted through an IDE or CLI must be attributed
to that stable identity and written only by a trusted intake boundary.

The extension must be fully machine-validatable and actionable. Therefore one
domain model will serve the TypeScript CLI, a Python shell CLI, MCP and A2A.
CQRS isolates mutations from queries. Event sourcing provides append-only
history, replay and evidence. Protobuf is the canonical transport envelope;
strict JSON Schemas validate its JSON/payload views. Required validation is
offline and deterministic; an LLM has no role in identity, authorization,
schema, integrity or acceptance decisions.

The model does not infer a simple `manager > user > dev` permission chain.
These are primary responsibility roles with explicit capabilities. A manager
does not silently gain developer rights, and a developer does not gain manager
approval rights. Additional duties require explicit, auditable grants.

Current verified baseline:

- Docker CLI and engine are available; engine version is `29.1.3`.
- participant registry v1 supports only `human|agent` and exact external
  identifiers; it has no governance-role persistence.
- communication filename inference understands `user|human` and `ai|agent`,
  but not `manager|dev` without explicit metadata.
- existing CLI, MCP and A2A share action services but have no trusted message
  intake command or append-only participant-role event store.
- ticket-018 (`governance`) is blocked in validation and ticket-019 (`sdk`) is
  waiting for approval; this distinct `interfaces` scope does not claim their
  implementation paths.

## Architectural decisions

1. `participant-id` is the aggregate identity. Authenticated provider/IDE/CLI
   principals are exact aliases bound by events; names are presentation only.
2. Human `governanceRole` and participant `kind` are independent. Agents can
   request/query but cannot receive a trusted human projection capability.
3. Commands are accepted only with correlation, causation, idempotency,
   authenticated-principal and expected-version metadata.
4. Successful mutations append immutable events before rebuilding projections.
   Rejections return sanitized `T2C-INTAKE-*` diagnostics and append no secret
   or spoofed human message.
5. A human role Markdown file is a rebuildable view, not the identity source.
   Its front matter binds stable participant, role, ticket and projection hash.
6. The limited Protobuf envelope uses deterministic varint and
   length-delimited fields plus a JSON payload validated by a matching schema.
   TypeScript/Python golden vectors prevent codec drift without adding a
   runtime dependency in this ticket.

## Execution plan

1. Wait for explicit human approval and move ticket-020 to `EDIT` without
   treating the Markdown status as trusted merge approval.
2. Define versioned registry, capability, command/query/event/result and
   diagnostic schemas under the interfaces module, plus the canonical `.proto`
   envelope and stable diagnostic catalog.
3. Upgrade participant identity validation with v1 read compatibility and an
   explicit v2 migration result; do not infer role from historical filenames.
4. Implement the CQRS application boundary, authorization matrix and exact
   principal resolver.
5. Implement an event-per-version filesystem store with exclusive creation,
   expected-version checks, idempotency index, integrity chain, replay and
   deterministic projection verification.
6. Implement the trusted projection writer with atomic writes, root/symlink
   confinement, secret/size checks and manager/user/dev filename validation.
7. Add TypeScript and dependency-free Python Protobuf envelope codecs and
   shared golden test vectors.
8. Add Python and TypeScript CLI commands with the same result schema, stable
   exits, dry-run/JSON modes and no ambient identity guessing.
9. Expose the application handlers through MCP tools and the A2A
   governed-intake skill; keep protocol errors distinct from domain rejection.
10. Add positive and negative tests in temporary repositories, including two
    tickets for the same developer, spoofing, role mutation, duplicate command,
    concurrent version, broken chain, secret rejection and projection rebuild.
11. Run governance and relevant Docker E2E checks, record sanitized raw
    evidence, review only ticket-020-owned paths and report any shared-path need
    rather than widening scope.

## Planned reaction contract

- validation/schema input: stable diagnostic and CLI exit `2`;
- identity/authorization rejection: exit `3`;
- version/idempotency conflict: exit `4`, retryability declared explicitly;
- event/projection integrity failure: exit `5`;
- atomic storage failure: exit `6`;
- unsupported protocol/schema version: exit `7`;
- MCP returns the same structured diagnostic in `structuredContent`;
- A2A completes the task only for accepted commands and emits a deterministic
  rejected/failed outcome for domain or protocol errors respectively.

## Actual changes

- Created and completed only the ticket-020 plan, intent and project-level
  checklist entry.
- No source, test, package, Docker, SDK, top-level schema or human participant
  file was created or modified for this ticket.

## Blockers

- Explicit human approval is required before implementation.
- Whole-repository governance validation is already blocked by four findings
  owned by concurrent ticket-019 (`GOV-CONFLICT-001`, `GOV-DEPENDENCY-002`,
  `GOV-WORKSTREAM-003`, `GOV-WORKSTREAM-004`). None names ticket-020, but the
  shared gate cannot pass until the SDK ticket is corrected by its owner.
- Trusted merge evidence will still require an independent protected review or
  signed attestation; chat approval authorizes only the interactive edit phase.

## Approval boundary

- Current state: `PLAN / WAIT_FOR_APPROVAL`.
- Required response from: `unresolved:human`.
