import type {
  IntentAction,
  LifecycleStatus,
  Modality,
  Polarity,
  SourceKind,
  TodoPriority,
} from '../core/types.js';

export const GOLD_FIXED_TIME = '2026-07-30T00:00:00.000Z';

/**
 * `documentation` runs the audited LLM path against a captured response;
 * `documentation-deterministic` runs the offline Markdown baseline, which is
 * the only documentation converter every run has. They fail differently — the
 * first on response repair, the second on modality and target heuristics — so
 * they are measured apart.
 */
export type GoldExtractionChannel =
  | 'nl'
  | 'documentation'
  | 'documentation-deterministic'
  | 'markdown';

export const GOLD_EXTRACTION_CHANNELS: GoldExtractionChannel[] = [
  'nl',
  'documentation',
  'documentation-deterministic',
  'markdown',
];

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
   * Defaults to `required` for TODO records and `observed` for everything else.
   * Documentation cases must set it explicitly: whether a `document` record
   * counts as a plan is decided by its modality, which is the whole difference
   * between prescriptive and descriptive prose.
   */
  modality?: Modality;
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

export interface GoldRerankerDecisionFixture {
  module: string;
  score: number;
  verdict: 'accept' | 'reject' | 'abstain';
  confidence: number;
  reasonCode:
    | 'repository_evidence_supports_match'
    | 'wrong_target'
    | 'contradicted'
    | 'insufficient_evidence'
    | 'ambiguous'
    | 'multi_module';
  rationale: string;
  declarationQuote: string;
  moduleQuote: string;
}

export interface GoldRerankerFixture {
  model: string;
  modelRevision: string;
  decisions: GoldRerankerDecisionFixture[];
}

export interface GoldLinkingCase {
  id: string;
  /** Optional evaluation cohort reported independently from relation class. */
  cohort?: 'cross-language';
  records: GoldFixtureRecord[];
  expected: GoldExpectedRelation[];
  /**
   * Pairs that must stay unlinked. Without hard negatives, lowering the
   * capability-topic floor looks free: recall rises and nothing reports the
   * spurious relations it creates.
   */
  forbidden?: Array<{ from: string; to: string }>;
  /**
   * A relation the tool ought to find but demonstrably cannot yet — the
   * Polish-documentation-to-English-identifier barrier being the measured
   * example. Counted and reported separately, never in precision/recall.
   *
   * Encoding it as an ordinary expectation would make the offline gate red
   * forever, and a gate that is always red stops being read. Dropping the case
   * instead would leave the gap unmeasured, which is how it survived this long.
   */
  knownGap?: boolean;
  /** Captured structured reranker result; evaluated separately from the offline linker. */
  reranker?: GoldRerankerFixture;
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

/**
 * A diagnostic the graph must raise for one record, named by fixture label.
 *
 * Extraction and linking cannot express "this DONE claim has no implementation
 * behind it": the record extracts cleanly and links to nothing, which is
 * exactly the state under test. The claim only becomes measurable as a
 * diagnostic code.
 */
export interface GoldExpectedDiagnostic {
  record: string;
  code: string;
}

export interface GoldDiagnosticsCase {
  id: string;
  records: GoldFixtureRecord[];
  expected: GoldExpectedDiagnostic[];
  /** Codes that must not be raised for a record, e.g. a true DONE staying quiet. */
  forbidden?: GoldExpectedDiagnostic[];
}

export type GoldDatasetVersion = 't2c.gold-dataset/v1' | 't2c.gold-dataset/v2';

export const GOLD_DATASET_VERSIONS: GoldDatasetVersion[] = [
  't2c.gold-dataset/v1',
  't2c.gold-dataset/v2',
];

export interface GoldDataset {
  schemaVersion: GoldDatasetVersion;
  name: string;
  description: string;
  extraction: GoldExtractionCase[];
  linking: GoldLinkingCase[];
  dsl2todo: GoldDsl2TodoCase[];
  /** Added in v2; absent in v1 datasets, which are still evaluable. */
  diagnostics?: GoldDiagnosticsCase[];
}

export interface BinaryMetric {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
}

export interface GoldEvaluationReport {
  schemaVersion: 't2c.gold-report/v2';
  dataset: { schemaVersion: string; name: string; fingerprint: string };
  extraction: { overall: BinaryMetric; byChannel: Record<GoldExtractionChannel, BinaryMetric> };
  linking: BinaryMetric & {
    /** Same metric split by how the relation is justified. */
    byClass: Record<GoldRelationClass, BinaryMetric>;
    /** Forbidden pairs the linker created anyway. */
    forbiddenViolations: number;
    /** Relations documented as out of reach today; excluded from the metric above. */
    knownGaps: { cases: number; expected: number; satisfied: number };
    /** Multilingual positives and hard negatives, including documented gaps. */
    crossLanguage: {
      cases: number;
      expected: number;
      satisfied: number;
      forbidden: number;
      forbiddenViolations: number;
    };
    /** Optional, explicitly invoked reranker over the bounded cross-language cohort. */
    semanticReranking: {
      cases: number;
      expected: number;
      satisfied: number;
      forbidden: number;
      forbiddenViolations: number;
      accepted: number;
      abstained: number;
    };
  };
  dsl2todo: {
    citationCompleteness: { cited: number; required: number; rate: number };
    deduplication: BinaryMetric & { classifiedDuplicates: number; proposals: number; rate: number };
  };
  /** Diagnostic-code quality; zero-support when the dataset predates v2. */
  diagnostics: BinaryMetric & { forbiddenViolations: number; cases: number };
  stability: { repeatedRuns: 2; stable: boolean; rate: number; fingerprints: [string, string] };
}

export function assertGoldDataset(value: unknown): asserts value is GoldDataset {
  assertDatasetObject(value);
  const dataset = value as Partial<GoldDataset>;
  assertDatasetMetadata(dataset);
  assertDatasetCollections(dataset);
  assertUniqueCaseIds(dataset as GoldDataset);
  assertExtractionCoverage(dataset as GoldDataset);
  assertLinkingCohorts(dataset as GoldDataset);
}

function assertDatasetObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Gold dataset must be an object');
  }
}

function assertDatasetMetadata(dataset: Partial<GoldDataset>): void {
  if (!GOLD_DATASET_VERSIONS.includes(dataset.schemaVersion as GoldDatasetVersion)) {
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
  if (dataset.diagnostics !== undefined && !Array.isArray(dataset.diagnostics)) {
    throw new Error('Gold dataset diagnostics must be an array');
  }
  // v1 has no diagnostics scope at all; v2 declares one and must fill it,
  // otherwise the lifecycle claims it exists to measure silently vanish.
  if (dataset.schemaVersion === 't2c.gold-dataset/v2' && !dataset.diagnostics?.length) {
    throw new Error('Gold dataset v2 must cover diagnostics');
  }
}

function assertUniqueCaseIds(dataset: GoldDataset): void {
  const ids = [
    ...dataset.extraction,
    ...dataset.linking,
    ...dataset.dsl2todo,
    ...(dataset.diagnostics ?? []),
  ].map((fixture) => fixture.id);
  if (ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error('Gold case IDs must be non-blank and unique');
  }
}

function assertExtractionCoverage(dataset: GoldDataset): void {
  const channels = new Set(dataset.extraction.map((fixture) => fixture.channel));
  const required: GoldExtractionChannel[] = dataset.schemaVersion === 't2c.gold-dataset/v2'
    ? GOLD_EXTRACTION_CHANNELS
    : ['nl', 'documentation', 'markdown'];
  for (const channel of required) {
    if (!channels.has(channel)) {
      throw new Error(`Gold dataset is missing ${channel} extraction coverage`);
    }
  }
}

function assertLinkingCohorts(dataset: GoldDataset): void {
  for (const fixture of dataset.linking) {
    if (fixture.cohort !== undefined && fixture.cohort !== 'cross-language') {
      throw new Error(`Unsupported gold linking cohort: ${String(fixture.cohort)}`);
    }
    if (dataset.schemaVersion === 't2c.gold-dataset/v2'
      && fixture.cohort === 'cross-language'
      && !fixture.reranker) {
      throw new Error(`Cross-language gold case ${fixture.id} is missing a captured reranker fixture`);
    }
    if (fixture.reranker) {
      if (!fixture.reranker.model.trim() || !fixture.reranker.modelRevision.trim()) {
        throw new Error(`Gold reranker case ${fixture.id} has a blank model identity`);
      }
      if (!fixture.reranker.decisions.length || fixture.reranker.decisions.length > 10) {
        throw new Error(`Gold reranker case ${fixture.id} must contain 1-10 bounded decisions`);
      }
      const labels = new Set(fixture.records.map((record) => record.label));
      const modules = new Set<string>();
      for (const decision of fixture.reranker.decisions) {
        if (!labels.has(decision.module) || decision.module === 'declaration') {
          throw new Error(`Gold reranker case ${fixture.id} references unknown module ${decision.module}`);
        }
        if (modules.has(decision.module)) {
          throw new Error(`Gold reranker case ${fixture.id} repeats module ${decision.module}`);
        }
        modules.add(decision.module);
        if (!Number.isFinite(decision.score) || decision.score < -1 || decision.score > 1
          || !Number.isFinite(decision.confidence) || decision.confidence < 0 || decision.confidence > 1) {
          throw new Error(`Gold reranker case ${fixture.id} has an invalid score or confidence`);
        }
        if (!decision.rationale.trim() || !decision.declarationQuote.trim() || !decision.moduleQuote.trim()) {
          throw new Error(`Gold reranker case ${fixture.id} has blank grounded decision content`);
        }
      }
    }
  }
}
