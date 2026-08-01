# Ticket 020: Role-bound trusted intake with CQRS, ES, Protobuf, MCP and A2A

- **ID**: ticket-020
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: COMPLETE
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

- [x] AC-01: A human approves this understanding, scope and checklist before
      any implementation path is changed.
- [x] AC-02: Participant registry v2 has strict schemas separating
      `human|agent` kind, stable identity, `manager|user|dev` governance role,
      verified external principals and explicit capability grants.
- [x] AC-03: Identity resolution uses exact verified principal identifiers;
      display names and role-prefixed filenames are never sufficient evidence.
- [x] AC-04: CQRS command and query handlers are transport-independent and
      reject commands with missing identity, authority, ticket binding or
      expected stream version.
- [x] AC-05: The event store is append-only, atomic and replayable, with
      optimistic concurrency, idempotency and a verifiable SHA-256 hash chain.
- [x] AC-06: A deterministic projection maps a verified human to exactly one
      `manager-*`, `user-*` or `dev-*` file per ticket and detects projection
      drift without overwriting untrusted content.
- [x] AC-07: Only a trusted intake capability may create or update human role
      projections; an AI/agent command fails closed and cannot self-approve.
- [x] AC-08: Strict JSON Schemas reject unknown fields and version every
      registry, command, query, event, result and diagnostic payload.
- [x] AC-09: A versioned `.proto` contract defines the canonical envelope and
      command/query/event variants; TypeScript and Python round trips match
      byte-level golden vectors and preserve unknown-field compatibility.
- [x] AC-10: A dependency-free Python CLI supports participant resolution,
      role assignment, message capture, validation, event verification/replay
      and projection rebuild, with stable JSON output and documented exits.
- [x] AC-11: The existing TypeScript CLI exposes equivalent commands and calls
      the same application handlers as MCP and A2A.
- [x] AC-12: MCP exposes typed intake/resolve/validate/query tools, maps domain
      diagnostics deterministically and declares mutating-tool annotations.
- [x] AC-13: A2A exposes a versioned governed-intake skill, accepts JSON and
      Protobuf data parts, preserves correlation/idempotency metadata and maps
      rejections to deterministic task outcomes.
- [x] AC-14: Stable `T2C-INTAKE-*` diagnostics cover unknown/unverified actor,
      role mismatch, unauthorized command, filename mismatch, version conflict,
      duplicate request, broken chain, invalid schema/wire data, secret input,
      unsafe path, projection drift and storage failure, each with remediation.
- [x] AC-15: Secret scanning, size limits, path confinement, symlink defense,
      payload hashing and sanitized logs run before persistent human content is
      written; rejected secret text is not copied to the event stream.
- [x] AC-16: Legacy `user-*` remains readable; migration to role-bound v2 is
      explicit, dry-runnable and conflict-producing when history is ambiguous.
- [x] AC-17: Tests prove role persistence across tickets, role-change
      authorization, filename spoof rejection, agent-write rejection,
      concurrency conflicts, idempotent replay and deterministic rebuild.
- [x] AC-18: CLI, MCP, A2A and cross-language Protobuf contract tests run in
      Docker without live providers or LLM calls and produce no real human
      participant file in the repository.
- [x] AC-19: Existing CLI/MCP/A2A and communication tests remain green; every
      failure is reported with its stable code and no unrelated dirty path is
      modified or attributed to this ticket.

## Participants

- Human participant: unresolved; no human role file was created by the agent.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval record

The user explicitly instructed the agent to implement ("wdrażaj") in chat on
2026-08-01 after the agent restated that ticket-020 and AC-01..AC-19 required
explicit approval. This authorizes the interactive `EDIT` phase only; it is
not trusted merge evidence.

## Risks and stop conditions

- IDE/CLI clients that do not expose an authenticated hook cannot be claimed as
  automatically captured; they require a wrapper or provider-specific adapter.
- Filesystem compare-and-append coordinates one checkout, not distributed
  worktrees. Git/CI detects divergent event versions before merge.
- Adding a Protobuf/runtime package, modifying `package.json`, Docker files,
  top-level `schemas/**` or documentation requires a separate integration
  ticket, dependency/license review and fresh approval.
- SDK/Python packaging paths remain outside this ticket and are untouched.
- The branch now inherits committed policy 0.8.0 and its workstream-aware
  validator; remaining governance findings, if any, must be attributed to an
  actual dependency, conflict, ownership or scope violation rather than a
  repository-wide single-ticket limit.

## Implementation and validation result

- Added a strict registry v2, typed command/query/result contracts, the stable
  `T2C-INTAKE-*` diagnostic catalog and Draft 2020-12 schemas.
- Added an append-only event-per-version store with optimistic concurrency,
  idempotency, exclusive append locking, replay and a verified SHA-256 chain.
- Added trusted human projection materialization, role/filename drift checks,
  secret and size rejection, root/symlink confinement and dry-run legacy
  migration conflict reporting. No real human projection was written here.
- Added dependency-free TypeScript and Python Protobuf codecs with golden-byte
  parity and unknown-field preservation, plus explicit command/query/event and
  result variants in `governed-intake.proto`.
- Added TypeScript and Python CLI parity, typed MCP tools and an A2A skill.
  A2A binds intake identity to the authenticated bearer-derived principal,
  rejects unauthenticated bootstrap and preserves JSON/Protobuf result modes.
- `npm run verify`: PASS, 335 tests, 334 passed, 1 explicit missing-JDK skip,
  0 failed.
- `make e2e-core`: PASS in network-isolated Docker; 335 tests, 328 passed,
  7 explicit optional-toolchain skips, both gold datasets, CLI, MCP, A2A and
  available SDK examples passed.
- `make governance` under policy 0.8.0 returns only the remaining independent
  findings owned by ticket-019 (`GOV-DEPENDENCY-002`, `GOV-CONFLICT-001`,
  `GOV-WORKSTREAM-003`, `GOV-WORKSTREAM-004`). Ticket-020 itself no longer
  contributes to a single-ticket or overlap violation.
