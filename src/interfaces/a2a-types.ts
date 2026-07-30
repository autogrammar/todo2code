import type { T2CAction } from '../services/actions.js';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export type A2ATaskState =
  | 'TASK_STATE_SUBMITTED'
  | 'TASK_STATE_WORKING'
  | 'TASK_STATE_COMPLETED'
  | 'TASK_STATE_FAILED'
  | 'TASK_STATE_CANCELED'
  | 'TASK_STATE_INPUT_REQUIRED'
  | 'TASK_STATE_REJECTED'
  | 'TASK_STATE_AUTH_REQUIRED';

export interface A2APart {
  text?: string;
  raw?: string;
  url?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
  filename?: string;
  mediaType?: string;
}

export interface A2AMessage {
  messageId: string;
  role: 'ROLE_USER' | 'ROLE_AGENT';
  parts: A2APart[];
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: string[];
  extensions?: string[];
  metadata?: Record<string, unknown>;
}

export interface A2AArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
  extensions?: string[];
}

export interface A2ATask {
  id: string;
  contextId: string;
  status: { state: A2ATaskState; message?: A2AMessage; timestamp: string };
  artifacts: A2AArtifact[];
  history: A2AMessage[];
  metadata: Record<string, unknown>;
}

export interface StoredTask extends A2ATask {
  owner: string;
}

export interface SendConfiguration {
  returnImmediately: boolean;
  historyLength: number | undefined;
}

export const A2A_ACTIONS: T2CAction[] = [
  'extract_nl', 'extract_git', 'extract_ast', 'extract_config', 'extract_markdown', 'extract_docs',
  'extract_communication', 'analyze_communication', 'link', 'diagnose', 'summarize',
  'diff', 'diff_files', 'diff_git', 'reality', 'compare_workspace', 'pipeline',
  'propose_todo', 'render_todo', 'apply_todo',
  'propose_code_change', 'render_code_change', 'propose_source_patch', 'evaluate_code_change',
];

export const TERMINAL_TASK_STATES = new Set<A2ATaskState>([
  'TASK_STATE_COMPLETED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED', 'TASK_STATE_REJECTED',
]);

export const TASK_STATES = new Set<A2ATaskState>([
  'TASK_STATE_SUBMITTED', 'TASK_STATE_WORKING', 'TASK_STATE_COMPLETED', 'TASK_STATE_FAILED',
  'TASK_STATE_CANCELED', 'TASK_STATE_INPUT_REQUIRED', 'TASK_STATE_REJECTED', 'TASK_STATE_AUTH_REQUIRED',
]);

export class A2ARequestError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class BodyTooLargeError extends Error {}

export function stringParam(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new A2ARequestError(-32602, `${name} is required`);
  return value;
}

export function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return stringParam(value, name);
}

export function optionalStringArray(value: unknown, name: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string' && entry.length > 0)) {
    throw new A2ARequestError(-32602, `${name} must be an array of non-empty strings`);
  }
  return [...value];
}

export function optionalInteger(
  value: unknown,
  name: string,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new A2ARequestError(-32602, `${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function optionalBoolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new A2ARequestError(-32602, `${name} must be a boolean`);
  return value;
}

export function optionalTimestamp(value: unknown, name: string): string | undefined {
  const timestamp = optionalString(value, name);
  if (!timestamp) return undefined;
  if (!Number.isFinite(Date.parse(timestamp))) throw new A2ARequestError(-32602, `${name} must be an ISO 8601 timestamp`);
  return timestamp;
}

export function optionalTaskState(value: unknown): A2ATaskState | undefined {
  if (value === undefined || value === null || value === '' || value === 'TASK_STATE_UNSPECIFIED' || value === 0) {
    return undefined;
  }
  if (typeof value !== 'string' || !TASK_STATES.has(value as A2ATaskState)) {
    throw new A2ARequestError(-32602, `status must be one of: ${[...TASK_STATES].join(', ')}`);
  }
  return value as A2ATaskState;
}

export function recordParam(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new A2ARequestError(-32602, `${name} must be an object`);
  return { ...value };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
