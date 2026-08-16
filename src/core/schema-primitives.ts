import type { IntentRecord, JsonValue, TodoProposal } from './types.js';

export const ACTIONS = new Set([
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
]);
export const MODALITIES = new Set(['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown']);
export const POLARITIES = new Set(['positive', 'negative']);
export const LIFECYCLES = new Set([
  'proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown',
]);
export const SOURCE_KINDS = new Set(['nl', 'git', 'ast', 'todo', 'changelog', 'document', 'agent_log', 'test', 'system']);
export const EPISTEMIC_CLASSES = new Set(['declaration', 'plan', 'claim', 'fact', 'inference', 'llm_inference']);
export const RELATION_TYPES = new Set([
  'declares', 'plans', 'implements', 'modifies', 'tests', 'documents', 'releases', 'depends_on',
  'blocks', 'supersedes', 'contradicts', 'duplicates', 'evidenced_by', 'claimed_by', 'same_as', 'related_to',
]);
export const CONCLUSION_KINDS = new Set(['finding', 'risk', 'decision', 'recommendation']);
export const DIAGNOSTIC_SEVERITIES = new Set(['info', 'warning', 'review_required', 'blocking']);
export const TODO_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
export const GENERATION_REQUESTED_MODES = new Set(['deterministic', 'prefer-llm', 'require-llm']);
export const GENERATION_EFFECTIVE_MODES = new Set(['deterministic', 'llm']);
export const RECORD_ID = /^INT-[A-Z]+-[a-f0-9]{20}$/;
export const RELATION_ID = /^REL-[a-f0-9]{20}$/;
export const DIAGNOSTIC_ID = /^DIAG-[a-f0-9]{20}$/;
export const CONCLUSION_ID = /^CONC-[a-f0-9]{20}$/;
export const TODO_PROPOSAL_ID = /^TPROP-[a-f0-9]{20}$/;
export const CODE_CHANGE_PLAN_ID = /^CPLAN-[a-f0-9]{20}$/;
export const CODE_CHANGE_ACTIONS = new Set(['create', 'modify', 'delete']);
export const CODE_CHANGE_RISK_LEVELS = new Set(['low', 'medium', 'high']);
export const FINGERPRINT = /^[a-f0-9]{64}$/;
export const RUNTIME_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function objectValue(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

export function exactKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const expectedSet = new Set(expected);
  const missing = expected.filter((key) => !(key in value));
  const extra = Object.keys(value).filter((key) => !expectedSet.has(key));
  if (missing.length) throw new Error(`${name} is missing: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`${name} has unsupported fields: ${extra.join(', ')}`);
}

export function nonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.length) throw new Error(`${name} must be a non-empty string`);
}

export function nonBlankString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim().length) throw new Error(`${name} must be a non-blank string`);
}

export function nullableString(value: unknown, name: string): void {
  if (value !== null && typeof value !== 'string') throw new Error(`${name} must be a string or null`);
}

export function enumValue(value: unknown, allowed: Set<string>, name: string): asserts value is string {
  if (typeof value !== 'string' || !allowed.has(value)) throw new Error(`${name} has unsupported value: ${String(value)}`);
}

export function stringArray(value: unknown, name: string, unique = false): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error(`${name} must be an array of strings`);
  if (unique && new Set(value).size !== value.length) throw new Error(`${name} must contain unique values`);
}

export function nonEmptyUniqueStringArray(value: unknown, name: string): asserts value is string[] {
  stringArray(value, name, true);
  if (!value.length || value.some((item) => !item.trim().length)) {
    throw new Error(`${name} must contain at least one non-blank string`);
  }
  if (new Set(value.map((item) => item.trim())).size !== value.length) {
    throw new Error(`${name} must remain unique after trimming whitespace`);
  }
}

export function repositoryPath(value: unknown, name: string): string {
  nonBlankString(value, name);
  const normalized = value.trim().replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.split('/').some((part) => part === '..')) {
    throw new Error(`${name} must be a relative repository path without parent traversal`);
  }
  return normalized;
}

export function exactStringSet(actual: string[], expected: string[], name: string): void {
  const normalizedActual = [...actual].sort();
  if (normalizedActual.length !== expected.length
    || normalizedActual.some((value, index) => value !== expected[index])) {
    throw new Error(`${name} does not match the grounded diagnostic set`);
  }
}

export function uniqueIdArray(value: unknown, pattern: RegExp, name: string): asserts value is string[] {
  stringArray(value, name, true);
  if (value.some((item) => !pattern.test(item))) throw new Error(`${name} contains an invalid id`);
}

export function nonEmptyUniqueIdArray(value: unknown, pattern: RegExp, name: string): asserts value is string[] {
  uniqueIdArray(value, pattern, name);
  if (!value.length) throw new Error(`${name} must contain at least one id`);
}

export function knownReferences(values: string[], known: Set<string>, name: string): void {
  const unknown = values.filter((value) => !known.has(value));
  if (unknown.length) throw new Error(`${name} references unknown ids: ${unknown.join(', ')}`);
}

export function confidence(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1`);
  }
}

export function assertAcyclicProposalDependencies(proposals: TodoProposal[]): void {
  const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, chain: string[]): void => {
    if (visiting.has(id)) {
      const start = chain.indexOf(id);
      throw new Error(`TODO proposal dependency cycle: ${[...chain.slice(Math.max(0, start)), id].join(' -> ')}`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const proposal of proposals) visit(proposal.id, []);
}

export function dateString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !ISO_DATE_TIME.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${name} must be an ISO date-time string`);
  }
}

export function nullableDate(value: unknown, name: string): void {
  if (value !== null) dateString(value, name);
}

export function fingerprint(value: unknown, name: string): void {
  if (typeof value !== 'string' || !FINGERPRINT.test(value)) throw new Error(`${name} must be SHA-256`);
}

export function nonNegativeInteger(value: unknown, name: string): void {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${name} must be an integer >= 0`);
}

export function countMap(value: unknown, name: string): void {
  const map = objectValue(value, name);
  for (const [key, count] of Object.entries(map)) {
    if (!key) throw new Error(`${name} keys must be non-empty`);
    nonNegativeInteger(count, `${name}.${key}`);
  }
}

export function countRecords(records: IntentRecord[], selector: (record: IntentRecord) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const key = selector(record);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function exactCounts(value: unknown, expected: Record<string, number>, name: string): void {
  const actual = objectValue(value, name);
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort();
  for (const key of keys) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${name} is inconsistent for ${key}: expected ${expected[key] ?? 0}, received ${String(actual[key] ?? 0)}`);
    }
  }
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isJsonValue);
  return false;
}
