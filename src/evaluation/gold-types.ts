import type {
  IntentAction,
  LifecycleStatus,
  Modality,
  Polarity,
  SourceKind,
  TodoPriority,
} from '../core/types.js';

export const GOLD_FIXED_TIME = '2026-07-30T00:00:00.000Z';

export type GoldExtractionChannel = 'nl' | 'documentation' | 'markdown';

export interface GoldRecordProjection {
  sourceKind: SourceKind;
  action: IntentAction;
  text: string;
  lifecycle: LifecycleStatus;
  modality: Modality;
  polarity: Polarity;
  paths: string[];
  symbols: string[];
  tickets: string[];
  versions: string[];
  lines: { start: number; end: number } | null;
}

interface GoldDocumentModelRecord {
  kind: string;
  actor: string | null;
  action: IntentAction;
  subject: string | null;
  object: string;
  modality: Modality;
  polarity: Polarity;
  lifecycle: LifecycleStatus;
  confidence: number;
  basis: string[];
  target: { paths: string[]; symbols: string[]; tickets: string[]; versions: string[] };
  sourceLines: { start: number; end: number };
  text: string;
}

export interface GoldExtractionCase {
  id: string;
  channel: GoldExtractionChannel;
  sourcePath?: string;
  text?: string;
  files?: Record<string, string>;
  todoPath?: string | null;
  changelogPath?: string | null;
  documentResponse?: { records: GoldDocumentModelRecord[] };
  expected: GoldRecordProjection[];
}

export interface GoldFixtureRecord {
  label: string;
  sourceKind: SourceKind;
  action: IntentAction;
  text: string;
  lifecycle: LifecycleStatus;
  target?: { paths?: string[]; symbols?: string[]; tickets?: string[]; versions?: string[] };
  polarity?: Polarity;
  /**
   * `statement.kind`, defaulting to `gold_fixture`. Set it to `module_fact` to
   * build a module aggregate: the capability-topic heuristic only fires when
   * one side of the pair is a module aggregate.
   */
  statementKind?: string;
  /** Extra record metadata, e.g. the `capabilities` list carried by aggregates. */
  metadata?: Record<string, unknown>;
}

/**
 * How a linking relation is supposed to be justified.
 *
 * `exact-target` covers a shared ticket, path or symbol — an identifier match
 * the linker can prove. `capability-topic` covers the `module_topic` heuristic
 * that matches prose declarations against module aggregates. They have very
 * different failure modes, so a single blended precision/recall number hides
 * exactly the risk worth watching.
 */
export type GoldRelationClass = 'exact-target' | 'capability-topic';

export const GOLD_RELATION_CLASSES: GoldRelationClass[] = ['exact-target', 'capability-topic'];

export interface GoldExpectedRelation {
  from: string;
  to: string;
  type: string;
  /** Defaults to `exact-target` for datasets written before the split. */
  relationClass?: GoldRelationClass;
}

export interface GoldLinkingCase {
  id: string;
  records: GoldFixtureRecord[];
  expected: GoldExpectedRelation[];
  /**
   * Pairs that must stay unlinked. Without hard negatives, lowering the
   * capability-topic floor looks free: recall rises and nothing reports the
   * spurious relations it creates.
   */
  forbidden?: Array<{ from: string; to: string }>;
}

export interface GoldProposalFixture {
  label: string;
  title: string;
  description: string;
  priority: TodoPriority;
  target: { paths: string[]; symbols: string[]; tickets: string[]; versions: string[] };
  acceptanceCriteria: string[];
  requiredRecordLabels: string[];
  expectedDuplicate: boolean;
}

export interface GoldDsl2TodoCase {
  id: string;
  records: GoldFixtureRecord[];
  proposals: GoldProposalFixture[];
}

export interface GoldDataset {
  schemaVersion: 't2c.gold-dataset/v1';
  name: string;
  description: string;
  extraction: GoldExtractionCase[];
  linking: GoldLinkingCase[];
  dsl2todo: GoldDsl2TodoCase[];
}

export interface BinaryMetric {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
}

export interface GoldEvaluationReport {
  schemaVersion: 't2c.gold-report/v1';
  dataset: { schemaVersion: string; name: string; fingerprint: string };
  extraction: { overall: BinaryMetric; byChannel: Record<GoldExtractionChannel, BinaryMetric> };
  linking: BinaryMetric & {
    /** Same metric split by how the relation is justified. */
    byClass: Record<GoldRelationClass, BinaryMetric>;
    /** Forbidden pairs the linker created anyway. */
    forbiddenViolations: number;
  };
  dsl2todo: {
    citationCompleteness: { cited: number; required: number; rate: number };
    deduplication: BinaryMetric & { classifiedDuplicates: number; proposals: number; rate: number };
  };
  stability: { repeatedRuns: 2; stable: boolean; rate: number; fingerprints: [string, string] };
}

export function assertGoldDataset(value: unknown): asserts value is GoldDataset {
  assertDatasetObject(value);
  const dataset = value as Partial<GoldDataset>;
  assertDatasetMetadata(dataset);
  assertDatasetCollections(dataset);
  assertUniqueCaseIds(dataset as GoldDataset);
  assertExtractionCoverage(dataset as GoldDataset);
}

function assertDatasetObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Gold dataset must be an object');
  }
}

function assertDatasetMetadata(dataset: Partial<GoldDataset>): void {
  if (dataset.schemaVersion !== 't2c.gold-dataset/v1') {
    throw new Error('Unsupported gold dataset schemaVersion');
  }
  if (typeof dataset.name !== 'string' || !dataset.name.trim()) {
    throw new Error('Gold dataset name must be non-blank');
  }
  if (typeof dataset.description !== 'string' || !dataset.description.trim()) {
    throw new Error('Gold dataset description must be non-blank');
  }
}

function assertDatasetCollections(dataset: Partial<GoldDataset>): void {
  if (!Array.isArray(dataset.extraction) || !Array.isArray(dataset.linking) || !Array.isArray(dataset.dsl2todo)) {
    throw new Error('Gold dataset extraction, linking and dsl2todo must be arrays');
  }
  if (!dataset.extraction.length || !dataset.linking.length || !dataset.dsl2todo.length) {
    throw new Error('Gold dataset must cover extraction, linking and DSL2TODO');
  }
}

function assertUniqueCaseIds(dataset: GoldDataset): void {
  const ids = [...dataset.extraction, ...dataset.linking, ...dataset.dsl2todo].map((fixture) => fixture.id);
  if (ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error('Gold case IDs must be non-blank and unique');
  }
}

function assertExtractionCoverage(dataset: GoldDataset): void {
  const channels = new Set(dataset.extraction.map((fixture) => fixture.channel));
  for (const required of ['nl', 'documentation', 'markdown']) {
    if (!channels.has(required as GoldExtractionChannel)) {
      throw new Error(`Gold dataset is missing ${required} extraction coverage`);
    }
  }
}
