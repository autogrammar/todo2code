import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { clearA2aTaskStoreForTests, startA2aServer } from '../src/interfaces/a2a.js';
import { makeConfig } from './helpers.js';

interface RpcEnvelope {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: Array<{ '@type': string; reason: string; domain: string; metadata?: Record<string, string> }> };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function rpc(
  base: string,
  method: string,
  params: Record<string, unknown>,
  options: { token?: string; version?: string | null; id?: string; path?: string } = {},
): Promise<{ response: Response; payload: RpcEnvelope }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.version !== null) headers['A2A-Version'] = options.version ?? '1.0';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${base}${options.path ?? '/a2a'}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: options.id ?? 'req-1', method, params }),
  });
  return { response, payload: await response.json() as RpcEnvelope };
}

test('A2A v1.0 card, versioning, task methods and cursor pagination are coherent', async () => {
  clearA2aTaskStoreForTests();
  const config = makeConfig(process.cwd());
  config.a2a.port = 0;
  const server = await startA2aServer(config);
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;

    const cardResponse = await fetch(`${base}/.well-known/agent-card.json`);
    assert.equal(cardResponse.status, 200);
    assert.match(cardResponse.headers.get('cache-control') ?? '', /max-age=300/);
    assert.ok(cardResponse.headers.get('etag'));
    const card = await cardResponse.json() as Record<string, unknown>;
    assert.equal(card.name, 'todo2code');
    assert.deepEqual(card.supportedInterfaces, [{ url: config.a2a.publicUrl, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }]);
    assert.equal('security' in card, false);
    assert.equal('securityRequirements' in card, false);

    const missingVersion = await rpc(base, 'SendMessage', {
      message: { messageId: 'missing-version', role: 'ROLE_USER', parts: [{ text: 'Dodać test.' }] },
    }, { version: null });
    assert.equal(missingVersion.response.status, 400);
    assert.equal(missingVersion.payload.error?.code, -32009);
    assert.equal(missingVersion.payload.error?.data?.[0]?.reason, 'VERSION_NOT_SUPPORTED');
    assert.equal(missingVersion.payload.error?.data?.[0]?.domain, 'a2a-protocol.org');

    const queryVersion = await rpc(base, 'SendMessage', {
      message: { messageId: 'query-version', role: 'ROLE_USER', parts: [{ text: 'Dodać test wersji.' }], contextId: 'ctx-a2a' },
    }, { version: null, path: '/a2a?A2A-Version=1.0', id: 'query-version' });
    assert.equal(queryVersion.response.status, 200);
    const queryTask = (queryVersion.payload.result as { task: { id: string; status: { state: string }; artifacts: unknown[] } }).task;
    assert.equal(queryTask.status.state, 'TASK_STATE_COMPLETED');
    assert.equal(queryTask.artifacts.length, 1);

    const legacyAlias = await rpc(base, 'message/send', {
      message: { messageId: 'legacy', role: 'ROLE_USER', parts: [{ text: 'Legacy alias.' }] },
    }, { id: 'legacy-alias' });
    assert.equal(legacyAlias.payload.error?.code, -32601);

    const send = await rpc(base, 'SendMessage', {
      message: { messageId: 'msg-1', role: 'ROLE_USER', parts: [{ text: 'Dodać testy dla T2C-14.' }], contextId: 'ctx-a2a' },
    }, { id: 'send-1' });
    assert.equal(send.response.status, 200);
    const task = (send.payload.result as { task: { id: string; contextId: string; status: { state: string }; artifacts: unknown[]; history: unknown[] } }).task;
    assert.equal(task.contextId, 'ctx-a2a');
    assert.equal(task.status.state, 'TASK_STATE_COMPLETED');
    assert.equal(task.artifacts.length, 1);
    assert.equal(task.history.length, 2);

    const duplicate = await rpc(base, 'SendMessage', {
      message: { messageId: 'msg-1', role: 'ROLE_USER', parts: [{ text: 'Dodać testy dla T2C-14.' }], contextId: 'ctx-a2a' },
    }, { id: 'send-duplicate' });
    const duplicateTask = (duplicate.payload.result as { task: { id: string; artifacts: unknown[] } }).task;
    assert.equal(duplicateTask.id, task.id);
    assert.equal(duplicateTask.artifacts.length, 1);

    const get = await rpc(base, 'GetTask', { id: task.id, historyLength: 0 }, { id: 'get-1' });
    const getResult = get.payload.result as Record<string, unknown>;
    assert.equal(getResult.id, task.id);
    assert.equal('task' in getResult, false);
    assert.equal('history' in getResult, false);
    assert.ok(Array.isArray(getResult.artifacts));

    const firstPage = await rpc(base, 'ListTasks', {
      contextId: 'ctx-a2a', pageSize: 1, historyLength: 0,
    }, { id: 'list-1' });
    const firstResult = firstPage.payload.result as {
      tasks: Array<Record<string, unknown>>;
      nextPageToken: string;
      pageSize: number;
      totalSize: number;
    };
    assert.equal(firstResult.pageSize, 1);
    assert.equal(firstResult.totalSize, 2);
    assert.equal(firstResult.tasks.length, 1);
    assert.ok(firstResult.nextPageToken);
    assert.equal('artifacts' in (firstResult.tasks[0] ?? {}), false);
    assert.equal('history' in (firstResult.tasks[0] ?? {}), false);

    const secondPage = await rpc(base, 'ListTasks', {
      contextId: 'ctx-a2a', pageSize: 1, historyLength: 1, includeArtifacts: true, pageToken: firstResult.nextPageToken,
    }, { id: 'list-2' });
    const secondResult = secondPage.payload.result as {
      tasks: Array<Record<string, unknown>>;
      nextPageToken: string;
      pageSize: number;
      totalSize: number;
    };
    assert.equal(secondResult.tasks.length, 1);
    assert.equal(secondResult.nextPageToken, '');
    assert.ok(Array.isArray(secondResult.tasks[0]?.artifacts));
    assert.equal((secondResult.tasks[0]?.history as unknown[]).length, 1);

    const invalidPage = await rpc(base, 'ListTasks', { pageSize: 101 }, { id: 'list-invalid' });
    assert.equal(invalidPage.response.status, 400);
    assert.equal(invalidPage.payload.error?.code, -32602);

    const cancelCompleted = await rpc(base, 'CancelTask', { id: task.id }, { id: 'cancel-1' });
    assert.equal(cancelCompleted.payload.error?.code, -32002);
    assert.equal(cancelCompleted.payload.error?.data?.[0]?.reason, 'TASK_NOT_CANCELABLE');
  } finally {
    await closeServer(server);
    clearA2aTaskStoreForTests();
  }
});

test('A2A bearer authentication is declared with v1 security objects and enforced', async () => {
  clearA2aTaskStoreForTests();
  const config = makeConfig(process.cwd());
  config.a2a.port = 0;
  config.a2a.token = 'test-secret';
  const server = await startA2aServer(config);
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;

    const cardResponse = await fetch(`${base}/.well-known/agent-card.json`);
    const card = await cardResponse.json() as {
      securitySchemes: { bearerAuth: { httpAuthSecurityScheme: { scheme: string; bearerFormat: string } } };
      securityRequirements: Array<{ schemes: { bearerAuth: { list: string[] } } }>;
    };
    assert.equal(card.securitySchemes.bearerAuth.httpAuthSecurityScheme.scheme, 'Bearer');
    assert.equal(card.securitySchemes.bearerAuth.httpAuthSecurityScheme.bearerFormat, 'opaque');
    assert.deepEqual(card.securityRequirements, [{ schemes: { bearerAuth: { list: [] } } }]);

    const unauthorized = await rpc(base, 'ListTasks', {}, { id: 'unauthorized' });
    assert.equal(unauthorized.response.status, 401);
    assert.match(unauthorized.response.headers.get('www-authenticate') ?? '', /^Bearer/);

    const unauthorizedRuns = await fetch(`${base}/api/runs`);
    assert.equal(unauthorizedRuns.status, 401);
    assert.match(unauthorizedRuns.headers.get('www-authenticate') ?? '', /^Bearer/);
    const authorizedRuns = await fetch(`${base}/api/runs`, {
      headers: { Authorization: 'Bearer test-secret' },
    });
    assert.equal(authorizedRuns.status, 200);
    assert.ok(Array.isArray(((await authorizedRuns.json()) as { runs: unknown[] }).runs));

    const authorized = await rpc(base, 'SendMessage', {
      message: {
        messageId: 'secure-msg',
        role: 'ROLE_USER',
        parts: [{ data: { action: 'extract_nl', input: { text: 'Naprawić walidację.', file: 'secure.md' } } }],
      },
    }, { token: 'test-secret', id: 'authorized' });
    assert.equal(authorized.response.status, 200);
    const task = (authorized.payload.result as { task: { status: { state: string } } }).task;
    assert.equal(task.status.state, 'TASK_STATE_COMPLETED');
  } finally {
    await closeServer(server);
    clearA2aTaskStoreForTests();
  }
});

test('A2A file task store survives restart and preserves idempotency across replicas', async () => {
  clearA2aTaskStoreForTests();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-a2a-store-'));
  const storeRelative = '.intent/a2a-tasks.json';
  const config = makeConfig(root);
  config.a2a.port = 0;
  config.a2a.taskStorePath = storeRelative;

  const firstServer = await startA2aServer(config);
  let secondServer: Server | null = null;
  let thirdServer: Server | null = null;
  try {
    const firstAddress = firstServer.address();
    assert.ok(firstAddress && typeof firstAddress === 'object');
    const firstBase = `http://127.0.0.1:${firstAddress.port}`;
    const created = await rpc(firstBase, 'SendMessage', {
      message: {
        messageId: 'persistent-message',
        role: 'ROLE_USER',
        parts: [{ text: 'Dodać trwały magazyn zadań.' }],
        contextId: 'persistent-context',
      },
    }, { id: 'create-persistent' });
    const createdTask = (created.payload.result as { task: { id: string; status: { state: string } } }).task;
    assert.equal(createdTask.status.state, 'TASK_STATE_COMPLETED');

    await closeServer(firstServer);
    clearA2aTaskStoreForTests();

    secondServer = await startA2aServer(config);
    const secondAddress = secondServer.address();
    assert.ok(secondAddress && typeof secondAddress === 'object');
    const secondBase = `http://127.0.0.1:${secondAddress.port}`;
    const restored = await rpc(secondBase, 'GetTask', { id: createdTask.id }, { id: 'get-restored' });
    assert.equal((restored.payload.result as { id: string }).id, createdTask.id);

    const duplicate = await rpc(secondBase, 'SendMessage', {
      message: {
        messageId: 'persistent-message',
        role: 'ROLE_USER',
        parts: [{ text: 'Dodać trwały magazyn zadań.' }],
        contextId: 'persistent-context',
      },
    }, { id: 'duplicate-after-restart' });
    assert.equal((duplicate.payload.result as { task: { id: string } }).task.id, createdTask.id);

    thirdServer = await startA2aServer(config);
    const thirdAddress = thirdServer.address();
    assert.ok(thirdAddress && typeof thirdAddress === 'object');
    const thirdBase = `http://127.0.0.1:${thirdAddress.port}`;
    const clusterParams = {
      message: {
        messageId: 'cluster-message',
        role: 'ROLE_USER',
        parts: [{ text: 'Zweryfikować idempotency między replikami.' }],
        contextId: 'cluster-context',
      },
    };
    const [left, right] = await Promise.all([
      rpc(secondBase, 'SendMessage', clusterParams, { id: 'cluster-left' }),
      rpc(thirdBase, 'SendMessage', clusterParams, { id: 'cluster-right' }),
    ]);
    const leftId = (left.payload.result as { task: { id: string } }).task.id;
    const rightId = (right.payload.result as { task: { id: string } }).task.id;
    assert.equal(leftId, rightId);

    const listed = await rpc(thirdBase, 'ListTasks', {}, { id: 'list-persisted' });
    assert.equal((listed.payload.result as { totalSize: number }).totalSize, 2);

    const background = await rpc(secondBase, 'SendMessage', {
      message: {
        messageId: 'background-message',
        role: 'ROLE_USER',
        parts: [{ text: 'Zapisać wynik wykonania w tle.' }],
        contextId: 'background-context',
      },
      configuration: { returnImmediately: true },
    }, { id: 'background-create' });
    const backgroundTask = (background.payload.result as { task: { id: string; status: { state: string } } }).task;
    assert.equal(backgroundTask.status.state, 'TASK_STATE_WORKING');

    let backgroundState = backgroundTask.status.state;
    for (let attempt = 0; attempt < 50 && backgroundState === 'TASK_STATE_WORKING'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const current = await rpc(thirdBase, 'GetTask', { id: backgroundTask.id }, { id: `background-${attempt}` });
      backgroundState = (current.payload.result as { status: { state: string } }).status.state;
    }
    assert.equal(backgroundState, 'TASK_STATE_COMPLETED');

    const storePath = path.join(root, storeRelative);
    const snapshot = JSON.parse(await fs.readFile(storePath, 'utf8')) as { schemaVersion: string; tasks: unknown[] };
    assert.equal(snapshot.schemaVersion, 't2c.a2a-task-store/v1');
    assert.equal(snapshot.tasks.length, 3);
    assert.equal((await fs.stat(storePath)).mode & 0o777, 0o600);
  } finally {
    if (secondServer?.listening) await closeServer(secondServer);
    if (thirdServer?.listening) await closeServer(thirdServer);
    if (firstServer.listening) await closeServer(firstServer);
    clearA2aTaskStoreForTests();
  }
});
