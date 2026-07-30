import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { T2CConfig } from '../config/env.js';
import { assertPathWithinRoot } from '../core/security.js';
import { executeAction } from '../services/actions.js';
import {
  cloneMessage,
  clonePart,
  ensureSupportedMessageContent,
  normalizeUserMessage,
  parseCommand,
  parseMessage,
  parseSendConfiguration,
} from './a2a-message.js';
import {
  A2ARequestError,
  isRecord,
  optionalBoolean,
  optionalInteger,
  optionalString,
  optionalTaskState,
  optionalTimestamp,
  stringParam,
  TASK_STATES,
  TERMINAL_TASK_STATES,
  type A2AMessage,
  type A2ATaskState,
  type JsonRpcRequest,
  type StoredTask,
} from './a2a-types.js';

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

interface TaskStoreSnapshot {
  schemaVersion: 't2c.a2a-task-store/v1';
  updatedAt: string;
  tasks: StoredTask[];
}

const tasks = new Map<string, StoredTask>();
const messageTaskIndex = new Map<string, string>();

export function clearA2aTaskStoreForTests(): void {
  tasks.clear();
  messageTaskIndex.clear();
}

export async function handleA2aRpc(
  request: JsonRpcRequest,
  config: T2CConfig,
  principal: string,
): Promise<unknown> {
  return withTaskStore(config, () => handleRpcInTaskStore(request, config, principal));
}

async function handleRpcInTaskStore(
  request: JsonRpcRequest,
  config: T2CConfig,
  principal: string,
): Promise<unknown> {
  const params = request.params ?? {};
  switch (request.method) {
    case 'SendMessage': return sendMessage(params, config, principal);
    case 'GetTask': return getTask(params, principal);
    case 'ListTasks': return listTasks(params, principal);
    case 'CancelTask': return cancelTask(params, principal);
    default: throw new A2ARequestError(-32601, `Method not found: ${request.method}`);
  }
}

async function sendMessage(
  params: Record<string, unknown>,
  config: T2CConfig,
  principal: string,
): Promise<Record<string, unknown>> {
  const message = parseMessage(params.message);
  ensureSupportedMessageContent(message);
  const sendConfiguration = parseSendConfiguration(params.configuration);
  const prepared = prepareTask(message, principal);
  if (prepared.shouldExecute) {
    if (sendConfiguration.returnImmediately) scheduleTaskExecution(prepared.task.id, message, params, config);
    else await executeMessage(prepared.task, message, params, config);
  }
  return {
    task: taskView(prepared.task, {
      includeArtifacts: true,
      historyLength: sendConfiguration.historyLength,
      defaultHistoryLength: undefined,
    }),
  };
}

function getTask(params: Record<string, unknown>, principal: string): Record<string, unknown> {
  const task = ownedTask(stringParam(params.id, 'id'), principal);
  const historyLength = optionalInteger(params.historyLength, 'historyLength', 0, 100_000);
  return taskView(task, { includeArtifacts: true, historyLength, defaultHistoryLength: undefined });
}

function cancelTask(params: Record<string, unknown>, principal: string): Record<string, unknown> {
  const task = ownedTask(stringParam(params.id, 'id'), principal);
  if (task.status.state === 'TASK_STATE_CANCELED') return fullTaskView(task);
  if (TERMINAL_TASK_STATES.has(task.status.state)) {
    throw new A2ARequestError(
      -32002,
      `Task is not cancelable in state ${task.status.state}`,
      { taskId: task.id, state: task.status.state },
    );
  }
  task.status = { state: 'TASK_STATE_CANCELED', timestamp: new Date().toISOString() };
  task.metadata.active = false;
  return fullTaskView(task);
}

function fullTaskView(task: StoredTask): Record<string, unknown> {
  return taskView(task, { includeArtifacts: true, historyLength: undefined, defaultHistoryLength: undefined });
}

function scheduleTaskExecution(
  taskId: string,
  message: A2AMessage,
  params: Record<string, unknown>,
  config: T2CConfig,
): void {
  setImmediate(() => {
    void withTaskStore(config, async () => {
      const task = tasks.get(taskId);
      if (task) await executeMessage(task, message, params, config);
    }).catch((error) => {
      process.stderr.write(`[t2c:a2a] background task persistence failed: ${errorMessage(error)}\n`);
    });
  });
}

async function withTaskStore<T>(config: T2CConfig, operation: () => Promise<T>): Promise<T> {
  const storePath = await configuredTaskStorePath(config);
  if (!storePath) return operation();
  await fs.mkdir(path.dirname(storePath), { recursive: true, mode: 0o700 });
  const release = await acquireTaskStoreLock(storePath);
  try {
    await loadTaskStore(storePath);
    const result = await operation();
    await saveTaskStore(storePath);
    return result;
  } finally {
    await release();
  }
}

async function configuredTaskStorePath(config: T2CConfig): Promise<string | null> {
  if (!config.a2a.taskStorePath) return null;
  return assertPathWithinRoot(
    config.root,
    path.resolve(config.root, config.a2a.taskStorePath),
    config.allowOutsideRoot,
  );
}

async function acquireTaskStoreLock(storePath: string): Promise<() => Promise<void>> {
  const lockPath = `${storePath}.lock`;
  const deadline = Date.now() + 5 * 60_000;
  for (;;) {
    try {
      await fs.mkdir(lockPath, { mode: 0o700 });
      return () => removeLock(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (await removeStaleLock(lockPath)) continue;
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for A2A task store lock: ${lockPath}`);
      await delay(25);
    }
  }
}

async function removeLock(lockPath: string): Promise<void> {
  try {
    await fs.rmdir(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function removeStaleLock(lockPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(lockPath);
    if (Date.now() - stat.mtimeMs <= 30 * 60_000) return false;
    await fs.rmdir(lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
}

async function loadTaskStore(storePath: string): Promise<void> {
  const content = await readTaskStore(storePath);
  if (content === null) {
    clearA2aTaskStoreForTests();
    return;
  }
  const snapshot = JSON.parse(content) as Partial<TaskStoreSnapshot>;
  if (snapshot.schemaVersion !== 't2c.a2a-task-store/v1' || !Array.isArray(snapshot.tasks)) {
    throw new Error(`Invalid A2A task store snapshot: ${storePath}`);
  }
  const restored = snapshot.tasks.map((task, index) => assertStoredTask(task, `${storePath} tasks[${index}]`));
  clearA2aTaskStoreForTests();
  for (const task of restored) restoreTask(task);
}

async function readTaskStore(storePath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(storePath);
    if (!stat.isFile()) throw new Error(`A2A task store is not a file: ${storePath}`);
    if (stat.size > 256 * 1024 * 1024) throw new Error(`A2A task store exceeds 256 MiB: ${storePath}`);
    return fs.readFile(storePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function restoreTask(task: StoredTask): void {
  tasks.set(task.id, task);
  for (const message of task.history) {
    if (message.role === 'ROLE_USER') messageTaskIndex.set(messageKey(task.owner, message.messageId), task.id);
  }
}

function assertStoredTask(value: unknown, label: string): StoredTask {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.contextId !== 'string'
    || typeof value.owner !== 'string'
    || !isRecord(value.status)
    || typeof value.status.timestamp !== 'string'
    || !TASK_STATES.has(value.status.state as A2ATaskState)
    || !Array.isArray(value.artifacts)
    || !Array.isArray(value.history)
    || !isRecord(value.metadata)) {
    throw new Error(`Invalid stored A2A task at ${label}`);
  }
  return value as unknown as StoredTask;
}

async function saveTaskStore(storePath: string): Promise<void> {
  const snapshot: TaskStoreSnapshot = {
    schemaVersion: 't2c.a2a-task-store/v1',
    updatedAt: new Date().toISOString(),
    tasks: [...tasks.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
  const content = `${JSON.stringify(snapshot)}\n`;
  if (Buffer.byteLength(content) > 256 * 1024 * 1024) {
    throw new Error('A2A task store snapshot exceeds 256 MiB');
  }
  const temporaryPath = `${storePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fs.rename(temporaryPath, storePath);
  } finally {
    await removeTemporaryFile(temporaryPath);
  }
}

async function removeTemporaryFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function prepareTask(message: A2AMessage, principal: string): PreparedTask {
  const key = messageKey(principal, message.messageId);
  const indexedTask = taskForMessage(key, principal);
  if (indexedTask) return { task: indexedTask, shouldExecute: false };
  if (message.taskId) return continueTask(message, principal, key);
  return createTask(message, principal, key);
}

function taskForMessage(key: string, principal: string): StoredTask | null {
  const indexedTaskId = messageTaskIndex.get(key);
  if (!indexedTaskId) return null;
  const task = tasks.get(indexedTaskId);
  return task?.owner === principal ? task : null;
}

function continueTask(message: A2AMessage, principal: string, key: string): PreparedTask {
  const existing = ownedTask(message.taskId as string, principal);
  if (existing.history.some((entry) => entry.messageId === message.messageId)) {
    return { task: existing, shouldExecute: false };
  }
  if (message.contextId && message.contextId !== existing.contextId) {
    throw new A2ARequestError(-32602, `message.contextId does not match task context ${existing.contextId}`);
  }
  if (TERMINAL_TASK_STATES.has(existing.status.state) || existing.status.state === 'TASK_STATE_WORKING') {
    throw continuationError(existing);
  }
  existing.history.push(normalizeUserMessage(message, existing.contextId, existing.id));
  existing.status = { state: 'TASK_STATE_WORKING', timestamp: new Date().toISOString() };
  existing.metadata.active = true;
  messageTaskIndex.set(key, existing.id);
  return { task: existing, shouldExecute: true };
}

function continuationError(task: StoredTask): A2ARequestError {
  const message = task.status.state === 'TASK_STATE_WORKING'
    ? `Task is already working: ${task.id}`
    : `Cannot continue terminal task ${task.id}; start a new task in context ${task.contextId}`;
  return new A2ARequestError(-32004, message, { taskId: task.id, state: task.status.state });
}

function createTask(message: A2AMessage, principal: string, key: string): PreparedTask {
  const taskId = randomUUID();
  const contextId = message.contextId ?? randomUUID();
  const task: StoredTask = {
    id: taskId,
    contextId,
    status: { state: 'TASK_STATE_WORKING', timestamp: new Date().toISOString() },
    artifacts: [],
    history: [normalizeUserMessage(message, contextId, taskId)],
    metadata: {
      service: 'todo2code',
      protocolVersion: '1.0',
      createdAt: new Date().toISOString(),
      active: true,
    },
    owner: principal,
  };
  tasks.set(taskId, task);
  messageTaskIndex.set(key, taskId);
  return { task, shouldExecute: true };
}

async function executeMessage(
  task: StoredTask,
  message: A2AMessage,
  params: Record<string, unknown>,
  config: T2CConfig,
): Promise<void> {
  if (task.status.state !== 'TASK_STATE_WORKING') return;
  try {
    const command = parseCommand(message, params);
    task.metadata.lastAction = command.action;
    const result = await executeAction(command.action, command.input, config);
    if (currentTaskState(task) === 'TASK_STATE_CANCELED') return;
    completeTask(task, command.action, result);
  } catch (error) {
    if (currentTaskState(task) !== 'TASK_STATE_CANCELED') failTask(task, error);
  }
}

function currentTaskState(task: StoredTask): A2ATaskState {
  return task.status.state;
}

function completeTask(task: StoredTask, action: string, result: unknown): void {
  task.artifacts.push({
    artifactId: randomUUID(),
    name: `${action}-result.json`,
    description: `todo2code result for ${action}`,
    parts: [{ data: result, mediaType: 'application/json' }],
  });
  const message = agentMessage(task, `todo2code completed ${action}`);
  task.history.push(message);
  task.status = { state: 'TASK_STATE_COMPLETED', message, timestamp: new Date().toISOString() };
  task.metadata.active = false;
}

function failTask(task: StoredTask, error: unknown): void {
  const message = agentMessage(task, errorMessage(error));
  task.history.push(message);
  task.status = { state: 'TASK_STATE_FAILED', message, timestamp: new Date().toISOString() };
  task.metadata.active = false;
}

function agentMessage(task: StoredTask, text: string): A2AMessage {
  return {
    messageId: randomUUID(),
    role: 'ROLE_AGENT',
    contextId: task.contextId,
    taskId: task.id,
    parts: [{ text }],
  };
}

function listTasks(params: Record<string, unknown>, principal: string): Record<string, unknown> {
  const contextId = optionalString(params.contextId, 'contextId');
  const status = optionalTaskState(params.status);
  const pageSize = optionalInteger(params.pageSize, 'pageSize', 1, 100) ?? 50;
  const historyLength = optionalInteger(params.historyLength, 'historyLength', 0, 100_000);
  const includeArtifacts = optionalBoolean(params.includeArtifacts, 'includeArtifacts') ?? false;
  const statusTimestampAfter = optionalTimestamp(params.statusTimestampAfter, 'statusTimestampAfter');
  const filter = JSON.stringify({
    contextId: contextId ?? null,
    status: status ?? null,
    statusTimestampAfter: statusTimestampAfter ?? null,
  });
  const filtered = filteredTasks(principal, contextId, status, statusTimestampAfter);
  const pageToken = optionalString(params.pageToken, 'pageToken');
  const start = pageToken ? indexAfterCursor(filtered, decodeCursor(pageToken, filter)) : 0;
  const page = filtered.slice(start, start + pageSize);
  const last = page.at(-1);
  return {
    tasks: page.map((task) => taskView(task, { includeArtifacts, historyLength, defaultHistoryLength: 0 })),
    nextPageToken: start + page.length < filtered.length && last ? encodeCursor(last, filter) : '',
    pageSize,
    totalSize: filtered.length,
  };
}

function filteredTasks(
  principal: string,
  contextId: string | undefined,
  status: A2ATaskState | undefined,
  timestampAfter: string | undefined,
): StoredTask[] {
  return [...tasks.values()]
    .filter((task) => task.owner === principal)
    .filter((task) => !contextId || task.contextId === contextId)
    .filter((task) => !status || task.status.state === status)
    .filter((task) => !timestampAfter || Date.parse(task.status.timestamp) >= Date.parse(timestampAfter))
    .sort(compareTasksByUpdate);
}

function compareTasksByUpdate(left: StoredTask, right: StoredTask): number {
  const timestampOrder = Date.parse(right.status.timestamp) - Date.parse(left.status.timestamp);
  return timestampOrder !== 0 ? timestampOrder : right.id.localeCompare(left.id);
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
    if (decoded.version !== 1 || typeof decoded.timestamp !== 'string'
      || typeof decoded.id !== 'string' || decoded.filter !== filter
      || !Number.isFinite(Date.parse(decoded.timestamp))) {
      throw new Error('cursor fields are invalid');
    }
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
    status: { ...task.status, ...(task.status.message ? { message: cloneMessage(task.status.message) } : {}) },
    metadata: { ...task.metadata },
  };
  if (options.includeArtifacts) view.artifacts = task.artifacts.map(cloneArtifact);
  const effectiveHistoryLength = options.historyLength ?? options.defaultHistoryLength;
  if (effectiveHistoryLength !== 0) {
    const history = effectiveHistoryLength === undefined ? task.history : task.history.slice(-effectiveHistoryLength);
    if (history.length > 0) view.history = history.map(cloneMessage);
  }
  return view;
}

function cloneArtifact(artifact: StoredTask['artifacts'][number]): Record<string, unknown> {
  return {
    ...artifact,
    parts: artifact.parts.map(clonePart),
    ...(artifact.metadata ? { metadata: { ...artifact.metadata } } : {}),
    ...(artifact.extensions ? { extensions: [...artifact.extensions] } : {}),
  };
}

function ownedTask(id: string, principal: string): StoredTask {
  const task = tasks.get(id);
  if (!task || task.owner !== principal) {
    throw new A2ARequestError(-32001, `Task not found: ${id}`, { taskId: id });
  }
  return task;
}

function messageKey(principal: string, messageId: string): string {
  return `${principal}\u0000${messageId}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
