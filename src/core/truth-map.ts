import { sha256, shortHash, stableStringify } from './id.js';
import { assertIntentGraph } from './schema.js';
import type {
  IntentGenerationMetadata,
  IntentGraph,
  IntentRecord,
  IntentRelation,
  RelationType,
  SourceKind,
  SourceLineRange,
} from './types.js';

export type TruthMapStatus =
  | 'supported'
  | 'declared_only'
  | 'observed_only'
  | 'claimed_only'
  | 'mixed'
  | 'conflicted';

export interface TruthMapSourceReference {
  recordId: string;
  kind: SourceKind;
  path: string | null;
  lines: SourceLineRange | null;
  revision: string | null;
  symbol: string | null;
  commitIndex: number | null;
  contentHash: string;
  extractor: string;
  generation: IntentGenerationMetadata;
}

export interface TruthMapEvidenceLanes {
  declared: string[];
  observed: string[];
  claimed: string[];
}

export interface TruthMapAssertion {
  id: string;
  status: TruthMapStatus;
  recordIds: string[];
  relationIds: string[];
  evidence: TruthMapEvidenceLanes;
  sources: TruthMapSourceReference[];
}

export interface TruthMap {
  schemaVersion: 't2c.truth-map/v1';
  generatedAt: string;
  graphFingerprint: string;
  fingerprint: string;
  assertions: TruthMapAssertion[];
  recordToAssertion: Record<string, string>;
  stats: {
    assertions: number;
    records: number;
    byStatus: Record<TruthMapStatus, number>;
  };
}

type AssertionByRecord = Map<string, string>;
type EvidenceLane = keyof TruthMapEvidenceLanes;
type IntentRecordIndex = Map<string, IntentRecord>;
type IntentRelationIndex = Map<string, IntentRelation>;
type RecordIdSet = Set<string>;
type StatusCounts = Record<TruthMapStatus, number>;
type TruthMapFingerprintInput = Omit<TruthMap, 'fingerprint'> | TruthMap;
type Identified = { id: string };

const ASSERTION_ID = /^TRUTH-[a-f0-9]{20}$/;
const MAPPING_RELATIONS = new Set<RelationType>([
  'declares',
  'plans',
  'implements',
  'modifies',
  'tests',
  'documents',
  'releases',
  'supersedes',
  'contradicts',
  'duplicates',
  'evidenced_by',
  'claimed_by',
  'same_as',
]);

class RecordComponents {
  private readonly parent = new Map<string, string>();

  constructor(recordIds: string[]) {
    for (const id of recordIds) this.parent.set(id, id);
  }

  find(id: string): string {
    const parent = this.parent.get(id);
    if (parent === undefined) throw new Error(`Truth map references unknown record ${id}`);
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  connect(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    const root = leftRoot.localeCompare(rightRoot) <= 0 ? leftRoot : rightRoot;
    const child = root === leftRoot ? rightRoot : leftRoot;
    this.parent.set(child, root);
  }
}

export function projectTruthMap(
  graph: IntentGraph,
  generatedAt = new Date().toISOString(),
): TruthMap {
  assertIntentGraph(graph);
  requireDateTime(generatedAt, 'Truth map generatedAt');

  const records = [...graph.records].sort(compareById);
  const components = new RecordComponents(records.map((record) => record.id));
  const mappingRelations = graph.relations
    .filter((relation) => MAPPING_RELATIONS.has(relation.type))
    .sort(compareById);

  for (const relation of mappingRelations) components.connect(relation.from, relation.to);

  const grouped = new Map<string, IntentRecord[]>();
  for (const record of records) {
    const root = components.find(record.id);
    const values = grouped.get(root) ?? [];
    values.push(record);
    grouped.set(root, values);
  }

  const assertions = [...grouped.values()]
    .map((componentRecords) => buildAssertion(componentRecords, mappingRelations))
    .sort(compareById);
  const recordToAssertion: Record<string, string> = {};
  for (const assertion of assertions) {
    for (const recordId of assertion.recordIds) {
      if (recordToAssertion[recordId] !== undefined) {
        throw new Error(`Truth map record ${recordId} belongs to more than one assertion`);
      }
      recordToAssertion[recordId] = assertion.id;
    }
  }

  const stats = {
    assertions: assertions.length,
    records: records.length,
    byStatus: countStatuses(assertions),
  };
  const projection = {
    schemaVersion: 't2c.truth-map/v1' as const,
    generatedAt,
    graphFingerprint: graph.fingerprint,
    fingerprint: '',
    assertions,
    recordToAssertion,
    stats,
  };
  const truthMap: TruthMap = {
    ...projection,
    fingerprint: truthMapFingerprint(projection),
  };
  assertTruthMap(truthMap, graph);
  return truthMap;
}

export function assertTruthMap(value: TruthMap, graph: IntentGraph): void {
  assertIntentGraph(graph);
  if (value.schemaVersion !== 't2c.truth-map/v1') throw new Error('Unsupported truth map schemaVersion');
  requireDateTime(value.generatedAt, 'Truth map generatedAt');
  if (value.graphFingerprint !== graph.fingerprint) throw new Error('Truth map graph fingerprint mismatch');

  const knownRecords = new Map(graph.records.map((record) => [record.id, record]));
  const knownRelations = new Map(graph.relations.map((relation) => [relation.id, relation]));
  const mappedRecords = validateAssertions(value.assertions, knownRecords, knownRelations);
  validateRecordCoverage(value, knownRecords, mappedRecords);
  validateMappingEndpoints(knownRelations, mappedRecords);
  validateProjectionSummary(value, graph);
}

const validateAssertions = (
  assertions: TruthMapAssertion[],
  knownRecords: IntentRecordIndex,
  knownRelations: IntentRelationIndex,
): AssertionByRecord => {
  const assertionIds = new Set<string>();
  const mappedRecords = new Map<string, string>();
  assertSortedUnique(assertions.map((assertion) => assertion.id), 'Truth map assertions');

  for (const assertion of assertions) {
    if (!ASSERTION_ID.test(assertion.id)) throw new Error(`Invalid truth map assertion id: ${assertion.id}`);
    if (assertionIds.has(assertion.id)) throw new Error(`Duplicate truth map assertion id: ${assertion.id}`);
    assertionIds.add(assertion.id);
    validateAssertion(assertion, knownRecords, knownRelations, mappedRecords);
  }
  return mappedRecords;
};

const validateAssertion = (
  assertion: TruthMapAssertion,
  knownRecords: IntentRecordIndex,
  knownRelations: IntentRelationIndex,
  mappedRecords: AssertionByRecord,
): void => {
  assertSortedUnique(assertion.recordIds, `Truth map assertion ${assertion.id} recordIds`);
  assertSortedUnique(assertion.relationIds, `Truth map assertion ${assertion.id} relationIds`);
  if (assertion.recordIds.length === 0) throw new Error(`Truth map assertion ${assertion.id} is empty`);

  const component = new Set(assertion.recordIds);
  for (const recordId of assertion.recordIds) {
    if (!knownRecords.has(recordId)) throw new Error(`Truth map assertion references unknown record ${recordId}`);
    if (mappedRecords.has(recordId)) throw new Error(`Truth map record ${recordId} belongs to more than one assertion`);
    mappedRecords.set(recordId, assertion.id);
  }
  validateEvidencePartition(assertion, component);
  validateSources(assertion, knownRecords);
  validateRelations(assertion, component, knownRelations);

  const conflicted = assertion.relationIds.some((id) => knownRelations.get(id)?.type === 'contradicts');
  const expectedStatus = classifyStatus(assertion.evidence, conflicted);
  if (assertion.status !== expectedStatus) {
    throw new Error(`Truth map assertion ${assertion.id} status must be ${expectedStatus}`);
  }
  if (assertion.id !== assertionId(assertion.recordIds, assertion.relationIds)) {
    throw new Error(`Truth map assertion ${assertion.id} does not match its content`);
  }
};

const validateRecordCoverage = (
  value: TruthMap,
  knownRecords: IntentRecordIndex,
  mappedRecords: AssertionByRecord,
): void => {
  if (mappedRecords.size !== knownRecords.size) {
    const missing = [...knownRecords.keys()].filter((id) => !mappedRecords.has(id)).sort();
    throw new Error(`Truth map does not map every graph record: ${missing.join(', ')}`);
  }
  const reverseKeys = Object.keys(value.recordToAssertion).sort();
  const expectedKeys = [...knownRecords.keys()].sort();
  if (stableStringify(reverseKeys) !== stableStringify(expectedKeys)) {
    throw new Error('Truth map reverse index must contain every graph record exactly once');
  }
  for (const recordId of expectedKeys) {
    if (value.recordToAssertion[recordId] !== mappedRecords.get(recordId)) {
      throw new Error(`Truth map reverse index mismatch for ${recordId}`);
    }
  }
};

const validateMappingEndpoints = (
  knownRelations: IntentRelationIndex,
  mappedRecords: AssertionByRecord,
): void => {
  for (const relation of knownRelations.values()) {
    if (!MAPPING_RELATIONS.has(relation.type)) continue;
    const fromAssertion = mappedRecords.get(relation.from);
    const toAssertion = mappedRecords.get(relation.to);
    if (fromAssertion !== toAssertion) {
      throw new Error(`Truth map relation ${relation.id} endpoints belong to different assertions`);
    }
  }
};

const validateProjectionSummary = (value: TruthMap, graph: IntentGraph): void => {
  const expectedStats = {
    assertions: value.assertions.length,
    records: graph.records.length,
    byStatus: countStatuses(value.assertions),
  };
  if (stableStringify(value.stats) !== stableStringify(expectedStats)) {
    throw new Error('Truth map stats do not match assertions');
  }
  if (value.fingerprint !== truthMapFingerprint(value)) {
    throw new Error('Truth map fingerprint does not match projection content');
  }
};

const buildAssertion = (
  records: IntentRecord[],
  relations: IntentRelation[],
): TruthMapAssertion => {
  const recordIds = records.map((record) => record.id).sort();
  const component = new Set(recordIds);
  const componentRelations = relations
    .filter((relation) => component.has(relation.from) && component.has(relation.to))
    .sort(compareById);
  const evidence: TruthMapEvidenceLanes = { declared: [], observed: [], claimed: [] };
  for (const record of records) evidence[laneFor(record)].push(record.id);
  evidence.declared.sort();
  evidence.observed.sort();
  evidence.claimed.sort();
  const relationIds = componentRelations.map((relation) => relation.id);
  const conflicted = componentRelations.some((relation) => relation.type === 'contradicts');
  return {
    id: assertionId(recordIds, relationIds),
    status: classifyStatus(evidence, conflicted),
    recordIds,
    relationIds,
    evidence,
    sources: records.map(sourceReference).sort((left, right) => left.recordId.localeCompare(right.recordId)),
  };
};

const laneFor = (record: IntentRecord): EvidenceLane => {
  if (record.epistemic.class === 'declaration' || record.epistemic.class === 'plan') return 'declared';
  if (record.epistemic.class === 'fact') return 'observed';
  return 'claimed';
};

const classifyStatus = (evidence: TruthMapEvidenceLanes, conflicted: boolean): TruthMapStatus => {
  if (conflicted) return 'conflicted';
  const declared = evidence.declared.length > 0;
  const observed = evidence.observed.length > 0;
  const claimed = evidence.claimed.length > 0;
  if (declared && observed) return 'supported';
  if (Number(declared) + Number(observed) + Number(claimed) > 1) return 'mixed';
  if (declared) return 'declared_only';
  if (observed) return 'observed_only';
  return 'claimed_only';
};

const sourceReference = (record: IntentRecord): TruthMapSourceReference => {
  return {
    recordId: record.id,
    kind: record.source.kind,
    path: record.source.path,
    lines: record.source.lines === null ? null : { ...record.source.lines },
    revision: record.source.revision,
    symbol: record.source.symbol,
    commitIndex: record.source.commitIndex,
    contentHash: record.source.contentHash,
    extractor: record.source.extractor,
    generation: { ...record.metadata.generation },
  };
};

const assertionId = (recordIds: string[], relationIds: string[]): string => {
  return `TRUTH-${shortHash(stableStringify({ recordIds: [...recordIds].sort(), relationIds: [...relationIds].sort() }), 20)}`;
};

const countStatuses = (assertions: TruthMapAssertion[]): StatusCounts => {
  const counts: StatusCounts = {
    supported: 0,
    declared_only: 0,
    observed_only: 0,
    claimed_only: 0,
    mixed: 0,
    conflicted: 0,
  };
  for (const assertion of assertions) counts[assertion.status] += 1;
  return counts;
};

const truthMapFingerprint = (value: TruthMapFingerprintInput): string => {
  // generatedAt is display metadata by contract. Identity must stay stable
  // when the same projection is reproduced at a different wall-clock time.
  return sha256(stableStringify({
    schemaVersion: value.schemaVersion,
    graphFingerprint: value.graphFingerprint,
    assertions: value.assertions,
    recordToAssertion: value.recordToAssertion,
    stats: value.stats,
  }));
};

const validateEvidencePartition = (assertion: TruthMapAssertion, component: RecordIdSet): void => {
  const lanes = [assertion.evidence.declared, assertion.evidence.observed, assertion.evidence.claimed];
  const seen = new Set<string>();
  for (const [index, values] of lanes.entries()) {
    assertSortedUnique(values, `Truth map assertion ${assertion.id} evidence lane ${index}`);
    for (const recordId of values) {
      if (!component.has(recordId)) throw new Error(`Truth map evidence references foreign record ${recordId}`);
      if (seen.has(recordId)) throw new Error(`Truth map evidence duplicates record ${recordId}`);
      seen.add(recordId);
    }
  }
  if (seen.size !== component.size) throw new Error(`Truth map assertion ${assertion.id} evidence is incomplete`);
};

const validateSources = (assertion: TruthMapAssertion, records: IntentRecordIndex): void => {
  const sourceIds = assertion.sources.map((source) => source.recordId);
  assertSortedUnique(sourceIds, `Truth map assertion ${assertion.id} source recordIds`);
  if (stableStringify(sourceIds) !== stableStringify(assertion.recordIds)) {
    throw new Error(`Truth map assertion ${assertion.id} sources must match recordIds`);
  }
  for (const source of assertion.sources) {
    const record = records.get(source.recordId);
    if (!record || stableStringify(source) !== stableStringify(sourceReference(record))) {
      throw new Error(`Truth map source does not match graph record ${source.recordId}`);
    }
  }
};

const validateRelations = (
  assertion: TruthMapAssertion,
  component: RecordIdSet,
  relations: IntentRelationIndex,
): void => {
  for (const relationId of assertion.relationIds) {
    const relation = relations.get(relationId);
    if (!relation) throw new Error(`Truth map assertion references unknown relation ${relationId}`);
    if (!MAPPING_RELATIONS.has(relation.type)) throw new Error(`Truth map assertion uses structural relation ${relationId}`);
    if (!component.has(relation.from) || !component.has(relation.to)) {
      throw new Error(`Truth map relation ${relationId} crosses assertion boundary`);
    }
  }

  const expectedRelationIds = [...relations.values()]
    .filter((relation) => MAPPING_RELATIONS.has(relation.type)
      && component.has(relation.from)
      && component.has(relation.to))
    .map((relation) => relation.id)
    .sort();
  if (stableStringify(assertion.relationIds) !== stableStringify(expectedRelationIds)) {
    throw new Error(`Truth map assertion ${assertion.id} must retain every mapping relation`);
  }
  assertConnected(assertion, relations);
};

const assertConnected = (
  assertion: TruthMapAssertion,
  relations: IntentRelationIndex,
): void => {
  if (assertion.recordIds.length < 2) return;
  const adjacent = new Map(assertion.recordIds.map((recordId) => [recordId, new Set<string>()]));
  for (const relationId of assertion.relationIds) {
    const relation = relations.get(relationId);
    if (!relation) continue;
    adjacent.get(relation.from)?.add(relation.to);
    adjacent.get(relation.to)?.add(relation.from);
  }
  const first = assertion.recordIds[0];
  if (first === undefined) return;
  const visited = new Set([first]);
  const pending = [first];
  while (pending.length > 0) {
    const recordId = pending.pop();
    if (recordId === undefined) continue;
    for (const neighbor of adjacent.get(recordId) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }
  if (visited.size !== assertion.recordIds.length) {
    throw new Error(`Truth map assertion ${assertion.id} contains disconnected records`);
  }
};

const assertSortedUnique = (values: string[], name: string): void => {
  const sorted = [...new Set(values)].sort();
  if (stableStringify(values) !== stableStringify(sorted)) throw new Error(`${name} must be sorted and unique`);
};

const requireDateTime = (value: string, name: string): void => {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) throw new Error(`${name} must be an ISO date-time`);
};

const compareById = (left: Identified, right: Identified): number => {
  return left.id.localeCompare(right.id);
};
