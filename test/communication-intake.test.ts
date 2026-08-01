import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  COMMAND_SCHEMA_VERSION,
  INTAKE_SCHEMA_VERSION,
  QUERY_SCHEMA_VERSION,
  payloadHash,
  type IntakeCommand,
  type IntakeEnvelope,
  type IntakeQuery,
  type ParticipantV2,
} from '../src/communication/intake-contract.js';
import { decodeIntakeEnvelope, encodeIntakeEnvelope } from '../src/communication/intake-protobuf.js';
import { GovernedIntakeService } from '../src/communication/intake-service.js';
import { loadParticipantIdentityRegistry } from '../src/communication/identity.js';

const exec = promisify(execFile);
const timestamp = '2026-08-01T12:00:00.000Z';

function envelope<T extends IntakeCommand | IntakeQuery>(
  payload: T,
  principal: string,
  expectedVersion: number | null,
  idempotencyKey: string,
): IntakeEnvelope<T> {
  return {
    schemaVersion: INTAKE_SCHEMA_VERSION,
    messageId: `message-${idempotencyKey}`,
    correlationId: 'correlation-intake-test',
    causationId: null,
    idempotencyKey,
    authenticatedPrincipal: principal,
    expectedVersion,
    timestamp,
    payloadHash: payloadHash(payload),
    payload,
  };
}

function manager(): ParticipantV2 {
  return {
    id: 'human:manager', kind: 'human', displayName: 'Manager', governanceRole: 'manager',
    capabilities: ['assign_participant', 'assign_role', 'capture_own_message', 'rebuild_projection', 'verify_event_stream'],
    principals: [{ provider: 'ide', subject: 'manager-1', verifiedAt: timestamp }],
    ticketIds: ['ticket-020'],
  };
}

function developer(): ParticipantV2 {
  return {
    id: 'human:alice', kind: 'human', displayName: 'Alice', governanceRole: 'dev',
    capabilities: ['capture_own_message'],
    principals: [{ provider: 'ide', subject: 'alice-1', verifiedAt: timestamp }],
    ticketIds: ['ticket-020', 'ticket-021'],
  };
}

function register(participant: ParticipantV2): IntakeCommand {
  return { schemaVersion: COMMAND_SCHEMA_VERSION, type: 'RegisterParticipant', participant };
}

test('trusted intake persists roles across tickets and fails closed without rejected writes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-intake-'));
  await fs.mkdir(path.join(root, 'project', 'ticket-020'), { recursive: true });
  await fs.mkdir(path.join(root, 'project', 'ticket-021'), { recursive: true });
  const service = new GovernedIntakeService(root);

  const bootstrap = await service.command(envelope(register(manager()), 'trusted:bootstrap', 0, 'register-manager'));
  assert.equal(bootstrap.accepted, true);
  const addDeveloper = await service.command(envelope(register(developer()), 'ide:manager-1', 1, 'register-alice'));
  assert.equal(addDeveloper.accepted, true);

  const firstPayload: IntakeCommand = {
    schemaVersion: COMMAND_SCHEMA_VERSION, type: 'CaptureMessage', participantId: 'human:alice',
    governanceRole: 'dev', ticketId: 'ticket-020', message: 'Implement the deterministic intake boundary.',
  };
  const firstEnvelope = envelope(firstPayload, 'ide:alice-1', 2, 'capture-020');
  const first = await service.command(firstEnvelope);
  assert.equal(first.accepted, true);
  const replay = await service.command(firstEnvelope);
  assert.equal(replay.accepted, true);
  assert.equal(replay.actualVersion, 3);
  assert.equal((replay.data as { duplicate: boolean }).duplicate, true);

  const second = await service.command(envelope({
    ...firstPayload, ticketId: 'ticket-021', message: 'Keep the same developer role on the next ticket.',
  }, 'ide:alice-1', 3, 'capture-021'));
  assert.equal(second.accepted, true);
  assert.match(await fs.readFile(path.join(root, 'project', 'ticket-020', 'dev-alice.md'), 'utf8'), /role: dev/);
  assert.match(await fs.readFile(path.join(root, 'project', 'ticket-021', 'dev-alice.md'), 'utf8'), /role: dev/);

  const roleQuery: IntakeQuery = { schemaVersion: QUERY_SCHEMA_VERSION, type: 'GetRole', participantId: 'human:alice' };
  const role = await service.query(envelope(roleQuery, 'ide:alice-1', null, 'query-role'));
  assert.equal((role.data as ParticipantV2).governanceRole, 'dev');
  assert.deepEqual((role.data as ParticipantV2).ticketIds, ['ticket-020', 'ticket-021']);

  const beforeRejected = role.actualVersion;
  const spoof = await service.command(envelope({ ...firstPayload, governanceRole: 'manager' }, 'ide:alice-1', beforeRejected, 'spoof-role'));
  assert.equal(spoof.accepted, false);
  assert.equal(spoof.diagnostic?.code, 'T2C-INTAKE-ROLE-MISMATCH');
  assert.equal(spoof.actualVersion, beforeRejected);

  const unauthorizedRoleChange = await service.command(envelope({
    schemaVersion: COMMAND_SCHEMA_VERSION, type: 'AssignRole', participantId: 'human:alice',
    governanceRole: 'manager', ticketIds: ['ticket-020'], capabilities: ['assign_role'],
  }, 'ide:alice-1', beforeRejected, 'self-promote'));
  assert.equal(unauthorizedRoleChange.accepted, false);
  assert.equal(unauthorizedRoleChange.diagnostic?.code, 'T2C-INTAKE-UNAUTHORIZED');
  assert.equal(unauthorizedRoleChange.actualVersion, beforeRejected);

  const sensitiveValue = `${['API', 'KEY'].join('_')}=${'abcdefghijklmnopqrstuvwxyz'}123456`;
  const secret = await service.command(envelope({
    ...firstPayload, ticketId: 'ticket-021', message: sensitiveValue,
  }, 'ide:alice-1', beforeRejected, 'secret'));
  assert.equal(secret.accepted, false);
  assert.equal(secret.diagnostic?.code, 'T2C-INTAKE-SECRET-INPUT');
  assert.equal(secret.actualVersion, beforeRejected);
  const eventText = (await Promise.all((await fs.readdir(path.join(root, 'project', '.intake', 'events')))
    .map((name) => fs.readFile(path.join(root, 'project', '.intake', 'events', name), 'utf8')))).join('\n');
  assert.equal(eventText.includes(sensitiveValue), false);

  const stale = await service.command(envelope({ ...firstPayload, message: 'Stale write.' }, 'ide:alice-1', 1, 'stale'));
  assert.equal(stale.accepted, false);
  assert.equal(stale.diagnostic?.code, 'T2C-INTAKE-VERSION-CONFLICT');
  assert.equal(stale.diagnostic?.retryable, true);

  await fs.writeFile(path.join(root, 'project', 'ticket-020', 'dev-alice.md'), 'untrusted content\n', 'utf8');
  const drift = await service.command(envelope({ ...firstPayload, message: 'Must not overwrite drift.' }, 'ide:alice-1', beforeRejected, 'drift'));
  assert.equal(drift.accepted, false);
  assert.equal(drift.diagnostic?.code, 'T2C-INTAKE-PROJECTION-DRIFT');
  assert.equal(await fs.readFile(path.join(root, 'project', 'ticket-020', 'dev-alice.md'), 'utf8'), 'untrusted content\n');
  assert.equal(drift.actualVersion, beforeRejected);

  await fs.writeFile(path.join(root, 'project', 'ticket-020', 'user-alice.md'), 'legacy/spoofed role file\n', 'utf8');
  const filenameMismatch = await service.command(envelope({ ...firstPayload, message: 'Conflicting filename.' }, 'ide:alice-1', beforeRejected, 'filename-mismatch'));
  assert.equal(filenameMismatch.accepted, false);
  assert.equal(filenameMismatch.diagnostic?.code, 'T2C-INTAKE-FILENAME-MISMATCH');
  assert.equal(filenameMismatch.actualVersion, beforeRejected);
  const projectionQuery: IntakeQuery = {
    schemaVersion: QUERY_SCHEMA_VERSION, type: 'ValidateProjection', participantId: 'human:alice', ticketId: 'ticket-020',
  };
  const migrationPlan = await service.query(envelope(projectionQuery, 'ide:alice-1', null, 'migration-dry-run'));
  assert.equal((migrationPlan.data as { reason: string }).reason, 'legacy-migration-conflict');
  assert.equal((migrationPlan.data as { migration: { dryRun: boolean; conflict: boolean } }).migration.dryRun, true);
  assert.equal((migrationPlan.data as { migration: { dryRun: boolean; conflict: boolean } }).migration.conflict, true);

  const registry = JSON.parse(await fs.readFile(path.join(root, 'project', 'participants.v2.json'), 'utf8')) as { schemaVersion: string; participants: unknown[] };
  assert.equal(registry.schemaVersion, 't2c.participant-registry/v2');
  assert.equal(registry.participants.length, 2);
  const loaded = await loadParticipantIdentityRegistry(root, path.join(root, 'project'), 524_288);
  assert.equal(loaded?.byId.get('human:alice')?.governanceRole, 'dev');
  assert.deepEqual(loaded?.byId.get('human:alice')?.humanAliases, ['alice-1']);
});

test('agents cannot create human projections and a damaged event hash fails verification', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-intake-agent-'));
  await fs.mkdir(path.join(root, 'project', 'ticket-020'), { recursive: true });
  const service = new GovernedIntakeService(root);
  await service.command(envelope(register(manager()), 'trusted:bootstrap', 0, 'manager'));
  const agent: ParticipantV2 = {
    id: 'agent:bot', kind: 'agent', displayName: 'Bot', governanceRole: null,
    capabilities: [], principals: [{ provider: 'a2a', subject: 'bot-1', verifiedAt: timestamp }], ticketIds: ['ticket-020'],
  };
  assert.equal((await service.command(envelope(register(agent), 'ide:manager-1', 1, 'agent'))).accepted, true);
  const rejected = await service.command(envelope({
    schemaVersion: COMMAND_SCHEMA_VERSION, type: 'CaptureMessage', participantId: 'agent:bot',
    governanceRole: 'dev', ticketId: 'ticket-020', message: 'Spoof a human file.',
  }, 'a2a:bot-1', 2, 'agent-capture'));
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.diagnostic?.code, 'T2C-INTAKE-UNAUTHORIZED');
  assert.deepEqual((await fs.readdir(path.join(root, 'project', 'ticket-020'))), []);

  const firstEvent = path.join(root, 'project', '.intake', 'events', '000000000001.json');
  const tampered = JSON.parse(await fs.readFile(firstEvent, 'utf8')) as Record<string, unknown>;
  tampered.payloadHash = '0'.repeat(64);
  await fs.writeFile(firstEvent, `${JSON.stringify(tampered)}\n`, 'utf8');
  const query: IntakeQuery = { schemaVersion: QUERY_SCHEMA_VERSION, type: 'GetRole', participantId: 'agent:bot' };
  const broken = await service.query(envelope(query, 'a2a:bot-1', null, 'broken-query'));
  assert.equal(broken.accepted, false);
  assert.equal(broken.diagnostic?.code, 'T2C-INTAKE-BROKEN-CHAIN');
});

test('TypeScript and dependency-free Python codecs share golden bytes and preserve unknown fields', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-intake-protobuf-'));
  const payload: IntakeQuery = { schemaVersion: QUERY_SCHEMA_VERSION, type: 'GetRole', participantId: 'human:alice' };
  const value = envelope(payload, 'ide:alice-1', null, 'golden-query');
  const jsonPath = path.join(root, 'envelope.json');
  const pythonPath = path.join(root, 'python.pb');
  await fs.writeFile(jsonPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await exec('python3', ['src/interfaces/intake_cli.py', 'encode', jsonPath, pythonPath], { cwd: process.cwd() });
  const typescriptBytes = Buffer.from(encodeIntakeEnvelope(value));
  const pythonBytes = await fs.readFile(pythonPath);
  assert.deepEqual(pythonBytes, typescriptBytes);
  assert.deepEqual(decodeIntakeEnvelope(typescriptBytes, 'query'), value);

  const unknown = Buffer.from([0x9a, 0x06, 0x03, 0x61, 0x62, 0x63]);
  const decoded = decodeIntakeEnvelope(Buffer.concat([typescriptBytes, unknown]), 'query');
  assert.deepEqual(decoded.unknownFields, [unknown.toString('base64')]);
  assert.deepEqual(Buffer.from(encodeIntakeEnvelope(decoded)), Buffer.concat([typescriptBytes, unknown]));
});
