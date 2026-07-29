import { graphFingerprint } from './id.js';
import type { IntentGraph, IntentGraphDiff, IntentRecord, IntentRelation, JsonValue } from './types.js';

const ACTIONS = new Set([
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
]);
const MODALITIES = new Set(['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown']);
const POLARITIES = new Set(['positive', 'negative']);
const LIFECYCLES = new Set([
  'proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown',
]);
const SOURCE_KINDS = new Set(['nl', 'git', 'ast', 'todo', 'changelog', 'document', 'agent_log', 'test', 'system']);
const EPISTEMIC_CLASSES = new Set(['declaration', 'plan', 'claim', 'fact', 'inference', 'llm_inference']);
const RELATION_TYPES = new Set([
  'declares', 'plans', 'implements', 'modifies', 'tests', 'documents', 'releases', 'depends_on',
  'blocks', 'supersedes', 'contradicts', 'duplicates', 'evidenced_by', 'claimed_by', 'same_as', 'related_to',
]);
const RECORD_ID = /^INT-[A-Z]+-[a-f0-9]{20}$/;
const RELATION_ID = /^REL-[a-f0-9]{20}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function assertIntentRecord(value: unknown): asserts value is IntentRecord {
  const record = objectValue(value, 'Intent record');
  exactKeys(record, ['schemaVersion', 'id', 'statement', 'lifecycle', 'source', 'epistemic', 'observedAt', 'metadata'], 'Intent record');
  if (record.schemaVersion !== 't2c.intent/v1') throw new Error('Unsupported intent schemaVersion');
  if (typeof record.id !== 'string' || !RECORD_ID.test(record.id)) throw new Error('Intent record id must match INT-<SOURCE>-<20 hex>');

  const statement = objectValue(record.statement, `Intent ${record.id}: statement`);
  exactKeys(statement, ['kind', 'actor', 'action', 'subject', 'object', 'target', 'modality', 'polarity', 'text'], `Intent ${record.id}: statement`);
  nonEmptyString(statement.kind, `Intent ${record.id}: statement.kind`);
  nullableString(statement.actor, `Intent ${record.id}: statement.actor`);
  enumValue(statement.action, ACTIONS, `Intent ${record.id}: statement.action`);
  nullableString(statement.subject, `Intent ${record.id}: statement.subject`);
  nonEmptyString(statement.object, `Intent ${record.id}: statement.object`);
  if (typeof statement.text !== 'string') throw new Error(`Intent ${record.id}: statement.text must be a string`);
  enumValue(statement.modality, MODALITIES, `Intent ${record.id}: statement.modality`);
  enumValue(statement.polarity, POLARITIES, `Intent ${record.id}: statement.polarity`);

  const target = objectValue(statement.target, `Intent ${record.id}: statement.target`);
  exactKeys(target, ['paths', 'symbols', 'tickets', 'versions'], `Intent ${record.id}: statement.target`);
  for (const key of ['paths', 'symbols', 'tickets', 'versions'] as const) {
    stringArray(target[key], `Intent ${record.id}: statement.target.${key}`, true);
  }

  const lifecycle = objectValue(record.lifecycle, `Intent ${record.id}: lifecycle`);
  exactKeys(lifecycle, ['status'], `Intent ${record.id}: lifecycle`);
  enumValue(lifecycle.status, LIFECYCLES, `Intent ${record.id}: lifecycle.status`);

  const source = objectValue(record.source, `Intent ${record.id}: source`);
  exactKeys(source, ['kind', 'path', 'lines', 'revision', 'symbol', 'commitIndex', 'extractor', 'contentHash', 'rawExcerpt'], `Intent ${record.id}: source`);
  enumValue(source.kind, SOURCE_KINDS, `Intent ${record.id}: source.kind`);
  nullableString(source.path, `Intent ${record.id}: source.path`);
  nullableString(source.revision, `Intent ${record.id}: source.revision`);
  nullableString(source.symbol, `Intent ${record.id}: source.symbol`);
  nullableString(source.rawExcerpt, `Intent ${record.id}: source.rawExcerpt`);
  nonEmptyString(source.extractor, `Intent ${record.id}: source.extractor`);
  if (typeof source.contentHash !== 'string' || !FINGERPRINT.test(source.contentHash)) {
    throw new Error(`Intent ${record.id}: source.contentHash must be SHA-256`);
  }
  if (source.commitIndex !== null && (!Number.isInteger(source.commitIndex) || (source.commitIndex as number) < 1)) {
    throw new Error(`Intent ${record.id}: source.commitIndex must be null or an integer >= 1`);
  }
  if (source.lines !== null) {
    const lines = objectValue(source.lines, `Intent ${record.id}: source.lines`);
    exactKeys(lines, ['start', 'end'], `Intent ${record.id}: source.lines`);
    if (!Number.isInteger(lines.start) || (lines.start as number) < 1 || !Number.isInteger(lines.end) || (lines.end as number) < (lines.start as number)) {
      throw new Error(`Intent ${record.id}: source.lines must be positive and end >= start`);
    }
  }

  const epistemic = objectValue(record.epistemic, `Intent ${record.id}: epistemic`);
  exactKeys(epistemic, ['class', 'confidence', 'basis'], `Intent ${record.id}: epistemic`);
  enumValue(epistemic.class, EPISTEMIC_CLASSES, `Intent ${record.id}: epistemic.class`);
  if (typeof epistemic.confidence !== 'number' || !Number.isFinite(epistemic.confidence)
    || epistemic.confidence < 0 || epistemic.confidence > 1) {
    throw new Error(`Intent ${record.id}: epistemic.confidence must be between 0 and 1`);
  }
  stringArray(epistemic.basis, `Intent ${record.id}: epistemic.basis`, true);
  nullableDate(record.observedAt, `Intent ${record.id}: observedAt`);

  const metadata = objectValue(record.metadata, `Intent ${record.id}: metadata`);
  if (!isJsonValue(metadata)) throw new Error(`Intent ${record.id}: metadata must contain JSON values only`);
}

export function assertIntentRecords(values: unknown): asserts values is IntentRecord[] {
  if (!Array.isArray(values)) throw new Error('Intent records must be an array');
  values.forEach(assertIntentRecord);
}

export function assertIntentGraph(value: unknown): asserts value is IntentGraph {
  const graph = objectValue(value, 'Intent graph');
  exactKeys(graph, ['schemaVersion', 'generatedAt', 'fingerprint', 'records', 'relations', 'stats'], 'Intent graph');
  if (graph.schemaVersion !== 't2c.graph/v1') throw new Error('Unsupported graph schemaVersion');
  dateString(graph.generatedAt, 'Graph generatedAt');
  fingerprint(graph.fingerprint, 'Graph fingerprint');
  assertIntentRecords(graph.records);
  if (!Array.isArray(graph.relations)) throw new Error('Graph relations must be an array');
  const recordIds = new Set((graph.records as IntentRecord[]).map((record) => record.id));
  if (recordIds.size !== (graph.records as IntentRecord[]).length) throw new Error('Graph record IDs must be unique');
  const relationIds = new Set<string>();
  for (const relation of graph.relations) {
    assertRelation(relation, recordIds);
    if (relationIds.has((relation as IntentRelation).id)) throw new Error(`Duplicate relation id: ${(relation as IntentRelation).id}`);
    relationIds.add((relation as IntentRelation).id);
  }
  const stats = objectValue(graph.stats, 'Graph stats');
  exactKeys(stats, ['bySource', 'byAction', 'byStatus'], 'Graph stats');
  countMap(stats.bySource, 'Graph stats.bySource');
  countMap(stats.byAction, 'Graph stats.byAction');
  countMap(stats.byStatus, 'Graph stats.byStatus');
  const records = graph.records as IntentRecord[];
  exactCounts(stats.bySource, countRecords(records, (record) => record.source.kind), 'Graph stats.bySource');
  exactCounts(stats.byAction, countRecords(records, (record) => record.statement.action), 'Graph stats.byAction');
  exactCounts(stats.byStatus, countRecords(records, (record) => record.lifecycle.status), 'Graph stats.byStatus');
  const expectedFingerprint = graphFingerprint(records, graph.relations as IntentRelation[]);
  if (graph.fingerprint !== expectedFingerprint) throw new Error('Graph fingerprint does not match records and relations');
}

export function assertIntentGraphDiff(value: unknown): asserts value is IntentGraphDiff {
  const diff = objectValue(value, 'Intent graph diff');
  exactKeys(diff, ['schemaVersion', 'generatedAt', 'fingerprint', 'beforeFingerprint', 'afterFingerprint', 'records', 'relations', 'summary'], 'Intent graph diff');
  if (diff.schemaVersion !== 't2c.diff/v1') throw new Error('Unsupported graph diff schemaVersion');
  dateString(diff.generatedAt, 'Graph diff generatedAt');
  fingerprint(diff.fingerprint, 'Graph diff fingerprint');
  fingerprint(diff.beforeFingerprint, 'Graph diff beforeFingerprint');
  fingerprint(diff.afterFingerprint, 'Graph diff afterFingerprint');

  const records = objectValue(diff.records, 'Graph diff records');
  exactKeys(records, ['added', 'removed', 'changed', 'unchanged'], 'Graph diff records');
  assertIntentRecords(records.added);
  assertIntentRecords(records.removed);
  if (!Array.isArray(records.changed)) throw new Error('Graph diff changed records must be an array');
  for (const rawChange of records.changed) {
    const change = objectValue(rawChange, 'Graph diff record change');
    exactKeys(change, ['identity', 'before', 'after', 'changedFields'], 'Graph diff record change');
    nonEmptyString(change.identity, 'Graph diff record change identity');
    assertIntentRecord(change.before);
    assertIntentRecord(change.after);
    stringArray(change.changedFields, 'Graph diff changedFields', true);
  }
  nonNegativeInteger(records.unchanged, 'Graph diff records.unchanged');

  const relations = objectValue(diff.relations, 'Graph diff relations');
  exactKeys(relations, ['added', 'removed', 'unchanged'], 'Graph diff relations');
  if (!Array.isArray(relations.added) || !Array.isArray(relations.removed)) throw new Error('Graph diff relation sets must be arrays');
  [...relations.added, ...relations.removed].forEach((relation) => assertRelation(relation));
  nonNegativeInteger(relations.unchanged, 'Graph diff relations.unchanged');

  const summary = objectValue(diff.summary, 'Graph diff summary');
  exactKeys(summary, ['recordsAdded', 'recordsRemoved', 'recordsChanged', 'recordsUnchanged', 'relationsAdded', 'relationsRemoved', 'relationsUnchanged'], 'Graph diff summary');
  for (const [key, count] of Object.entries(summary)) nonNegativeInteger(count, `Graph diff summary.${key}`);
  const expectedCounts: Record<string, number> = {
    recordsAdded: (records.added as unknown[]).length,
    recordsRemoved: (records.removed as unknown[]).length,
    recordsChanged: (records.changed as unknown[]).length,
    recordsUnchanged: records.unchanged as number,
    relationsAdded: (relations.added as unknown[]).length,
    relationsRemoved: (relations.removed as unknown[]).length,
    relationsUnchanged: relations.unchanged as number,
  };
  exactCounts(summary, expectedCounts, 'Graph diff summary');
}

function assertRelation(value: unknown, knownRecords?: Set<string>): asserts value is IntentRelation {
  const relation = objectValue(value, 'Intent relation');
  exactKeys(relation, ['id', 'from', 'to', 'type', 'confidence', 'basis'], 'Intent relation');
  if (typeof relation.id !== 'string' || !RELATION_ID.test(relation.id)) throw new Error('Intent relation id must match REL-<20 hex>');
  nonEmptyString(relation.from, `Relation ${relation.id}: from`);
  nonEmptyString(relation.to, `Relation ${relation.id}: to`);
  enumValue(relation.type, RELATION_TYPES, `Relation ${relation.id}: type`);
  if (typeof relation.confidence !== 'number' || !Number.isFinite(relation.confidence)
    || relation.confidence < 0 || relation.confidence > 1) {
    throw new Error(`Relation ${relation.id}: confidence must be between 0 and 1`);
  }
  stringArray(relation.basis, `Relation ${relation.id}: basis`, true);
  if (knownRecords && (!knownRecords.has(relation.from as string) || !knownRecords.has(relation.to as string))) {
    throw new Error(`Relation ${relation.id} references unknown records`);
  }
}

function objectValue(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const expectedSet = new Set(expected);
  const missing = expected.filter((key) => !(key in value));
  const extra = Object.keys(value).filter((key) => !expectedSet.has(key));
  if (missing.length) throw new Error(`${name} is missing: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`${name} has unsupported fields: ${extra.join(', ')}`);
}

function nonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.length) throw new Error(`${name} must be a non-empty string`);
}

function nullableString(value: unknown, name: string): void {
  if (value !== null && typeof value !== 'string') throw new Error(`${name} must be a string or null`);
}

function enumValue(value: unknown, allowed: Set<string>, name: string): asserts value is string {
  if (typeof value !== 'string' || !allowed.has(value)) throw new Error(`${name} has unsupported value: ${String(value)}`);
}

function stringArray(value: unknown, name: string, unique = false): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error(`${name} must be an array of strings`);
  if (unique && new Set(value).size !== value.length) throw new Error(`${name} must contain unique values`);
}

function dateString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !ISO_DATE_TIME.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${name} must be an ISO date-time string`);
  }
}

function nullableDate(value: unknown, name: string): void {
  if (value !== null) dateString(value, name);
}

function fingerprint(value: unknown, name: string): void {
  if (typeof value !== 'string' || !FINGERPRINT.test(value)) throw new Error(`${name} must be SHA-256`);
}

function nonNegativeInteger(value: unknown, name: string): void {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${name} must be an integer >= 0`);
}

function countMap(value: unknown, name: string): void {
  const map = objectValue(value, name);
  for (const [key, count] of Object.entries(map)) {
    if (!key) throw new Error(`${name} keys must be non-empty`);
    nonNegativeInteger(count, `${name}.${key}`);
  }
}

function countRecords(records: IntentRecord[], selector: (record: IntentRecord) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const key = selector(record);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function exactCounts(value: unknown, expected: Record<string, number>, name: string): void {
  const actual = objectValue(value, name);
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort();
  for (const key of keys) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${name} is inconsistent for ${key}: expected ${expected[key] ?? 0}, received ${String(actual[key] ?? 0)}`);
    }
  }
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isJsonValue);
  return false;
}
