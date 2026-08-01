import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { payloadHash, type IntakeCommand, type IntakeQuery } from '../src/communication/intake-contract.js';
import { decodeIntakeResult, encodeIntakeEnvelope } from '../src/communication/intake-protobuf.js';
import { clearA2aTaskStoreForTests, startA2aServer } from '../src/interfaces/a2a.js';
import { makeConfig } from './helpers.js';

function envelope(payload: IntakeCommand, principal: string, version: number, key: string): Record<string, unknown> {
  return {
    schemaVersion: 't2c.intake-envelope/v1', messageId: key, correlationId: 'a2a-intake', causationId: null,
    idempotencyKey: key, authenticatedPrincipal: principal, expectedVersion: version,
    timestamp: '2026-08-01T12:00:00.000Z', payloadHash: payloadHash(payload), payload,
  };
}

async function send(base: string, id: string, part: Record<string, unknown>, bearer: string): Promise<{ status: { state: string }; artifacts: Array<{ parts: Array<{ data?: unknown; raw?: string; mediaType?: string }> }> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'A2A-Version': '1.0' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const response = await fetch(`${base}/a2a`, {
    method: 'POST', headers,
    body: JSON.stringify({
      jsonrpc: '2.0', id, method: 'SendMessage',
      params: { message: { messageId: id, role: 'ROLE_USER', parts: [part] } },
    }),
  });
  const body = await response.json() as { result: { task: { status: { state: string }; artifacts: Array<{ parts: Array<{ data?: unknown; raw?: string; mediaType?: string }> }> } } };
  return body.result.task;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('A2A governed-intake skill completes accepted commands and rejects domain failures', async () => {
  clearA2aTaskStoreForTests();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-a2a-intake-'));
  await fs.mkdir(path.join(root, 'project', 'ticket-020'), { recursive: true });
  const config = makeConfig(root); config.a2a.port = 0;
  const bearer = 'test-a2a-intake';
  config.a2a.token = bearer;
  const bearerSubject = createHash('sha256').update(`Bearer ${bearer}`).digest('hex');
  const server = await startA2aServer(config);
  try {
    const address = server.address(); assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const register: IntakeCommand = {
      schemaVersion: 't2c.intake-command/v1', type: 'RegisterParticipant',
      participant: {
        id: 'human:manager', kind: 'human', displayName: 'Manager', governanceRole: 'manager',
        capabilities: ['assign_participant', 'assign_role', 'capture_own_message', 'rebuild_projection', 'verify_event_stream'],
        principals: [{ provider: 'bearer', subject: bearerSubject, verifiedAt: '2026-08-01T12:00:00.000Z' }], ticketIds: ['ticket-020'],
      },
    };
    const accepted = await send(base, 'register', { data: { action: 'intake_command', input: { envelope: envelope(register, `bearer:${bearerSubject}`, 0, 'a2a-register') } }, mediaType: 'application/json' }, bearer);
    assert.equal(accepted.status.state, 'TASK_STATE_COMPLETED');
    assert.equal((accepted.artifacts[0]?.parts[0]?.data as { accepted: boolean }).accepted, true);

    const capture: IntakeCommand = {
      schemaVersion: 't2c.intake-command/v1', type: 'CaptureMessage', participantId: 'human:missing',
      governanceRole: 'user', ticketId: 'ticket-020', message: 'Spoofed message.',
    };
    const rejected = await send(base, 'reject', { data: { action: 'intake_command', input: { envelope: envelope(capture, 'a2a:missing', 1, 'a2a-reject') } }, mediaType: 'application/json' }, bearer);
    assert.equal(rejected.status.state, 'TASK_STATE_REJECTED');
    assert.equal((rejected.artifacts[0]?.parts[0]?.data as { diagnostic: { code: string } }).diagnostic.code, 'T2C-INTAKE-UNKNOWN-ACTOR');

    const query: IntakeQuery = { schemaVersion: 't2c.intake-query/v1', type: 'GetRole', participantId: 'human:manager' };
    const queryEnvelope = {
      schemaVersion: 't2c.intake-envelope/v1' as const, messageId: 'protobuf-query', correlationId: 'a2a-intake',
      causationId: null, idempotencyKey: 'protobuf-query', authenticatedPrincipal: `bearer:${bearerSubject}`, expectedVersion: null,
      timestamp: '2026-08-01T12:00:00.000Z', payloadHash: payloadHash(query), payload: query,
    };
    const protobuf = await send(base, 'protobuf-query', {
      raw: Buffer.from(encodeIntakeEnvelope(queryEnvelope)).toString('base64'), mediaType: 'application/x-protobuf',
    }, bearer);
    assert.equal(protobuf.status.state, 'TASK_STATE_COMPLETED');
    const protobufPart = protobuf.artifacts[0]?.parts[0];
    assert.equal(protobufPart?.mediaType, 'application/x-protobuf');
    assert.ok(protobufPart?.raw);
    const decoded = decodeIntakeResult(Buffer.from(protobufPart.raw, 'base64'));
    assert.equal((decoded.data as { governanceRole: string }).governanceRole, 'manager');
  } finally { await close(server); }

  clearA2aTaskStoreForTests();
  const publicRoot = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-a2a-public-intake-'));
  await fs.mkdir(path.join(publicRoot, 'project'), { recursive: true });
  const publicConfig = makeConfig(publicRoot); publicConfig.a2a.port = 0;
  const publicServer = await startA2aServer(publicConfig);
  try {
    const address = publicServer.address(); assert.ok(address && typeof address === 'object');
    const register: IntakeCommand = {
      schemaVersion: 't2c.intake-command/v1', type: 'RegisterParticipant',
      participant: {
        id: 'human:attacker', kind: 'human', displayName: 'Attacker', governanceRole: 'manager',
        capabilities: ['assign_participant'], principals: [{ provider: 'a2a', subject: 'public', verifiedAt: '2026-08-01T12:00:00.000Z' }], ticketIds: ['ticket-020'],
      },
    };
    const result = await send(`http://127.0.0.1:${address.port}`, 'public-bootstrap', {
      data: { action: 'intake_command', input: { envelope: envelope(register, 'trusted:spoof', 0, 'public-bootstrap') } },
      mediaType: 'application/json',
    }, '');
    assert.equal(result.status.state, 'TASK_STATE_REJECTED');
    assert.equal((result.artifacts[0]?.parts[0]?.data as { diagnostic: { code: string } }).diagnostic.code, 'T2C-INTAKE-UNKNOWN-ACTOR');
  } finally { await close(publicServer); }
});
