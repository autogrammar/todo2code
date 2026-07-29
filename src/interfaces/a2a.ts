import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import http, { type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { getConfig, loadEnvFile } from '../config/env.js';
import { executeAction, type T2CAction } from '../services/actions.js';
import { diffUiHtml } from '../web/diff-ui.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

type A2ATaskState =
  | 'TASK_STATE_SUBMITTED'
  | 'TASK_STATE_WORKING'
  | 'TASK_STATE_COMPLETED'
  | 'TASK_STATE_FAILED'
  | 'TASK_STATE_CANCELED'
  | 'TASK_STATE_INPUT_REQUIRED'
  | 'TASK_STATE_REJECTED'
  | 'TASK_STATE_AUTH_REQUIRED';

interface A2APart {
  text?: string;
  raw?: string;
  url?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
  filename?: string;
  mediaType?: string;
}

interface A2AMessage {
  messageId: string;
  role: 'ROLE_USER' | 'ROLE_AGENT';
  parts: A2APart[];
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: string[];
  extensions?: string[];
  metadata?: Record<string, unknown>;
}

interface A2AArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
  extensions?: string[];
}

interface A2ATask {
  id: string;
  contextId: string;
  status: {
    state: A2ATaskState;
    message?: A2AMessage;
    timestamp: string;
  };
  artifacts: A2AArtifact[];
  history: A2AMessage[];
  metadata: Record<string, unknown>;
}

interface StoredTask extends A2ATask {
  owner: string;
}

interface SendConfiguration {
  returnImmediately: boolean;
  historyLength: number | undefined;
}

interface PreparedTask {
  task: StoredTask;
  shouldExecute: boolean;
}

interface ListCursor {
  version: 1;
  timestamp: string;
  id: string;
  filter: string;
}

const tasks = new Map<string, StoredTask>();
const messageTaskIndex = new Map<string, string>();
const ACTIONS: T2CAction[] = ['extract_nl', 'extract_git', 'extract_ast', 'extract_markdown', 'extract_docs', 'link', 'diagnose', 'summarize', 'diff', 'diff_files', 'diff_git', 'reality', 'pipeline'];
const TERMINAL_STATES = new Set<A2ATaskState>([
  'TASK_STATE_COMPLETED',
  'TASK_STATE_FAILED',
  'TASK_STATE_CANCELED',
  'TASK_STATE_REJECTED',
]);
const TASK_STATES = new Set<A2ATaskState>([
  'TASK_STATE_SUBMITTED',
  'TASK_STATE_WORKING',
  'TASK_STATE_COMPLETED',
  'TASK_STATE_FAILED',
  'TASK_STATE_CANCELED',
  'TASK_STATE_INPUT_REQUIRED',
  'TASK_STATE_REJECTED',
  'TASK_STATE_AUTH_REQUIRED',
]);

export function clearA2aTaskStoreForTests(): void {
  tasks.clear();
  messageTaskIndex.clear();
}

export async function startA2aServer(config?: T2CConfig): Promise<http.Server> {
  await loadEnvFile();
  const resolvedConfig = config ?? getConfig();
  const server = http.createServer((request, response) => {
    handleHttp(request, response, resolvedConfig).catch((error) => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
      } else {
        response.end();
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(resolvedConfig.a2a.port, resolvedConfig.a2a.host, () => resolve());
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : resolvedConfig.a2a.port;
  process.stderr.write(`[t2c:a2a] listening on ${resolvedConfig.a2a.host}:${port}\n`);
  return server;
}

async function handleHttp(request: IncomingMessage, response: ServerResponse, config: T2CConfig): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (request.method === 'GET' && url.pathname === '/healthz') {
    sendJson(response, 200, { status: 'ok', service: 'todo2code', protocol: 'A2A', version: '1.0' });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/.well-known/agent-card.json') {
    sendAgentCard(request, response, config);
    return;
  }
  if (request.method === 'GET' && url.pathname === '/ui') {
    sendText(response, 200, diffUiHtml(), 'text/html; charset=utf-8', {
      'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
    });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/') {
    sendJson(response, 200, { name: 'todo2code A2A server', agentCard: '/.well-known/agent-card.json', endpoint: '/a2a', diffApi: '/api/diff', ui: '/ui' });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/diff') {
    if (!authorized(request, config)) {
      response.setHeader('WWW-Authenticate', 'Bearer realm="todo2code"');
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }
    try {
      const input = JSON.parse(await readBody(request, config.a2a.maxBodyBytes)) as Record<string, unknown>;
      sendJson(response, 200, await executeAction('diff', input, config));
    } catch (error) {
      const status = error instanceof BodyTooLargeError ? 413 : 400;
      sendJson(response, status, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method !== 'POST' || !['/a2a', '/'].includes(url.pathname)) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }
  if (!authorized(request, config)) {
    response.setHeader('WWW-Authenticate', 'Bearer realm="todo2code"');
    sendJson(response, 401, { error: 'Unauthorized' });
    return;
  }

  const requestedVersion = a2aVersion(request.headers, url);
  if (requestedVersion !== '1.0') {
    sendJson(response, 400, rpcError(null, -32009, `A2A version not supported: ${requestedVersion}`, { requestedVersion }));
    return;
  }

  let rpc: JsonRpcRequest;
  try {
    rpc = JSON.parse(await readBody(request, config.a2a.maxBodyBytes)) as JsonRpcRequest;
  } catch (error) {
    const status = error instanceof BodyTooLargeError ? 413 : 400;
    sendJson(response, status, rpcError(null, -32700, error instanceof Error ? error.message : 'Invalid JSON'));
    return;
  }
  if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    sendJson(response, 400, rpcError(rpc.id ?? null, -32600, 'Invalid JSON-RPC request'));
    return;
  }

  const isNotification = rpc.id === undefined;
  try {
    const result = await handleRpc(rpc, config, principalForRequest(request, config));
    if (isNotification) {
      response.writeHead(204, { 'Cache-Control': 'no-store' });
      response.end();
      return;
    }
    sendJson(response, 200, { jsonrpc: '2.0', id: rpc.id ?? null, result });
  } catch (error) {
    if (isNotification) {
      response.writeHead(204, { 'Cache-Control': 'no-store' });
      response.end();
      return;
    }
    const code = error instanceof A2ARequestError ? error.code : -32603;
    const metadata = error instanceof A2ARequestError ? error.metadata : undefined;
    sendJson(response, code === -32602 || code === -32005 ? 400 : 200, rpcError(rpc.id ?? null, code, error instanceof Error ? error.message : String(error), metadata));
  }
}

async function handleRpc(request: JsonRpcRequest, config: T2CConfig, principal: string): Promise<unknown> {
  const params = request.params ?? {};
  if (request.method === 'SendMessage') {
    const message = parseMessage(params.message);
    ensureSupportedMessageContent(message);
    const sendConfiguration = parseSendConfiguration(params.configuration);
    const prepared = prepareTask(message, principal);
    const execution = () => executeMessage(prepared.task, message, params, config);
    if (prepared.shouldExecute) {
      if (sendConfiguration.returnImmediately) {
        void Promise.resolve().then(execution);
      } else {
        await execution();
      }
    }
    return {
      task: taskView(prepared.task, {
        includeArtifacts: true,
        historyLength: sendConfiguration.historyLength,
        defaultHistoryLength: undefined,
      }),
    };
  }
  if (request.method === 'GetTask') {
    const id = stringParam(params.id, 'id');
    const task = ownedTask(id, principal);
    const historyLength = optionalInteger(params.historyLength, 'historyLength', 0, 100_000);
    return taskView(task, { includeArtifacts: true, historyLength, defaultHistoryLength: undefined });
  }
  if (request.method === 'ListTasks') {
    return listTasks(params, principal);
  }
  if (request.method === 'CancelTask') {
    const id = stringParam(params.id, 'id');
    const task = ownedTask(id, principal);
    if (task.status.state === 'TASK_STATE_CANCELED') {
      return taskView(task, { includeArtifacts: true, historyLength: undefined, defaultHistoryLength: undefined });
    }
    if (TERMINAL_STATES.has(task.status.state)) {
      throw new A2ARequestError(-32002, `Task is not cancelable in state ${task.status.state}`, { taskId: task.id, state: task.status.state });
    }
    task.status = { state: 'TASK_STATE_CANCELED', timestamp: new Date().toISOString() };
    task.metadata.active = false;
    return taskView(task, { includeArtifacts: true, historyLength: undefined, defaultHistoryLength: undefined });
  }
  throw new A2ARequestError(-32601, `Method not found: ${request.method}`);
}

function prepareTask(message: A2AMessage, principal: string): PreparedTask {
  const messageKey = `${principal}\u0000${message.messageId}`;
  const indexedTaskId = messageTaskIndex.get(messageKey);
  if (indexedTaskId) {
    const indexedTask = tasks.get(indexedTaskId);
    if (indexedTask && indexedTask.owner === principal) return { task: indexedTask, shouldExecute: false };
  }

  if (message.taskId) {
    const existing = ownedTask(message.taskId, principal);
    if (existing.history.some((entry) => entry.messageId === message.messageId)) return { task: existing, shouldExecute: false };
    if (message.contextId && message.contextId !== existing.contextId) {
      throw new A2ARequestError(-32602, `message.contextId does not match task context ${existing.contextId}`);
    }
    if (TERMINAL_STATES.has(existing.status.state)) {
      throw new A2ARequestError(-32004, `Cannot continue terminal task ${existing.id}; start a new task in context ${existing.contextId}`, { taskId: existing.id, state: existing.status.state });
    }
    if (existing.status.state === 'TASK_STATE_WORKING') {
      throw new A2ARequestError(-32004, `Task is already working: ${existing.id}`, { taskId: existing.id, state: existing.status.state });
    }
    const normalizedMessage = normalizeUserMessage(message, existing.contextId, existing.id);
    existing.history.push(normalizedMessage);
    existing.status = { state: 'TASK_STATE_WORKING', timestamp: new Date().toISOString() };
    existing.metadata.active = true;
    messageTaskIndex.set(messageKey, existing.id);
    return { task: existing, shouldExecute: true };
  }

  const taskId = randomUUID();
  const contextId = message.contextId ?? randomUUID();
  const normalizedMessage = normalizeUserMessage(message, contextId, taskId);
  const task: StoredTask = {
    id: taskId,
    contextId,
    status: { state: 'TASK_STATE_WORKING', timestamp: new Date().toISOString() },
    artifacts: [],
    history: [normalizedMessage],
    metadata: {
      service: 'todo2code',
      protocolVersion: '1.0',
      createdAt: new Date().toISOString(),
      active: true,
    },
    owner: principal,
  };
  tasks.set(taskId, task);
  messageTaskIndex.set(messageKey, taskId);
  return { task, shouldExecute: true };
}

async function executeMessage(task: StoredTask, message: A2AMessage, params: Record<string, unknown>, config: T2CConfig): Promise<void> {
  if (task.status.state !== 'TASK_STATE_WORKING') return;
  try {
    const command = parseCommand(message, params);
    task.metadata.lastAction = command.action;
    const result = await executeAction(command.action, command.input, config);
    if (currentTaskState(task) === 'TASK_STATE_CANCELED') return;
    task.artifacts.push({
      artifactId: randomUUID(),
      name: `${command.action}-result.json`,
      description: `todo2code result for ${command.action}`,
      parts: [{ data: result, mediaType: 'application/json' }],
    });
    const agentMessage: A2AMessage = {
      messageId: randomUUID(),
      role: 'ROLE_AGENT',
      contextId: task.contextId,
      taskId: task.id,
      parts: [{ text: `todo2code completed ${command.action}` }],
    };
    task.history.push(agentMessage);
    task.status = { state: 'TASK_STATE_COMPLETED', message: agentMessage, timestamp: new Date().toISOString() };
    task.metadata.active = false;
  } catch (error) {
    if (currentTaskState(task) === 'TASK_STATE_CANCELED') return;
    const agentMessage: A2AMessage = {
      messageId: randomUUID(),
      role: 'ROLE_AGENT',
      contextId: task.contextId,
      taskId: task.id,
      parts: [{ text: error instanceof Error ? error.message : String(error) }],
    };
    task.history.push(agentMessage);
    task.status = { state: 'TASK_STATE_FAILED', message: agentMessage, timestamp: new Date().toISOString() };
    task.metadata.active = false;
  }
}

function currentTaskState(task: StoredTask): A2ATaskState {
  return task.status.state;
}

function listTasks(params: Record<string, unknown>, principal: string): Record<string, unknown> {
  const contextId = optionalString(params.contextId, 'contextId');
  const status = optionalTaskState(params.status);
  const pageSize = optionalInteger(params.pageSize, 'pageSize', 1, 100) ?? 50;
  const historyLength = optionalInteger(params.historyLength, 'historyLength', 0, 100_000);
  const includeArtifacts = optionalBoolean(params.includeArtifacts, 'includeArtifacts') ?? false;
  const statusTimestampAfter = optionalTimestamp(params.statusTimestampAfter, 'statusTimestampAfter');
  const filter = JSON.stringify({ contextId: contextId ?? null, status: status ?? null, statusTimestampAfter: statusTimestampAfter ?? null });

  const filtered = [...tasks.values()]
    .filter((task) => task.owner === principal)
    .filter((task) => !contextId || task.contextId === contextId)
    .filter((task) => !status || task.status.state === status)
    .filter((task) => !statusTimestampAfter || Date.parse(task.status.timestamp) >= Date.parse(statusTimestampAfter))
    .sort(compareTasksByUpdate);

  const pageToken = optionalString(params.pageToken, 'pageToken');
  const cursor = pageToken ? decodeCursor(pageToken, filter) : null;
  const start = cursor ? indexAfterCursor(filtered, cursor) : 0;
  const page = filtered.slice(start, start + pageSize);
  const hasMore = start + page.length < filtered.length;
  const last = page.at(-1);
  const nextPageToken = hasMore && last ? encodeCursor(last, filter) : '';

  return {
    tasks: page.map((task) => taskView(task, {
      includeArtifacts,
      historyLength,
      defaultHistoryLength: 0,
    })),
    nextPageToken,
    pageSize,
    totalSize: filtered.length,
  };
}

function compareTasksByUpdate(left: StoredTask, right: StoredTask): number {
  const timestampOrder = Date.parse(right.status.timestamp) - Date.parse(left.status.timestamp);
  if (timestampOrder !== 0) return timestampOrder;
  return right.id.localeCompare(left.id);
}

function indexAfterCursor(sorted: StoredTask[], cursor: ListCursor): number {
  const exact = sorted.findIndex((task) => task.id === cursor.id && task.status.timestamp === cursor.timestamp);
  if (exact >= 0) return exact + 1;
  const cursorTime = Date.parse(cursor.timestamp);
  const next = sorted.findIndex((task) => {
    const taskTime = Date.parse(task.status.timestamp);
    return taskTime < cursorTime || (taskTime === cursorTime && task.id.localeCompare(cursor.id) < 0);
  });
  return next >= 0 ? next : sorted.length;
}

function encodeCursor(task: StoredTask, filter: string): string {
  const cursor: ListCursor = { version: 1, timestamp: task.status.timestamp, id: task.id, filter };
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string, filter: string): ListCursor {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ListCursor>;
    if (decoded.version !== 1 || typeof decoded.timestamp !== 'string' || typeof decoded.id !== 'string' || decoded.filter !== filter) {
      throw new Error('cursor fields do not match');
    }
    if (!Number.isFinite(Date.parse(decoded.timestamp))) throw new Error('cursor timestamp is invalid');
    return decoded as ListCursor;
  } catch {
    throw new A2ARequestError(-32602, 'pageToken is invalid or does not match the active filters');
  }
}

function taskView(
  task: StoredTask,
  options: { includeArtifacts: boolean; historyLength: number | undefined; defaultHistoryLength: number | undefined },
): Record<string, unknown> {
  const view: Record<string, unknown> = {
    id: task.id,
    contextId: task.contextId,
    status: {
      ...task.status,
      ...(task.status.message ? { message: cloneMessage(task.status.message) } : {}),
    },
    metadata: { ...task.metadata },
  };
  if (options.includeArtifacts) {
    view.artifacts = task.artifacts.map((artifact) => ({
      ...artifact,
      parts: artifact.parts.map(clonePart),
      ...(artifact.metadata ? { metadata: { ...artifact.metadata } } : {}),
      ...(artifact.extensions ? { extensions: [...artifact.extensions] } : {}),
    }));
  }
  const effectiveHistoryLength = options.historyLength ?? options.defaultHistoryLength;
  if (effectiveHistoryLength !== 0) {
    const history = effectiveHistoryLength === undefined ? task.history : task.history.slice(-effectiveHistoryLength);
    if (history.length > 0) view.history = history.map(cloneMessage);
  }
  return view;
}

function cloneMessage(message: A2AMessage): A2AMessage {
  return {
    messageId: message.messageId,
    role: message.role,
    parts: message.parts.map(clonePart),
    ...(message.contextId ? { contextId: message.contextId } : {}),
    ...(message.taskId ? { taskId: message.taskId } : {}),
    ...(message.referenceTaskIds ? { referenceTaskIds: [...message.referenceTaskIds] } : {}),
    ...(message.extensions ? { extensions: [...message.extensions] } : {}),
    ...(message.metadata ? { metadata: { ...message.metadata } } : {}),
  };
}

function clonePart(part: A2APart): A2APart {
  return {
    ...(part.text !== undefined ? { text: part.text } : {}),
    ...(part.raw !== undefined ? { raw: part.raw } : {}),
    ...(part.url !== undefined ? { url: part.url } : {}),
    ...(Object.prototype.hasOwnProperty.call(part, 'data') ? { data: part.data } : {}),
    ...(part.metadata ? { metadata: { ...part.metadata } } : {}),
    ...(part.filename ? { filename: part.filename } : {}),
    ...(part.mediaType ? { mediaType: part.mediaType } : {}),
  };
}

function normalizeUserMessage(message: A2AMessage, contextId: string, taskId: string): A2AMessage {
  return {
    ...cloneMessage(message),
    role: 'ROLE_USER',
    contextId,
    taskId,
  };
}

function parseSendConfiguration(value: unknown): SendConfiguration {
  if (value === undefined) return { returnImmediately: false, historyLength: undefined };
  if (!isRecord(value)) throw new A2ARequestError(-32602, 'configuration must be an object');
  if (value.taskPushNotificationConfig !== undefined) {
    throw new A2ARequestError(-32003, 'Push notifications are not supported');
  }
  if (value.acceptedOutputModes !== undefined) {
    if (!Array.isArray(value.acceptedOutputModes) || !value.acceptedOutputModes.every((mode) => typeof mode === 'string')) {
      throw new A2ARequestError(-32602, 'configuration.acceptedOutputModes must be an array of media types');
    }
    const supported = new Set(['application/json', 'text/markdown', 'text/plain']);
    if (value.acceptedOutputModes.length > 0 && !value.acceptedOutputModes.some((mode) => supported.has(mode as string))) {
      throw new A2ARequestError(-32005, 'None of the accepted output modes is supported');
    }
  }
  return {
    returnImmediately: optionalBoolean(value.returnImmediately, 'configuration.returnImmediately') ?? false,
    historyLength: optionalInteger(value.historyLength, 'configuration.historyLength', 0, 100_000),
  };
}

function parseCommand(message: A2AMessage, params: Record<string, unknown>): { action: T2CAction; input: Record<string, unknown> } {
  const dataPart = message.parts.find((part) => isRecord(part.data));
  if (dataPart && isRecord(dataPart.data)) {
    const data = dataPart.data;
    const action = normalizeAction(data.action ?? data.skill ?? message.metadata?.action ?? params.skillId);
    const nested = isRecord(data.input) ? data.input : data;
    return { action, input: { ...nested } };
  }

  const text = message.parts.map((part) => part.text ?? '').join('\n').trim();
  if (text.startsWith('{')) {
    const data = JSON.parse(text) as Record<string, unknown>;
    const action = normalizeAction(data.action ?? data.skill);
    const nested = isRecord(data.input) ? data.input : data;
    return { action, input: { ...nested } };
  }
  const first = text.split(/\s+/, 1)[0]?.toLowerCase();
  if (first && ACTIONS.includes(first as T2CAction)) {
    return { action: first as T2CAction, input: parseKeyValues(text.slice(first.length)) };
  }
  return { action: 'extract_nl', input: { text, file: 'a2a-message.md' } };
}

function parseKeyValues(text: string): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const match of text.matchAll(/([A-Za-z][\w.-]*)=("[^"]*"|'[^']*'|\S+)/g)) {
    const key = match[1];
    let value: unknown = match[2];
    if (!key || typeof value !== 'string') continue;
    const stringValue = value.replace(/^['"]|['"]$/g, '');
    value = stringValue;
    if (stringValue === 'true' || stringValue === 'false') value = stringValue === 'true';
    else if (/^\d+$/.test(stringValue)) value = Number(stringValue);
    output[key] = value;
  }
  return output;
}

function parseMessage(value: unknown): A2AMessage {
  if (!isRecord(value)) throw new A2ARequestError(-32602, 'params.message is required');
  const messageId = stringParam(value.messageId, 'message.messageId');
  if (value.role !== 'ROLE_USER') throw new A2ARequestError(-32602, 'message.role must be ROLE_USER for client requests');
  if (!Array.isArray(value.parts) || value.parts.length === 0) throw new A2ARequestError(-32602, 'message.parts must not be empty');
  const contextId = optionalString(value.contextId, 'message.contextId');
  const taskId = optionalString(value.taskId, 'message.taskId');
  const referenceTaskIds = optionalStringArray(value.referenceTaskIds, 'message.referenceTaskIds');
  const extensions = optionalStringArray(value.extensions, 'message.extensions');
  const metadata = value.metadata === undefined ? undefined : recordParam(value.metadata, 'message.metadata');
  return {
    messageId,
    role: 'ROLE_USER',
    parts: value.parts.map((part, index) => parsePart(part, index)),
    ...(contextId ? { contextId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(referenceTaskIds ? { referenceTaskIds } : {}),
    ...(extensions ? { extensions } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function parsePart(value: unknown, index: number): A2APart {
  if (!isRecord(value)) throw new A2ARequestError(-32602, `message.parts[${index}] must be an object`);
  const contentKeys = ['text', 'raw', 'url', 'data'].filter((key) => Object.prototype.hasOwnProperty.call(value, key));
  if (contentKeys.length !== 1) {
    throw new A2ARequestError(-32602, `message.parts[${index}] must contain exactly one of text, raw, url or data`);
  }
  const output: A2APart = {};
  if (contentKeys[0] === 'text') {
    if (typeof value.text !== 'string') throw new A2ARequestError(-32602, `message.parts[${index}].text must be a string`);
    output.text = value.text;
  } else if (contentKeys[0] === 'raw') {
    if (typeof value.raw !== 'string') throw new A2ARequestError(-32602, `message.parts[${index}].raw must be a base64 string`);
    output.raw = value.raw;
  } else if (contentKeys[0] === 'url') {
    if (typeof value.url !== 'string' || !value.url) throw new A2ARequestError(-32602, `message.parts[${index}].url must be a string`);
    output.url = value.url;
  } else {
    output.data = value.data;
  }
  if (value.metadata !== undefined) output.metadata = recordParam(value.metadata, `message.parts[${index}].metadata`);
  if (value.filename !== undefined) output.filename = stringParam(value.filename, `message.parts[${index}].filename`);
  if (value.mediaType !== undefined) output.mediaType = stringParam(value.mediaType, `message.parts[${index}].mediaType`);
  return output;
}

function ensureSupportedMessageContent(message: A2AMessage): void {
  const hasText = message.parts.some((part) => typeof part.text === 'string');
  const hasObjectData = message.parts.some((part) => isRecord(part.data));
  if (!hasText && !hasObjectData) {
    throw new A2ARequestError(-32005, 'todo2code accepts text parts or object-valued data parts');
  }
}

function normalizeAction(value: unknown): T2CAction {
  if (typeof value !== 'string') return 'pipeline';
  const normalized = value.toLowerCase().replace(/[- ]/g, '_');
  const aliases: Record<string, T2CAction> = {
    analyze_repository: 'pipeline',
    extract_intent: 'extract_nl',
    summarize_team_state: 'summarize',
    diagnose_alignment: 'diagnose',
  };
  const action = aliases[normalized] ?? normalized;
  if (!ACTIONS.includes(action as T2CAction)) throw new A2ARequestError(-32602, `Unknown todo2code action: ${value}`);
  return action as T2CAction;
}

function sendAgentCard(request: IncomingMessage, response: ServerResponse, config: T2CConfig): void {
  const card = agentCard(config);
  const serialized = JSON.stringify(card);
  const etag = `"${createHash('sha256').update(serialized).digest('base64url')}"`;
  if (request.headers['if-none-match'] === etag) {
    response.writeHead(304, { ETag: etag, 'Cache-Control': 'public, max-age=300' });
    response.end();
    return;
  }
  sendJson(response, 200, card, { ETag: etag, 'Cache-Control': 'public, max-age=300' });
}

function agentCard(config: T2CConfig): Record<string, unknown> {
  const card: Record<string, unknown> = {
    name: 'todo2code',
    description: 'Intent extraction, evidence graph, diagnostics and grounded team summaries for software repositories.',
    version: '0.2.0',
    supportedInterfaces: [{ url: config.a2a.publicUrl, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }],
    capabilities: { streaming: false, pushNotifications: false, extensions: [] },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['application/json', 'text/markdown', 'text/plain'],
    skills: [
      {
        id: 'analyze_repository',
        name: 'Analyze repository',
        description: 'Run the full t2c pipeline over NL, Git, AST, TODO, CHANGELOG and optional documentation.',
        tags: ['intent', 'git', 'ast', 'todo', 'documentation'],
        examples: ['{"action":"pipeline","input":{"root":".","task":"TASK.md"}}'],
        inputModes: ['application/json'],
        outputModes: ['application/json', 'text/markdown'],
      },
      {
        id: 'extract_intent',
        name: 'Extract intent',
        description: 'Run one deterministic or OpenRouter-backed extractor.',
        tags: ['intent-dsl', 'extraction'],
        examples: ['{"action":"extract_git","input":{"count":10}}'],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['application/json'],
      },
      {
        id: 'diagnose_alignment',
        name: 'Diagnose alignment',
        description: 'Detect planned-but-not-implemented, undocumented and conflicting intent.',
        tags: ['diagnostics', 'alignment'],
        examples: ['{"action":"diagnose","input":{"graph":{...}}}'],
        inputModes: ['application/json'],
        outputModes: ['application/json'],
      },
      {
        id: 'summarize_team_state',
        name: 'Summarize team state',
        description: 'Use OpenRouter to generate a grounded Polish report from the canonical graph.',
        tags: ['openrouter', 'summary', 'team'],
        examples: ['{"action":"summarize","input":{"graph":{...},"diagnostics":{...}}}'],
        inputModes: ['application/json'],
        outputModes: ['text/markdown'],
      },
      {
        id: 'compare_intent_graphs',
        name: 'Compare intent graphs',
        description: 'Compute deterministic t2c.diff/v1 data and an SVG visualization for two Intent graphs.',
        tags: ['diff', 'intent-dsl', 'svg'],
        examples: ['{"action":"diff","input":{"beforeGraph":{},"afterGraph":{}}}'],
        inputModes: ['application/json'],
        outputModes: ['application/json', 'image/svg+xml'],
      },
      {
        id: 'render_file_diff',
        name: 'Render file diff',
        description: 'Diff two files or the Git work tree with the deterministic Myers engine and render SVG or HTML.',
        tags: ['diff', 'git', 'svg'],
        examples: [
          '{"action":"diff_files","input":{"before":"a.ts","after":"b.ts"}}',
          '{"action":"diff_git","input":{"revision":"HEAD"}}',
        ],
        inputModes: ['application/json'],
        outputModes: ['application/json', 'image/svg+xml', 'text/html'],
      },
      {
        id: 'compare_intent_reality',
        name: 'Compare intent and reality',
        description: 'Group graph records into topics and report where plan, code and documentation diverge.',
        tags: ['diff', 'alignment', 'svg'],
        examples: ['{"action":"reality","input":{"graph":{}}}'],
        inputModes: ['application/json'],
        outputModes: ['application/json', 'image/svg+xml', 'text/markdown'],
      },
    ],
  };
  if (config.a2a.token) {
    card.securitySchemes = {
      bearerAuth: {
        httpAuthSecurityScheme: {
          description: 'Static bearer token configured with T2C_A2A_TOKEN.',
          scheme: 'Bearer',
          bearerFormat: 'opaque',
        },
      },
    };
    card.securityRequirements = [{ schemes: { bearerAuth: { list: [] } } }];
  }
  return card;
}

function a2aVersion(headers: IncomingHttpHeaders, url: URL): string {
  const raw = headers['a2a-version'];
  const headerVersion = Array.isArray(raw) ? raw[0] : raw;
  const requested = headerVersion ?? url.searchParams.get('A2A-Version') ?? '0.3';
  return requested.trim() || '0.3';
}

function authorized(request: IncomingMessage, config: T2CConfig): boolean {
  if (!config.a2a.token) return true;
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return false;
  const received = Buffer.from(header.slice(7));
  const expected = Buffer.from(config.a2a.token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function principalForRequest(request: IncomingMessage, config: T2CConfig): string {
  if (!config.a2a.token) return 'public';
  return `bearer:${createHash('sha256').update(request.headers.authorization ?? '').digest('hex')}`;
}

function ownedTask(id: string, principal: string): StoredTask {
  const task = tasks.get(id);
  if (!task || task.owner !== principal) throw new A2ARequestError(-32001, `Task not found: ${id}`, { taskId: id });
  return task;
}

async function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunkValue of request) {
    const chunk = Buffer.isBuffer(chunkValue) ? chunkValue : Buffer.from(chunkValue);
    length += chunk.length;
    if (length > maxBytes) throw new BodyTooLargeError(`Request body exceeds ${maxBytes} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(payload);
}

function sendText(
  response: ServerResponse,
  status: number,
  body: string,
  contentType: string,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(body);
}

const A2A_ERROR_REASONS: Readonly<Record<number, string>> = {
  [-32001]: 'TASK_NOT_FOUND',
  [-32002]: 'TASK_NOT_CANCELABLE',
  [-32003]: 'PUSH_NOTIFICATION_NOT_SUPPORTED',
  [-32004]: 'UNSUPPORTED_OPERATION',
  [-32005]: 'CONTENT_TYPE_NOT_SUPPORTED',
  [-32006]: 'INVALID_AGENT_RESPONSE',
  [-32007]: 'EXTENDED_AGENT_CARD_NOT_CONFIGURED',
  [-32008]: 'EXTENSION_SUPPORT_REQUIRED',
  [-32009]: 'VERSION_NOT_SUPPORTED',
};

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  metadata?: Record<string, unknown>,
): Record<string, unknown> {
  const reason = A2A_ERROR_REASONS[code];
  const error: Record<string, unknown> = { code, message };
  if (reason) {
    const stringMetadata = Object.fromEntries(
      Object.entries({ ...(metadata ?? {}), timestamp: new Date().toISOString() })
        .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]),
    );
    error.data = [{
      '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
      reason,
      domain: 'a2a-protocol.org',
      metadata: stringMetadata,
    }];
  }
  return { jsonrpc: '2.0', id, error };
}

function stringParam(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new A2ARequestError(-32602, `${name} is required`);
  return value;
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return stringParam(value, name);
}

function optionalStringArray(value: unknown, name: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string' && entry.length > 0)) {
    throw new A2ARequestError(-32602, `${name} must be an array of non-empty strings`);
  }
  return [...value];
}

function optionalInteger(value: unknown, name: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new A2ARequestError(-32602, `${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new A2ARequestError(-32602, `${name} must be a boolean`);
  return value;
}

function optionalTimestamp(value: unknown, name: string): string | undefined {
  const timestamp = optionalString(value, name);
  if (!timestamp) return undefined;
  if (!Number.isFinite(Date.parse(timestamp))) throw new A2ARequestError(-32602, `${name} must be an ISO 8601 timestamp`);
  return timestamp;
}

function optionalTaskState(value: unknown): A2ATaskState | undefined {
  if (value === undefined || value === null || value === '' || value === 'TASK_STATE_UNSPECIFIED' || value === 0) return undefined;
  if (typeof value !== 'string' || !TASK_STATES.has(value as A2ATaskState)) {
    throw new A2ARequestError(-32602, `status must be one of: ${[...TASK_STATES].join(', ')}`);
  }
  return value as A2ATaskState;
}

function recordParam(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new A2ARequestError(-32602, `${name} must be an object`);
  return { ...value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

class A2ARequestError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
  }
}

class BodyTooLargeError extends Error {}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  startA2aServer().catch((error) => {
    process.stderr.write(`[t2c:a2a] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
