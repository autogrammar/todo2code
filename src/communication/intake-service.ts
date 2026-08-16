import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  IntakeError,
  REGISTRY_SCHEMA_VERSION,
  RESULT_SCHEMA_VERSION,
  assertIntakeEnvelope,
  diagnostic,
  principalKey,
  payloadHash as hashPayload,
  type GovernanceRole,
  type IntakeCommand,
  type IntakeEnvelope,
  type IntakeQuery,
  type IntakeResult,
  type ParticipantRegistryV2,
  type ParticipantV2,
} from './intake-contract.js';
import { IntakeEventStore, type IntakeEvent, type StreamSnapshot } from './intake-store.js';

interface IntakeState {
  participants: Map<string, ParticipantV2>;
  messages: Array<{ participantId: string; governanceRole: GovernanceRole; ticketId: string; message: string; event: IntakeEvent }>;
}

export class GovernedIntakeService {
  readonly store: IntakeEventStore;
  constructor(root: string, projectDir = 'project') { this.store = new IntakeEventStore(root, projectDir); }

  async command(input: unknown, options: { allowBootstrap?: boolean } = {}): Promise<IntakeResult> {
    let envelope: IntakeEnvelope<IntakeCommand>;
    try { assertIntakeEnvelope(input, 'command'); envelope = input as IntakeEnvelope<IntakeCommand>; }
    catch (error) { return rejected(input, error, 0); }
    let stream: StreamSnapshot;
    try { stream = await this.store.read(); }
    catch (error) { return rejected(envelope, error, 0); }
    try {
      const duplicate = stream.byIdempotencyKey.get(envelope.idempotencyKey);
      if (duplicate) {
        if (duplicate.payloadHash !== envelope.payloadHash) throw new IntakeError('T2C-INTAKE-DUPLICATE', 'Idempotency key is bound to another payload', 'Use a new idempotency key.');
        return accepted(envelope, stream.version, { duplicate: true, event: duplicate });
      }
      const state = replay(stream.events);
      const actor = resolveActor(state, envelope.authenticatedPrincipal);
      const event = await this.decide(envelope, stream, state, actor, options.allowBootstrap ?? true);
      const appended = await this.store.append(envelope, event.type, event.payload);
      const actual = appended.event.version;
      const updated = replay([...stream.events, ...(appended.duplicate ? [] : [appended.event])]);
      if (!appended.duplicate && ['ParticipantRegistered', 'ExternalIdentityBound', 'GovernanceRoleAssigned'].includes(appended.event.type)) {
        await this.store.writeRegistry(registry(updated, actual));
      }
      if (!appended.duplicate && (appended.event.type === 'MessageCaptured' || appended.event.type === 'ProjectionRebuilt')) {
        const participantId = String(appended.event.payload.participantId);
        const ticketId = String(appended.event.payload.ticketId);
        await this.writeProjection(updated, participantId, ticketId);
      }
      return accepted(envelope, actual, { duplicate: appended.duplicate, event: appended.event });
    } catch (error) {
      const actual = (await this.store.read().catch(() => stream)).version;
      return rejected(envelope, error, actual);
    }
  }

  async query(input: unknown): Promise<IntakeResult> {
    let envelope: IntakeEnvelope<IntakeQuery>;
    try { assertIntakeEnvelope(input, 'query'); envelope = input as IntakeEnvelope<IntakeQuery>; }
    catch (error) { return rejected(input, error, 0); }
    try {
      const stream = await this.store.read();
      const state = replay(stream.events);
      const payload = envelope.payload;
      let data: unknown;
      switch (payload.type) {
        case 'ResolveParticipant': data = resolveActor(state, payload.principal, true) ?? null; break;
        case 'GetRole': data = state.participants.get(payload.participantId) ?? null; break;
        case 'GetTicketConversation':
          data = state.messages.filter((message) => message.ticketId === payload.ticketId).map(({ event, ...message }) => ({ ...message, eventVersion: event.version, timestamp: event.timestamp })); break;
        case 'GetCommandStatus': data = stream.byIdempotencyKey.get(payload.idempotencyKey) ?? null; break;
        case 'ValidateProjection': data = await this.validateProjection(state, payload.participantId, payload.ticketId); break;
      }
      return accepted(envelope, stream.version, data);
    } catch (error) { return rejected(envelope, error, 0); }
  }

  private async decide(
    envelope: IntakeEnvelope<IntakeCommand>, stream: StreamSnapshot, state: IntakeState, actor: ParticipantV2 | null,
    allowBootstrap: boolean,
  ): Promise<{ type: IntakeEvent['type']; payload: Record<string, unknown> }> {
    const command = envelope.payload;
    if (command.type === 'RegisterParticipant') {
      requireManagerOrBootstrap(envelope.authenticatedPrincipal, actor, state.participants.size === 0 && allowBootstrap);
      if (state.participants.has(command.participant.id)) throw duplicate('Participant already exists');
      ensurePrincipalsUnique(state, command.participant);
      return { type: 'ParticipantRegistered', payload: { participant: command.participant } };
    }
    if (command.type === 'VerifyEventStream') {
      requireCapability(envelope.authenticatedPrincipal, actor, 'verify_event_stream');
      return { type: 'EventStreamVerified', payload: { verifiedVersion: stream.version, verifiedHash: stream.events.at(-1)?.hash ?? null } };
    }
    requireKnownActor(envelope.authenticatedPrincipal, actor);
    if (command.type === 'BindExternalIdentity') {
      requireCapability(envelope.authenticatedPrincipal, actor, 'assign_participant');
      const participant = requireParticipant(state, command.participantId); ensurePrincipalAvailable(state, command.principal, participant.id);
      return { type: 'ExternalIdentityBound', payload: { participantId: participant.id, principal: command.principal } };
    }
    if (command.type === 'AssignRole') {
      requireCapability(envelope.authenticatedPrincipal, actor, 'assign_role');
      const participant = requireParticipant(state, command.participantId);
      if (participant.kind !== 'human') throw unauthorized('Agents cannot receive a human governance role');
      return { type: 'GovernanceRoleAssigned', payload: { participantId: participant.id, governanceRole: command.governanceRole, ticketIds: command.ticketIds, capabilities: command.capabilities } };
    }
    if (command.type === 'CaptureMessage') {
      const participant = requireParticipant(state, command.participantId);
      if (!actor || actor.id !== participant.id || actor.kind !== 'human') throw unauthorized('Only the verified human may capture their own message');
      requireCapability(envelope.authenticatedPrincipal, actor, 'capture_own_message');
      if (participant.governanceRole !== command.governanceRole) throw new IntakeError('T2C-INTAKE-ROLE-MISMATCH', 'Requested role differs from persistent assigned role', 'Use the assigned role or ask a manager to append AssignRole.');
      if (!participant.ticketIds.includes(command.ticketId)) throw unauthorized('Participant is not assigned to this ticket');
      rejectSecrets(command.message);
      await this.assertProjectionWritable(participant, command.ticketId);
      return { type: 'MessageCaptured', payload: { participantId: participant.id, governanceRole: command.governanceRole, ticketId: command.ticketId, message: command.message } };
    }
    if (command.type === 'RebuildProjection') {
      requireCapability(envelope.authenticatedPrincipal, actor, 'rebuild_projection');
      const participant = requireParticipant(state, command.participantId);
      await this.assertProjectionWritable(participant, command.ticketId);
      return { type: 'ProjectionRebuilt', payload: { participantId: command.participantId, ticketId: command.ticketId } };
    }
    throw new IntakeError('T2C-INTAKE-INVALID-SCHEMA', 'Unsupported command', 'Use a documented command type.');
  }

  private async writeProjection(state: IntakeState, participantId: string, ticketId: string): Promise<void> {
    const participant = requireParticipant(state, participantId);
    if (participant.kind !== 'human' || !participant.governanceRole) throw unauthorized('Agent projections are not human role files');
    if (!participant.ticketIds.includes(ticketId)) throw unauthorized('Participant is not assigned to projection ticket');
    const target = await this.store.projectionPath(participant.governanceRole, participant.id, ticketId);
    const messages = state.messages.filter((item) => item.participantId === participantId && item.ticketId === ticketId);
    const body = messages.map((item) => `## Message ${item.event.version}\n\n${item.message.trim()}\n`).join('\n');
    const projectionHash = createHash('sha256').update(body).digest('hex');
    const content = [
      '---', `participant-id: ${participant.id}`, `participant: ${participant.displayName}`,
      `role: ${participant.governanceRole}`, `ticket: ${ticketId}`, 'projection-managed: trusted-intake',
      `projection-hash: ${projectionHash}`, '---', `# Participant: ${participant.displayName}`, '', body,
    ].join('\n').replace(/\n+$/, '\n');
    try {
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink() || !stat.isFile()) throw drift('Projection target is not a regular file');
      const existing = await fs.readFile(target, 'utf8');
      if (!existing.includes('projection-managed: trusted-intake') || !existing.includes(`participant-id: ${participant.id}`)) {
        throw drift('Existing role file is not a trusted projection for this participant');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await this.store.atomicWrite(target, content);
  }

  private async assertProjectionWritable(participant: ParticipantV2, ticketId: string): Promise<void> {
    if (participant.kind !== 'human' || !participant.governanceRole) throw unauthorized('Agent projections are not human role files');
    const target = await this.store.projectionPath(participant.governanceRole, participant.id, ticketId);
    const slug = participant.id.replace(/^[^:]+:/, '');
    const directory = path.dirname(target);
    try {
      const roleFiles = (await fs.readdir(directory)).filter((name) => new RegExp(`^(manager|user|dev)-${escapeRegex(slug)}\\.md$`).test(name));
      if (roleFiles.some((name) => path.join(directory, name) !== target)) {
        throw new IntakeError('T2C-INTAKE-FILENAME-MISMATCH', `Participant ${participant.id} has another role-prefixed projection`, 'Resolve the legacy/spoofed filename through an explicit migration before rebuilding.');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    try {
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink() || !stat.isFile()) throw drift('Projection target is not a regular file');
      const existing = await fs.readFile(target, 'utf8');
      if (!existing.includes('projection-managed: trusted-intake') || !existing.includes(`participant-id: ${participant.id}`)) {
        throw drift('Existing role file is not a trusted projection for this participant');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private async validateProjection(state: IntakeState, participantId: string, ticketId: string): Promise<Record<string, unknown>> {
    const participant = requireParticipant(state, participantId);
    if (!participant.governanceRole) return { valid: false, reason: 'participant-has-no-human-role' };
    const target = await this.store.projectionPath(participant.governanceRole, participant.id, ticketId);
    const directory = path.dirname(target);
    const slug = participant.id.replace(/^[^:]+:/, '');
    const candidates = await fs.readdir(directory).catch((error: NodeJS.ErrnoException) => error.code === 'ENOENT' ? [] : Promise.reject(error));
    const roleFiles = candidates.filter((name) => new RegExp(`^(manager|user|dev)-${escapeRegex(slug)}\\.md$`).test(name)).sort();
    const conflictingFiles = roleFiles.filter((name) => path.join(directory, name) !== target);
    if (conflictingFiles.length) {
      return {
        valid: false,
        reason: 'legacy-migration-conflict',
        migration: {
          dryRun: true,
          participantId,
          ticketId,
          expectedPath: path.relative(this.store.projectRoot, target).replace(/\\/g, '/'),
          candidates: conflictingFiles,
          conflict: true,
          remediation: 'Resolve legacy ownership explicitly, then resubmit accepted messages through CaptureMessage and run RebuildProjection.',
        },
      };
    }
    try {
      const existing = await fs.readFile(target, 'utf8');
      const messages = state.messages.filter((item) => item.participantId === participantId && item.ticketId === ticketId);
      const body = messages.map((item) => `## Message ${item.event.version}\n\n${item.message.trim()}\n`).join('\n');
      const hash = createHash('sha256').update(body).digest('hex');
      return { valid: existing.includes('projection-managed: trusted-intake') && existing.includes(`projection-hash: ${hash}`), path: path.relative(this.store.projectRoot, target).replace(/\\/g, '/'), expectedHash: hash };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { valid: false, reason: 'missing' };
      throw error;
    }
  }
}

function replay(events: IntakeEvent[]): IntakeState {
  const participants = new Map<string, ParticipantV2>();
  const messages: IntakeState['messages'] = [];
  for (const event of events) {
    if (event.type === 'ParticipantRegistered') {
      const participant = structuredClone(event.payload.participant) as ParticipantV2; participants.set(participant.id, participant);
    } else if (event.type === 'ExternalIdentityBound') {
      const participant = requireParticipant({ participants, messages }, String(event.payload.participantId));
      participant.principals.push(structuredClone(event.payload.principal) as ParticipantV2['principals'][number]);
    } else if (event.type === 'GovernanceRoleAssigned') {
      const participant = requireParticipant({ participants, messages }, String(event.payload.participantId));
      participant.governanceRole = event.payload.governanceRole as GovernanceRole;
      participant.ticketIds = [...event.payload.ticketIds as string[]]; participant.capabilities = [...event.payload.capabilities as ParticipantV2['capabilities']];
    } else if (event.type === 'MessageCaptured') {
      messages.push({ participantId: String(event.payload.participantId), governanceRole: event.payload.governanceRole as GovernanceRole, ticketId: String(event.payload.ticketId), message: String(event.payload.message), event });
    }
  }
  return { participants, messages };
}

function registry(state: IntakeState, version: number): ParticipantRegistryV2 {
  return { schemaVersion: REGISTRY_SCHEMA_VERSION, version, participants: [...state.participants.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}
function resolveActor(state: IntakeState, principal: string, optional = false): ParticipantV2 | null {
  const matches = [...state.participants.values()].filter((entry) => entry.principals.some((candidate) => principalKey(candidate) === principal));
  if (matches.length === 1) return matches[0] ?? null;
  if (optional) return null;
  if (matches.length > 1) throw new IntakeError('T2C-INTAKE-UNVERIFIED-ACTOR', 'Principal is ambiguous', 'Repair the participant registry before accepting commands.');
  return null;
}
function requireKnownActor(principal: string, actor: ParticipantV2 | null): asserts actor is ParticipantV2 {
  if (!actor) throw new IntakeError('T2C-INTAKE-UNKNOWN-ACTOR', `No verified participant for ${principal}`, 'Bind the exact provider principal through trusted intake.');
}
function requireManagerOrBootstrap(principal: string, actor: ParticipantV2 | null, empty: boolean): void {
  if (empty) return;
  requireCapability(principal, actor, 'assign_participant');
}
function requireCapability(principal: string, actor: ParticipantV2 | null, capability: ParticipantV2['capabilities'][number]): void {
  requireKnownActor(principal, actor);
  if (!actor.capabilities.includes(capability)) throw unauthorized(`Actor lacks ${capability}`);
}
function requireParticipant(state: IntakeState, id: string): ParticipantV2 {
  const participant = state.participants.get(id);
  if (!participant) throw new IntakeError('T2C-INTAKE-UNKNOWN-ACTOR', `Unknown participant ${id}`, 'Register the participant through trusted intake.');
  return participant;
}
function ensurePrincipalsUnique(state: IntakeState, entry: ParticipantV2): void { for (const principal of entry.principals) ensurePrincipalAvailable(state, principal, entry.id); }
function ensurePrincipalAvailable(state: IntakeState, principal: ParticipantV2['principals'][number], owner: string): void {
  const key = principalKey(principal);
  const conflict = [...state.participants.values()].find((entry) => entry.id !== owner && entry.principals.some((item) => principalKey(item) === key));
  if (conflict) throw new IntakeError('T2C-INTAKE-UNVERIFIED-ACTOR', `Principal is already bound to ${conflict.id}`, 'Use a unique verified principal.');
}
function rejectSecrets(message: string): void {
  if (/(?:api[_-]?key|token|password|secret)\s*[:=]\s*[^\s]{8,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(message)) {
    throw new IntakeError('T2C-INTAKE-SECRET-INPUT', 'Message resembles a secret and was not persisted', 'Remove or redact the secret before resubmitting.');
  }
}
function accepted(envelope: IntakeEnvelope, version: number, data: unknown): IntakeResult {
  return { schemaVersion: RESULT_SCHEMA_VERSION, accepted: true, messageId: envelope.messageId, correlationId: envelope.correlationId, causationId: envelope.causationId, authenticatedPrincipal: envelope.authenticatedPrincipal, aggregateId: 'intake', expectedVersion: envelope.expectedVersion, actualVersion: version, idempotencyKey: envelope.idempotencyKey, timestamp: new Date().toISOString(), payloadHash: envelope.payloadHash, diagnostic: null, data };
}
function rejectedEnvelopeFields(envelope: Partial<IntakeEnvelope>): {
  messageId: string;
  correlationId: string;
  causationId: string | null;
  authenticatedPrincipal: string;
  expectedVersion: number | null;
  idempotencyKey: string;
  payloadHash: string;
} {
  return {
    messageId: envelope.messageId ?? '',
    correlationId: envelope.correlationId ?? '',
    causationId: envelope.causationId ?? null,
    authenticatedPrincipal: envelope.authenticatedPrincipal ?? '',
    expectedVersion: envelope.expectedVersion ?? null,
    idempotencyKey: envelope.idempotencyKey ?? '',
    payloadHash: envelope.payloadHash ?? '',
  };
}
function rejected(input: unknown, error: unknown, version: number): IntakeResult {
  const envelope = input && typeof input === 'object' ? input as Partial<IntakeEnvelope> : {};
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    accepted: false,
    ...rejectedEnvelopeFields(envelope),
    aggregateId: 'intake',
    actualVersion: version,
    timestamp: new Date().toISOString(),
    diagnostic: diagnostic(error),
    data: null,
  };
}
function unauthorized(message: string): IntakeError { return new IntakeError('T2C-INTAKE-UNAUTHORIZED', message, 'Use a verified principal with the explicitly granted capability.'); }
function duplicate(message: string): IntakeError { return new IntakeError('T2C-INTAKE-DUPLICATE', message, 'Resolve or query the existing aggregate instead.'); }
function drift(message: string): IntakeError { return new IntakeError('T2C-INTAKE-PROJECTION-DRIFT', message, 'Move untrusted content aside or reconcile it through an authorized migration.'); }
function escapeRegex(value: string): string { return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&'); }

export function commandEnvelope(payload: IntakeCommand, metadata: Omit<IntakeEnvelope<IntakeCommand>, 'schemaVersion' | 'payload' | 'payloadHash'>): IntakeEnvelope<IntakeCommand> {
  return { schemaVersion: 't2c.intake-envelope/v1', ...metadata, payloadHash: hashPayload(payload), payload };
}
