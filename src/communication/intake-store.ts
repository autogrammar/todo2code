import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDir, pathExists } from '../core/io.js';
import { assertPathWithinRoot } from '../core/security.js';
import {
  IntakeError,
  canonicalJson,
  type IntakeCommand,
  type IntakeEnvelope,
  type ParticipantRegistryV2,
} from './intake-contract.js';

export type IntakeEventType =
  | 'ParticipantRegistered'
  | 'ExternalIdentityBound'
  | 'GovernanceRoleAssigned'
  | 'MessageCaptured'
  | 'ProjectionRebuilt'
  | 'EventStreamVerified';

export interface IntakeEvent {
  schemaVersion: 't2c.intake-event/v1';
  aggregateId: 'intake';
  version: number;
  type: IntakeEventType;
  timestamp: string;
  previousHash: string | null;
  hash: string;
  messageId: string;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  authenticatedPrincipal: string;
  payloadHash: string;
  payload: Record<string, unknown>;
}

export interface StreamSnapshot {
  version: number;
  events: IntakeEvent[];
  byIdempotencyKey: Map<string, IntakeEvent>;
}

export class IntakeEventStore {
  readonly projectRoot: string;
  readonly storageRoot: string;
  readonly eventRoot: string;
  readonly registryPath: string;
  private readonly root: string;

  constructor(root: string, projectDir = 'project') {
    this.root = path.resolve(root);
    this.projectRoot = path.resolve(this.root, projectDir);
    this.storageRoot = path.join(this.projectRoot, '.intake');
    this.eventRoot = path.join(this.storageRoot, 'events');
    this.registryPath = path.join(this.projectRoot, 'participants.v2.json');
  }

  async read(): Promise<StreamSnapshot> {
    await this.assertSafe(this.eventRoot);
    if (!(await pathExists(this.eventRoot))) return { version: 0, events: [], byIdempotencyKey: new Map() };
    const names = (await fs.readdir(this.eventRoot)).filter((name) => /^[0-9]{12}\.json$/.test(name)).sort();
    const events: IntakeEvent[] = [];
    let previousHash: string | null = null;
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index]; if (!name) continue;
      const eventPath = path.join(this.eventRoot, name);
      const stat = await fs.lstat(eventPath);
      if (!stat.isFile() || stat.isSymbolicLink()) broken(`Unsafe event entry ${name}`);
      const event = JSON.parse(await fs.readFile(eventPath, 'utf8')) as IntakeEvent;
      if (event.schemaVersion !== 't2c.intake-event/v1' || event.aggregateId !== 'intake' || event.version !== index + 1) broken(`Invalid event sequence at ${name}`);
      if (event.previousHash !== previousHash || event.hash !== hashEvent(event)) broken(`Hash chain mismatch at ${name}`);
      events.push(event); previousHash = event.hash;
    }
    return { version: events.length, events, byIdempotencyKey: new Map(events.map((event) => [event.idempotencyKey, event])) };
  }

  async append(
    envelope: IntakeEnvelope<IntakeCommand>,
    type: IntakeEventType,
    payload: Record<string, unknown>,
  ): Promise<{ event: IntakeEvent; duplicate: boolean }> {
    await this.assertSafe(this.storageRoot);
    await ensureDir(this.eventRoot);
    const lockPath = path.join(this.storageRoot, 'append.lock');
    let lock: fs.FileHandle | null = null;
    try {
      lock = await fs.open(lockPath, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new IntakeError('T2C-INTAKE-VERSION-CONFLICT', 'Another intake append is in progress', 'Reload the stream version and retry.', true);
      }
      throw error;
    }
    try {
      const stream = await this.read();
      const existing = stream.byIdempotencyKey.get(envelope.idempotencyKey);
      if (existing) {
        if (existing.payloadHash !== envelope.payloadHash) {
          throw new IntakeError('T2C-INTAKE-DUPLICATE', 'Idempotency key was already used with another payload', 'Use the original payload or a new idempotency key.');
        }
        return { event: existing, duplicate: true };
      }
      if (envelope.expectedVersion === null || envelope.expectedVersion !== stream.version) {
        throw new IntakeError('T2C-INTAKE-VERSION-CONFLICT', `Expected stream version ${String(envelope.expectedVersion)}, actual ${stream.version}`, 'Reload the stream and retry with actualVersion.', true);
      }
      const eventWithoutHash = {
        schemaVersion: 't2c.intake-event/v1' as const, aggregateId: 'intake' as const,
        version: stream.version + 1, type, timestamp: envelope.timestamp,
        previousHash: stream.events.at(-1)?.hash ?? null, messageId: envelope.messageId,
        correlationId: envelope.correlationId, causationId: envelope.causationId,
        idempotencyKey: envelope.idempotencyKey, authenticatedPrincipal: envelope.authenticatedPrincipal,
        payloadHash: envelope.payloadHash, payload,
      };
      const event: IntakeEvent = { ...eventWithoutHash, hash: createHash('sha256').update(canonicalJson(eventWithoutHash)).digest('hex') };
      const filename = `${String(event.version).padStart(12, '0')}.json`;
      await fs.writeFile(path.join(this.eventRoot, filename), `${JSON.stringify(event, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      return { event, duplicate: false };
    } finally {
      await lock.close().catch(() => undefined);
      await fs.unlink(lockPath).catch(() => undefined);
    }
  }

  async writeRegistry(registry: ParticipantRegistryV2): Promise<void> {
    await this.atomicWrite(this.registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  }

  async projectionPath(role: string, participantId: string, ticketId: string): Promise<string> {
    if (!/^ticket-[0-9]{3,}$/.test(ticketId)) unsafe('Unsafe ticket path');
    const slug = participantId.replace(/^[^:]+:/, '');
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(slug) || !/^(manager|user|dev)$/.test(role)) unsafe('Unsafe projection filename');
    return this.assertSafe(path.join(this.projectRoot, ticketId, `${role}-${slug}.md`));
  }

  async atomicWrite(target: string, content: string): Promise<void> {
    const safe = await this.assertSafe(target);
    await ensureDir(path.dirname(safe));
    const temp = path.join(path.dirname(safe), `.${path.basename(safe)}.${randomUUID()}.tmp`);
    await fs.writeFile(temp, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    try { await fs.rename(temp, safe); } finally { await fs.unlink(temp).catch(() => undefined); }
  }

  async assertSafe(candidate: string): Promise<string> {
    try { return await assertPathWithinRoot(this.root, candidate); }
    catch (error) { throw new IntakeError('T2C-INTAKE-UNSAFE-PATH', error instanceof Error ? error.message : String(error), 'Use a non-symlink path inside the configured repository root.'); }
  }
}

export function hashEvent(event: IntakeEvent): string {
  const { hash: _hash, ...withoutHash } = event;
  return createHash('sha256').update(canonicalJson(withoutHash)).digest('hex');
}

function broken(message: string): never {
  throw new IntakeError('T2C-INTAKE-BROKEN-CHAIN', message, 'Restore the append-only stream from trusted history before retrying.');
}
function unsafe(message: string): never {
  throw new IntakeError('T2C-INTAKE-UNSAFE-PATH', message, 'Use canonical participant and ticket identifiers.');
}
