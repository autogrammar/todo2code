import type { T2CAction } from '../services/actions.js';
import {
  A2A_ACTIONS,
  A2ARequestError,
  isRecord,
  optionalBoolean,
  optionalInteger,
  optionalString,
  optionalStringArray,
  recordParam,
  stringParam,
  type A2AMessage,
  type A2APart,
  type SendConfiguration,
} from './a2a-types.js';

export function parseSendConfiguration(value: unknown): SendConfiguration {
  if (value === undefined) return { returnImmediately: false, historyLength: undefined };
  if (!isRecord(value)) throw new A2ARequestError(-32602, 'configuration must be an object');
  if (value.taskPushNotificationConfig !== undefined) {
    throw new A2ARequestError(-32003, 'Push notifications are not supported');
  }
  validateOutputModes(value.acceptedOutputModes);
  return {
    returnImmediately: optionalBoolean(value.returnImmediately, 'configuration.returnImmediately') ?? false,
    historyLength: optionalInteger(value.historyLength, 'configuration.historyLength', 0, 100_000),
  };
}

function validateOutputModes(value: unknown): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || !value.every((mode) => typeof mode === 'string')) {
    throw new A2ARequestError(-32602, 'configuration.acceptedOutputModes must be an array of media types');
  }
  const supported = new Set(['application/json', 'text/markdown', 'text/plain']);
  if (value.length > 0 && !value.some((mode) => supported.has(mode as string))) {
    throw new A2ARequestError(-32005, 'None of the accepted output modes is supported');
  }
}

export function parseCommand(
  message: A2AMessage,
  params: Record<string, unknown>,
): { action: T2CAction; input: Record<string, unknown> } {
  const objectData = message.parts.find((part) => isRecord(part.data))?.data;
  if (isRecord(objectData)) return commandFromData(objectData, message, params);

  const text = message.parts.map((part) => part.text ?? '').join('\n').trim();
  if (text.startsWith('{')) return commandFromData(JSON.parse(text) as Record<string, unknown>, message, params);
  const first = text.split(/\s+/, 1)[0]?.toLowerCase();
  if (first && A2A_ACTIONS.includes(first as T2CAction)) {
    return { action: first as T2CAction, input: parseKeyValues(text.slice(first.length)) };
  }
  return { action: 'extract_nl', input: { text, file: 'a2a-message.md' } };
}

function commandFromData(
  data: Record<string, unknown>,
  message: A2AMessage,
  params: Record<string, unknown>,
): { action: T2CAction; input: Record<string, unknown> } {
  const action = normalizeAction(data.action ?? data.skill ?? message.metadata?.action ?? params.skillId);
  const nested = isRecord(data.input) ? data.input : data;
  return { action, input: { ...nested } };
}

function parseKeyValues(text: string): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const match of text.matchAll(/([A-Za-z][\w.-]*)=("[^"]*"|'[^']*'|\S+)/g)) {
    const key = match[1];
    const raw = match[2];
    if (!key || raw === undefined) continue;
    const stringValue = raw.replace(/^['"]|['"]$/g, '');
    output[key] = parseScalar(stringValue);
  }
  return output;
}

function parseScalar(value: string): string | boolean | number {
  if (value === 'true' || value === 'false') return value === 'true';
  return /^\d+$/.test(value) ? Number(value) : value;
}

export function parseMessage(value: unknown): A2AMessage {
  if (!isRecord(value)) throw new A2ARequestError(-32602, 'params.message is required');
  const messageId = stringParam(value.messageId, 'message.messageId');
  if (value.role !== 'ROLE_USER') throw new A2ARequestError(-32602, 'message.role must be ROLE_USER for client requests');
  if (!Array.isArray(value.parts) || value.parts.length === 0) {
    throw new A2ARequestError(-32602, 'message.parts must not be empty');
  }
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
  const contentKeys = ['text', 'raw', 'url', 'data']
    .filter((key) => Object.prototype.hasOwnProperty.call(value, key));
  if (contentKeys.length !== 1) {
    throw new A2ARequestError(-32602, `message.parts[${index}] must contain exactly one of text, raw, url or data`);
  }
  const output = parsePartContent(value, index, contentKeys[0] as 'text' | 'raw' | 'url' | 'data');
  if (value.metadata !== undefined) output.metadata = recordParam(value.metadata, `message.parts[${index}].metadata`);
  if (value.filename !== undefined) output.filename = stringParam(value.filename, `message.parts[${index}].filename`);
  if (value.mediaType !== undefined) output.mediaType = stringParam(value.mediaType, `message.parts[${index}].mediaType`);
  return output;
}

function parsePartContent(
  value: Record<string, unknown>,
  index: number,
  key: 'text' | 'raw' | 'url' | 'data',
): A2APart {
  if (key === 'data') return { data: value.data };
  const content = value[key];
  if (typeof content !== 'string' || (key === 'url' && !content)) {
    const qualifier = key === 'raw' ? 'a base64 string' : 'a string';
    throw new A2ARequestError(-32602, `message.parts[${index}].${key} must be ${qualifier}`);
  }
  return { [key]: content };
}

export function ensureSupportedMessageContent(message: A2AMessage): void {
  const supported = message.parts.some((part) => typeof part.text === 'string' || isRecord(part.data));
  if (!supported) throw new A2ARequestError(-32005, 'todo2code accepts text parts or object-valued data parts');
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
  if (!A2A_ACTIONS.includes(action as T2CAction)) {
    throw new A2ARequestError(-32602, `Unknown todo2code action: ${value}`);
  }
  return action as T2CAction;
}

export function cloneMessage(message: A2AMessage): A2AMessage {
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

export function clonePart(part: A2APart): A2APart {
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

export function normalizeUserMessage(message: A2AMessage, contextId: string, taskId: string): A2AMessage {
  return { ...cloneMessage(message), role: 'ROLE_USER', contextId, taskId };
}
