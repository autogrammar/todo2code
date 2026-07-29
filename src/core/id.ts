import { createHash, randomUUID } from 'node:crypto';
import type { IntentRecord, IntentRelation, JsonValue } from './types.js';

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      output[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return output;
  }
  return value;
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function shortHash(value: string | Buffer, length = 16): string {
  return sha256(value).slice(0, length);
}

export function createIntentId(seed: unknown, prefix = 'INT'): string {
  return `${prefix}-${shortHash(stableStringify(seed), 20)}`;
}

export function createRelationId(relation: Omit<IntentRelation, 'id'>): string {
  return `REL-${shortHash(stableStringify(relation), 20)}`;
}

export function graphFingerprint(records: IntentRecord[], relations: IntentRelation[]): string {
  const payload = {
    records: records.map((record) => ({ ...record, observedAt: null })).sort((a, b) => a.id.localeCompare(b.id)),
    relations: [...relations].sort((a, b) => a.id.localeCompare(b.id)),
  };
  return sha256(stableStringify(payload));
}

export function newRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${stamp}-${randomUUID().slice(0, 8)}`;
}

export function asJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
