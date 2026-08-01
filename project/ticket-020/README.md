# Ticket 020: Role-bound trusted intake with CQRS, ES, Protobuf, MCP and A2A

- **ID**: ticket-020
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-01

## Goal and scope

Implement a deterministic trusted-intake boundary which binds every captured
human message to a verified stable participant, a persistent governance role
(`manager`, `user` or `dev`) and one ticket. The assignment is stored in a
repository-level participant registry, so it remains stable across tickets.
Filename prefixes are projections of verified identity and role; they are never
accepted as identity evidence by themselves.

The boundary will expose one domain contract through a Python shell CLI, the
existing TypeScript CLI, MCP tools and an A2A skill. All transports call the
same command/query handlers and return the same stable diagnostic codes. The
required decision path is deterministic and does not call an LLM.

The implementation uses CQRS and event sourcing:

- commands validate authorization and append immutable domain events;
- queries read deterministic projections and never mutate state;
- event streams use optimistic concurrency, idempotency keys and a SHA-256
  integrity chain;
- a trusted projection writer materializes human-owned
  `manager-*`, `user-*` and `dev-*` Markdown views;
- rejected commands return structured diagnostics and do not write human
  content or secret payloads.

The canonical transport envelope is Protobuf. Strict JSON Schemas validate the
JSON representation and command payloads. TypeScript and dependency-free
Python codecs support the limited wire types used by the envelope and are
checked against shared golden vectors.

This interfaces ticket owns only `src/communication/**`, `src/interfaces/**`,
`src/cli.ts` and matching interface tests. It will not change package,
top-level schema, Docker, SDK or documentation paths. If such a shared path is
proved necessary, work stops and a separate integration ticket is planned and
approved instead of widening this scope.

## Role and authority model

`kind` and `governanceRole` are separate fields. Humans have a stable
`participant-id` and one primary governance role; agents retain an `agent:*`
identity and cannot acquire a human role. Roles grant explicit capabilities,
not implicit inheritance:

- `manager`: assign participants/tickets, approve plans and accept outcomes;
- `user`: submit requirements and accept business behaviour;
- `dev`: make/review technical decisions and operate an AI from an IDE;
- every human role may submit its own message through trusted intake;
- combined duties require explicit grants rather than treating one role as all
  lower roles.

Role changes are versioned commands authorized by the configured manager or a
trusted intake policy. Historical role files are migration evidence only and
cannot silently change the registry.

## Planned contracts

Commands include `RegisterParticipant`, `BindExternalIdentity`, `AssignRole`,
`CaptureMessage`, `RebuildProjection` and `VerifyEventStream`. Queries include
`ResolveParticipant`, `GetRole`, `GetTicketConversation`, `GetCommandStatus`
and `ValidateProjection`.

Events include `ParticipantRegistered`, `ExternalIdentityBound`,
`GovernanceRoleAssigned`, `MessageCaptured` and `ProjectionRebuilt`. Rejected
commands produce a sanitized audit result, not a successful domain event.

The response envelope contains at least: schema version, message ID,
correlation/causation IDs, authenticated principal, aggregate ID, expected and
actual stream versions, idempotency key, timestamp, payload hash, diagnostic
code, remediation and retryability.

## Acceptance criteria

- [ ] AC-01: A human approves this understanding, scope and checklist before
      any implementation path is changed.
- [ ] AC-02: Participant registry v2 has strict schemas separating
      `human|agent` kind, stable identity, `manager|user|dev` governance role,
      verified external principals and explicit capability grants.
- [ ] AC-03: Identity resolution uses exact verified principal identifiers;
      display names and role-prefixed filenames are never sufficient evidence.
- [ ] AC-04: CQRS command and query handlers are transport-independent and
      reject commands with missing identity, authority, ticket binding or
      expected stream version.
- [ ] AC-05: The event store is append-only, atomic and replayable, with
      optimistic concurrency, idempotency and a verifiable SHA-256 hash chain.
- [ ] AC-06: A deterministic projection maps a verified human to exactly one
      `manager-*`, `user-*` or `dev-*` file per ticket and detects projection
      drift without overwriting untrusted content.
- [ ] AC-07: Only a trusted intake capability may create or update human role
      projections; an AI/agent command fails closed and cannot self-approve.
- [ ] AC-08: Strict JSON Schemas reject unknown fields and version every
      registry, command, query, event, result and diagnostic payload.
- [ ] AC-09: A versioned `.proto` contract defines the canonical envelope and
      command/query/event variants; TypeScript and Python round trips match
      byte-level golden vectors and preserve unknown-field compatibility.
- [ ] AC-10: A dependency-free Python CLI supports participant resolution,
      role assignment, message capture, validation, event verification/replay
      and projection rebuild, with stable JSON output and documented exits.
- [ ] AC-11: The existing TypeScript CLI exposes equivalent commands and calls
      the same application handlers as MCP and A2A.
- [ ] AC-12: MCP exposes typed intake/resolve/validate/query tools, maps domain
      diagnostics deterministically and declares mutating-tool annotations.
- [ ] AC-13: A2A exposes a versioned governed-intake skill, accepts JSON and
      Protobuf data parts, preserves correlation/idempotency metadata and maps
      rejections to deterministic task outcomes.
- [ ] AC-14: Stable `T2C-INTAKE-*` diagnostics cover unknown/unverified actor,
      role mismatch, unauthorized command, filename mismatch, version conflict,
      duplicate request, broken chain, invalid schema/wire data, secret input,
      unsafe path, projection drift and storage failure, each with remediation.
- [ ] AC-15: Secret scanning, size limits, path confinement, symlink defense,
      payload hashing and sanitized logs run before persistent human content is
      written; rejected secret text is not copied to the event stream.
- [ ] AC-16: Legacy `user-*` remains readable; migration to role-bound v2 is
      explicit, dry-runnable and conflict-producing when history is ambiguous.
- [ ] AC-17: Tests prove role persistence across tickets, role-change
      authorization, filename spoof rejection, agent-write rejection,
      concurrency conflicts, idempotent replay and deterministic rebuild.
- [ ] AC-18: CLI, MCP, A2A and cross-language Protobuf contract tests run in
      Docker without live providers or LLM calls and produce no real human
      participant file in the repository.
- [ ] AC-19: Existing CLI/MCP/A2A and communication tests remain green; every
      failure is reported with its stable code and no unrelated dirty path is
      modified or attributed to this ticket.

## Participants

- Human participant: unresolved; no human role file was created by the agent.
- Agent participant: [ai-codex.md](ai-codex.md)

## Risks and stop conditions

- IDE/CLI clients that do not expose an authenticated hook cannot be claimed as
  automatically captured; they require a wrapper or provider-specific adapter.
- Filesystem compare-and-append coordinates one checkout, not distributed
  worktrees. Git/CI detects divergent event versions before merge.
- Adding a Protobuf/runtime package, modifying `package.json`, Docker files,
  top-level `schemas/**` or documentation requires a separate integration
  ticket, dependency/license review and fresh approval.
- Concurrent ticket-019 owns SDK/Python packaging paths and remains untouched.
- Whole-repository governance currently fails on ticket-019's pre-existing
  dependency, conflict and ownership declarations. Ticket-020 cannot claim a
  passing global gate until that independent SDK plan is repaired.
