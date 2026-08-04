import { graphFingerprint } from '../id.js';
import type {
  CodeChangeAcceptance,
  CodeChangePlan,
  Conclusion,
  DiagnosticReport,
  IntentGraph,
  IntentGraphDiff,
  IntentRecord,
  IntentRelation,
  TodoProposal,
} from '../types.js';
import {
  ACTIONS,
  EPISTEMIC_CLASSES,
  FINGERPRINT,
  GENERATION_EFFECTIVE_MODES,
  ISO_DATE_TIME,
  LIFECYCLES,
  MODALITIES,
  SOURCE_KINDS,
  RECORD_ID,
  RELATION_ID,
  RELATION_TYPES,
  RUNTIME_VERSION,
  POLARITIES,
} from './constants.js';
import {
  assertGroundedGenerationMetadata,
  countMap,
  countRecords,
  dateString,
  exactCounts,
  exactKeys,
  enumValue,
  fingerprint,
  nonBlankString,
  nonEmptyString,
  nonNegativeInteger,
  nullableDate,
  nullableString,
  objectValue,
  stringArray,
  isJsonValue,
} from './utils.js';

export interface GroundedValidationContext {
  graph: IntentGraph;
  diagnostics: DiagnosticReport;
}

export interface TodoProposalValidationContext extends GroundedValidationContext {
  conclusions: Conclusion[];
}

export interface CodeChangePlanValidationContext extends GroundedValidationContext {
  conclusions?: Conclusion[];
  proposals?: TodoProposal[];
}

export interface CodeChangeAcceptanceValidationContext {
  plan: CodeChangePlan;
  before: GroundedValidationContext;
  after: GroundedValidationContext;
}

export function assertIntentRecord(value: unknown): asserts value is IntentRecord {
  const record = objectValue(value, 'Intent record');
  exactKeys(record, ['schemaVersion', 'id', 'statement', 'lifecycle', 'source', 'epistemic', 'observedAt', 'metadata'], 'Intent record');
  if (record.schemaVersion !== 't2c.intent/v1') throw new Error('Unsupported intent schemaVersion');
  if (typeof record.id !== 'string' || !RECORD_ID.test(record.id)) throw new Error('Intent record id must match INT-<SOURCE>-<20 hex>');
  const recordId = nonEmptyString(record.id, 'Intent record: id');
  const statement = assertIntentStatement(recordId, record);
  const lifecycle = assertIntentLifecycle(recordId, record);
  const source = assertIntentSource(recordId, record);
  const epistemic = assertIntentEpistemic(recordId, record);
  const metadata = objectValue(record.metadata, `Intent ${record.id}: metadata`);
  assertIntentMetadata(recordId, metadata, source.extractor, epistemic.class, record.observedAt);
}

function assertIntentStatement(recordId: string, record: Record<string, unknown>): IntentRecord['statement'] {
  const statement = objectValue(record.statement, `Intent ${recordId}: statement`);
  exactKeys(statement, ['kind', 'actor', 'action', 'subject', 'object', 'target', 'modality', 'polarity', 'text'], `Intent ${recordId}: statement`);
  nonEmptyString(statement.kind, `Intent ${recordId}: statement.kind`);
  nullableString(statement.actor, `Intent ${recordId}: statement.actor`);
  enumValue(statement.action, ACTIONS, `Intent ${recordId}: statement.action`);
  nullableString(statement.subject, `Intent ${recordId}: statement.subject`);
  nonEmptyString(statement.object, `Intent ${recordId}: statement.object`);
  if (typeof statement.text !== 'string') throw new Error(`Intent ${recordId}: statement.text must be a string`);
  enumValue(statement.modality, MODALITIES, `Intent ${recordId}: statement.modality`);
  enumValue(statement.polarity, POLARITIES, `Intent ${recordId}: statement.polarity`);
  statement.target = assertIntentTarget(recordId, statement.target);
  return statement;
}

function assertIntentTarget(recordId: string, targetValue: unknown): IntentRecord['statement']['target'] {
  const target = objectValue(targetValue, `Intent ${recordId}: statement.target`);
  exactKeys(target, ['paths', 'symbols', 'tickets', 'versions'], `Intent ${recordId}: statement.target`);
  for (const key of ['paths', 'symbols', 'tickets', 'versions'] as const) {
    stringArray(target[key], `Intent ${recordId}: statement.target.${key}`, true);
  }
  return target;
}

function assertIntentLifecycle(recordId: string, record: Record<string, unknown>): IntentRecord['lifecycle'] {
  const lifecycle = objectValue(record.lifecycle, `Intent ${recordId}: lifecycle`);
  exactKeys(lifecycle, ['status'], `Intent ${recordId}: lifecycle`);
  enumValue(lifecycle.status, LIFECYCLES, `Intent ${recordId}: lifecycle.status`);
  return lifecycle;
}

function assertIntentSource(recordId: string, record: Record<string, unknown>): IntentRecord['source'] {
  const source = objectValue(record.source, `Intent ${recordId}: source`);
  exactKeys(source, ['kind', 'path', 'lines', 'revision', 'symbol', 'commitIndex', 'extractor', 'contentHash', 'rawExcerpt'], `Intent ${recordId}: source`);
  enumValue(source.kind, SOURCE_KINDS, `Intent ${recordId}: source.kind`);
  nullableString(source.path, `Intent ${recordId}: source.path`);
  nullableString(source.revision, `Intent ${recordId}: source.revision`);
  nullableString(source.symbol, `Intent ${recordId}: source.symbol`);
  nullableString(source.rawExcerpt, `Intent ${recordId}: source.rawExcerpt`);
  nonEmptyString(source.extractor, `Intent ${recordId}: source.extractor`);
  if (typeof source.contentHash !== 'string' || !FINGERPRINT.test(source.contentHash)) {
    throw new Error(`Intent ${recordId}: source.contentHash must be SHA-256`);
  }
  if (source.commitIndex !== null && (!Number.isInteger(source.commitIndex) || (source.commitIndex as number) < 1)) {
    throw new Error(`Intent ${recordId}: source.commitIndex must be null or an integer >= 1`);
  }
  if (source.lines !== null) {
    const lines = objectValue(source.lines, `Intent ${recordId}: source.lines`);
    exactKeys(lines, ['start', 'end'], `Intent ${recordId}: source.lines`);
    if (!Number.isInteger(lines.start) || (lines.start as number) < 1
      || !Number.isInteger(lines.end) || (lines.end as number) < (lines.start as number)) {
      throw new Error(`Intent ${recordId}: source.lines must be positive and end >= start`);
    }
  }
  return source;
}

function assertIntentEpistemic(recordId: string, record: Record<string, unknown>): IntentRecord['epistemic'] {
  const epistemic = objectValue(record.epistemic, `Intent ${recordId}: epistemic`);
  exactKeys(epistemic, ['class', 'confidence', 'basis'], `Intent ${recordId}: epistemic`);
  enumValue(epistemic.class, EPISTEMIC_CLASSES, `Intent ${recordId}: epistemic.class`);
  if (typeof epistemic.confidence !== 'number' || !Number.isFinite(epistemic.confidence)
    || epistemic.confidence < 0 || epistemic.confidence > 1) {
    throw new Error(`Intent ${recordId}: epistemic.confidence must be between 0 and 1`);
  }
  stringArray(epistemic.basis, `Intent ${recordId}: epistemic.basis`, true);
  return epistemic;
}

function assertIntentMetadata(
  recordId: string,
  metadata: unknown,
  sourceExtractor: string,
  epistemicClass: string,
  observedAt: unknown,
): void {
  if (!isJsonValue(metadata)) throw new Error(`Intent ${recordId}: metadata must contain JSON values only`);
  const typedMetadata = metadata as Record<string, unknown>;
  const generation = objectValue(typedMetadata.generation, `Intent ${recordId}: metadata.generation`);
  assertIntentGenerationMetadata(generation, `Intent ${recordId}: metadata.generation`);
  assertGenerationMatchesExtractor(generation, sourceExtractor, `Intent ${recordId}: metadata.generation`);
  nullableDate(observedAt, `Intent ${recordId}: observedAt`);
  if (epistemicClass === 'llm_inference' && (generation as { used?: unknown }).used !== 'llm') {
    throw new Error(`Intent ${recordId}: llm_inference requires metadata.generation.used=llm`);
  }
}

function assertGenerationMatchesExtractor(value: unknown, extractor: string, name: string): void {
  const generation = value as { generator: string; generatorVersion: string };
  const separator = extractor.lastIndexOf('@');
  const expectedGenerator = separator > 0 ? extractor.slice(0, separator) : extractor;
  if (generation.generator !== expectedGenerator) {
    throw new Error(`${name}.generator must match source.extractor (${expectedGenerator})`);
  }
  if (separator > 0 && generation.generatorVersion !== extractor.slice(separator + 1)) {
    throw new Error(`${name}.generatorVersion must match source.extractor (${extractor.slice(separator + 1)})`);
  }
}

function assertIntentGenerationMetadata(value: unknown, name: string): void {
  const generation = objectValue(value, name);
  exactKeys(generation, [
    'generator', 'generatorVersion', 'runtimeVersion', 'requested', 'used', 'degraded',
    'fallbackReason', 'provider', 'model', 'responseId',
  ], name);
  nonBlankString(generation.generator, `${name}.generator`);
  nonBlankString(generation.generatorVersion, `${name}.generatorVersion`);
  if (typeof generation.runtimeVersion !== 'string' || !RUNTIME_VERSION.test(generation.runtimeVersion)) {
    throw new Error(`${name}.runtimeVersion must be a semantic version`);
  }
  enumValue(generation.requested, GENERATION_EFFECTIVE_MODES, `${name}.requested`);
  enumValue(generation.used, GENERATION_EFFECTIVE_MODES, `${name}.used`);
  if (typeof generation.degraded !== 'boolean') throw new Error(`${name}.degraded must be a boolean`);
  nullableString(generation.fallbackReason, `${name}.fallbackReason`);
  nullableString(generation.provider, `${name}.provider`);
  nullableString(generation.model, `${name}.model`);
  nullableString(generation.responseId, `${name}.responseId`);
  if (generation.used === 'llm') {
    nonBlankString(generation.provider, `${name}.provider`);
    nonBlankString(generation.model, `${name}.model`);
  } else if (generation.provider !== null || generation.model !== null || generation.responseId !== null) {
    throw new Error(`${name}: deterministic generation cannot claim an LLM provider, model or responseId`);
  }
  if (generation.degraded) {
    if (generation.requested !== 'llm' || generation.used !== 'deterministic') {
      throw new Error(`${name}: degraded generation must be an LLM request using deterministic fallback`);
    }
    nonBlankString(generation.fallbackReason, `${name}.fallbackReason`);
  } else if (generation.fallbackReason !== null) {
    throw new Error(`${name}.fallbackReason must be null when generation is not degraded`);
  }
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

export function assertRelation(value: unknown, knownRecords?: Set<string>): asserts value is IntentRelation {
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
