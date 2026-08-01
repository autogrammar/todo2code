import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { payloadHash, type IntakeCommand, type IntakeQuery } from '../src/communication/intake-contract.js';

const exec = promisify(execFile);

function wrap(payload: IntakeCommand | IntakeQuery, principal: string, version: number | null, key: string): Record<string, unknown> {
  return {
    schemaVersion: 't2c.intake-envelope/v1', messageId: `message-${key}`, correlationId: 'cli-test',
    causationId: null, idempotencyKey: key, authenticatedPrincipal: principal, expectedVersion: version,
    timestamp: '2026-08-01T12:00:00.000Z', payloadHash: payloadHash(payload), payload,
  };
}

test('TypeScript and Python CLIs execute the same intake command/query handler', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cli-intake-'));
  await fs.mkdir(path.join(root, 'project'), { recursive: true });
  const repository = process.cwd();
  const cli = path.join(repository, 'dist', 'src', 'cli.js');
  const environment = { ...process.env, T2C_ROOT: root, T2C_ENV_FILE: path.join(root, 'missing.env'), OPENROUTER_API_KEY: '' };
  const command: IntakeCommand = {
    schemaVersion: 't2c.intake-command/v1', type: 'RegisterParticipant',
    participant: {
      id: 'human:manager', kind: 'human', displayName: 'Manager', governanceRole: 'manager',
      capabilities: ['assign_participant', 'assign_role', 'capture_own_message', 'rebuild_projection', 'verify_event_stream'],
      principals: [{ provider: 'shell', subject: 'manager', verifiedAt: '2026-08-01T12:00:00.000Z' }],
      ticketIds: ['ticket-020'],
    },
  };
  const commandPath = path.join(root, 'command.json');
  await fs.writeFile(commandPath, `${JSON.stringify(wrap(command, 'trusted:cli', 0, 'cli-register'), null, 2)}\n`, 'utf8');
  const registered = await exec(process.execPath, [cli, 'intake', 'command', commandPath, '--root', '.'], { cwd: root, env: environment });
  assert.equal(JSON.parse(registered.stdout).accepted, true);

  const query: IntakeQuery = { schemaVersion: 't2c.intake-query/v1', type: 'GetRole', participantId: 'human:manager' };
  const queryPath = path.join(root, 'query.json');
  await fs.writeFile(queryPath, `${JSON.stringify(wrap(query, 'shell:manager', null, 'cli-query'), null, 2)}\n`, 'utf8');
  const queried = await exec('python3', [
    path.join(repository, 'src', 'interfaces', 'intake_cli.py'), 'query', queryPath,
    '--repository', repository, '--root', root,
  ], { cwd: root, env: environment });
  const result = JSON.parse(queried.stdout) as { accepted: boolean; data: { governanceRole: string } };
  assert.equal(result.accepted, true);
  assert.equal(result.data.governanceRole, 'manager');
});
