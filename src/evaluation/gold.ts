import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getConfig, type T2CConfig } from '../config/env.js';
import { createConclusionId, createTodoProposalId, sha256, stableStringify } from '../core/id.js';
import { buildRecord } from '../core/record.js';
import { assertPathWithinRoot } from '../core/security.js';
import type {
  Conclusion,
  GroundedGenerationMetadata,
  IntentAction,
  IntentRecord,
  LifecycleStatus,
  Modality,
  Polarity,
  SourceKind,
  TodoPriority,
  TodoProposal,
} from '../core/types.js';
import { extractDocumentationIntent } from '../extractors/docs-llm.js';
import { extractMarkdownIntent } from '../extractors/markdown.js';
import { extractNlIntent } from '../extractors/nl.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { linkIntentRecords } from '../graph/linker.js';
import { validateAndClassifyTodoProposals } from '../synthesis/validation.js';
import { T2C_VERSION } from '../version.js';

const FIXED_TIME = '2026-07-30T00:00:00.000Z';

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
}

export interface GoldLinkingCase {
  id: string;
  records: GoldFixtureRecord[];
  expected: Array<{ from: string; to: string; type: string }>;
}

interface GoldProposalFixture {
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
  extraction: {
    overall: BinaryMetric;
    byChannel: Record<GoldExtractionChannel, BinaryMetric>;
  };
  linking: BinaryMetric;
  dsl2todo: {
    citationCompleteness: { cited: number; required: number; rate: number };
    deduplication: BinaryMetric & { classifiedDuplicates: number; proposals: number; rate: number };
  };
  stability: { repeatedRuns: 2; stable: boolean; rate: number; fingerprints: [string, string] };
}

interface EvaluationCore {
  extraction: GoldEvaluationReport['extraction'];
  linking: BinaryMetric;
  dsl2todo: GoldEvaluationReport['dsl2todo'];
}

interface EvaluationRun {
  metrics: EvaluationCore;
  outputFingerprint: string;
}

export async function loadGoldDataset(filePath: string): Promise<GoldDataset> {
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
  assertGoldDataset(parsed);
  return parsed;
}

export async function evaluateGoldDataset(dataset: GoldDataset): Promise<GoldEvaluationReport> {
  assertGoldDataset(dataset);
  const first = await evaluateOnce(dataset);
  const second = await evaluateOnce(dataset);
  const fingerprints: [string, string] = [first.outputFingerprint, second.outputFingerprint];
  return {
    schemaVersion: 't2c.gold-report/v1',
    dataset: {
      schemaVersion: dataset.schemaVersion,
      name: dataset.name,
      fingerprint: sha256(stableStringify(dataset)),
    },
    ...first.metrics,
    stability: {
      repeatedRuns: 2,
      stable: fingerprints[0] === fingerprints[1],
      rate: fingerprints[0] === fingerprints[1] ? 1 : 0,
      fingerprints,
    },
  };
}

export function goldReportIsPerfect(report: GoldEvaluationReport): boolean {
  return report.extraction.overall.precision === 1
    && report.extraction.overall.recall === 1
    && report.linking.precision === 1
    && report.linking.recall === 1
    && report.dsl2todo.citationCompleteness.rate === 1
    && report.dsl2todo.deduplication.precision === 1
    && report.dsl2todo.deduplication.recall === 1
    && report.stability.stable;
}

export function renderGoldReportMarkdown(report: GoldEvaluationReport): string {
  const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
  const support = (metric: BinaryMetric): string => `${metric.truePositive} / ${metric.falsePositive} / ${metric.falseNegative}`;
  const rows = (['nl', 'documentation', 'markdown'] as const).map((channel) => {
    const metric = report.extraction.byChannel[channel];
    return `| Extraction: ${channel} | ${percent(metric.precision)} | ${percent(metric.recall)} | ${support(metric)} |`;
  });
  return [
    `# Gold evaluation: ${report.dataset.name}`,
    '',
    `Dataset: \`${report.dataset.schemaVersion}\` · \`${report.dataset.fingerprint.slice(0, 16)}\``,
    '',
    '| Scope | Precision | Recall | TP / FP / FN |',
    '|---|---:|---:|---:|',
    ...rows,
    `| Extraction: overall | ${percent(report.extraction.overall.precision)} | ${percent(report.extraction.overall.recall)} | ${support(report.extraction.overall)} |`,
    `| Linking | ${percent(report.linking.precision)} | ${percent(report.linking.recall)} | ${support(report.linking)} |`,
    `| DSL2TODO deduplication | ${percent(report.dsl2todo.deduplication.precision)} | ${percent(report.dsl2todo.deduplication.recall)} | ${support(report.dsl2todo.deduplication)} |`,
    '',
    `Citation completeness: **${percent(report.dsl2todo.citationCompleteness.rate)}** (${report.dsl2todo.citationCompleteness.cited}/${report.dsl2todo.citationCompleteness.required}).`,
    '',
    `Deduplication rate: **${percent(report.dsl2todo.deduplication.rate)}** (${report.dsl2todo.deduplication.classifiedDuplicates}/${report.dsl2todo.deduplication.proposals} proposals).`,
    '',
    `Repeated-run stability: **${report.stability.stable ? 'PASS' : 'FAIL'}** (${percent(report.stability.rate)}; ${report.stability.fingerprints[0].slice(0, 16)} / ${report.stability.fingerprints[1].slice(0, 16)}).`,
    '',
  ].join('\n');
}

async function evaluateOnce(dataset: GoldDataset): Promise<EvaluationRun> {
  const outputSnapshot: unknown[] = [];
  const byChannel: Record<GoldExtractionChannel, Counts> = {
    nl: emptyCounts(), documentation: emptyCounts(), markdown: emptyCounts(),
  };
  for (const fixture of dataset.extraction) {
    const actual = (await runExtractionCase(fixture)).map(projectRecord);
    outputSnapshot.push({ scope: 'extraction', caseId: fixture.id, actual });
    addCounts(byChannel[fixture.channel], compareSets(actual, fixture.expected));
  }
  const overall = emptyCounts();
  Object.values(byChannel).forEach((counts) => addCounts(overall, counts));

  const linking = emptyCounts();
  for (const fixture of dataset.linking) {
    const result = evaluateLinkingCase(fixture);
    outputSnapshot.push({ scope: 'linking', caseId: fixture.id, actual: result.actual });
    addCounts(linking, result.counts);
  }

  const todoCounts = emptyCounts();
  let citationRequired = 0;
  let citationCited = 0;
  let proposalCount = 0;
  let classifiedDuplicates = 0;
  for (const fixture of dataset.dsl2todo) {
    const result = evaluateDsl2TodoCase(fixture);
    outputSnapshot.push({ scope: 'dsl2todo', caseId: fixture.id, actual: result.snapshot });
    addCounts(todoCounts, result.duplicates);
    citationRequired += result.citationRequired;
    citationCited += result.citationCited;
    proposalCount += result.proposals;
    classifiedDuplicates += result.classifiedDuplicates;
  }

  return {
    metrics: {
      extraction: {
        overall: metric(overall),
        byChannel: {
          nl: metric(byChannel.nl),
          documentation: metric(byChannel.documentation),
          markdown: metric(byChannel.markdown),
        },
      },
      linking: metric(linking),
      dsl2todo: {
        citationCompleteness: {
          cited: citationCited,
          required: citationRequired,
          rate: ratio(citationCited, citationRequired),
        },
        deduplication: {
          ...metric(todoCounts),
          classifiedDuplicates,
          proposals: proposalCount,
          rate: ratio(classifiedDuplicates, proposalCount),
        },
      },
    },
    outputFingerprint: sha256(stableStringify(outputSnapshot)),
  };
}

async function runExtractionCase(fixture: GoldExtractionCase): Promise<IntentRecord[]> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `t2c-gold-${fixture.channel}-`));
  try {
    for (const [relative, content] of Object.entries(fixture.files ?? {})) {
      const destination = await assertPathWithinRoot(root, path.resolve(root, relative));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, content, 'utf8');
    }
    const config = benchmarkConfig(root);
    if (fixture.channel === 'nl') {
      return (await extractNlIntent({
        root,
        sourcePath: fixture.sourcePath ?? 'TASK.md',
        text: fixture.text ?? '',
      }, config)).records;
    }
    if (fixture.channel === 'markdown') {
      return (await extractMarkdownIntent({
        root,
        todoPath: fixture.todoPath ?? null,
        changelogPath: fixture.changelogPath ?? null,
      }, config)).records;
    }
    if (!fixture.documentResponse) throw new Error(`Gold case ${fixture.id} requires documentResponse`);
    config.openRouter.apiKey = 'offline-gold-fixture';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      id: `gold-${fixture.id}`,
      model: 'gold/document-snapshot',
      provider: 'offline-fixture',
      choices: [{ message: { content: JSON.stringify(fixture.documentResponse) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    try {
      return (await extractDocumentationIntent({
        root,
        patterns: Object.keys(fixture.files ?? {}),
        excludes: [],
      }, config)).records;
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function benchmarkConfig(root: string): T2CConfig {
  const config = getConfig(root);
  config.root = root;
  config.maxFileBytes = 1_048_576;
  config.documentConcurrency = 1;
  config.documentChunkChars = 100_000;
  config.documentMaxChunks = 20;
  config.documentRecordsPerChunk = 50;
  config.documentTimeoutMs = 5000;
  config.enableTensorFlow = false;
  config.openRouter.apiKey = null;
  config.openRouter.model = 'gold/document-snapshot';
  config.openRouter.documentModel = 'gold/document-snapshot';
  config.openRouter.responseHealing = false;
  return config;
}

function projectRecord(record: IntentRecord): GoldRecordProjection {
  return {
    sourceKind: record.source.kind,
    action: record.statement.action,
    text: record.statement.text,
    lifecycle: record.lifecycle.status,
    modality: record.statement.modality,
    polarity: record.statement.polarity,
    paths: record.statement.target.paths,
    symbols: record.statement.target.symbols,
    tickets: record.statement.target.tickets,
    versions: record.statement.target.versions,
    lines: record.source.lines,
  };
}

function evaluateLinkingCase(fixture: GoldLinkingCase): { counts: Counts; actual: unknown[] } {
  const { records, labels } = buildFixtureRecords(fixture.id, fixture.records);
  const idToLabel = new Map([...labels].map(([label, id]) => [id, label]));
  const graph = linkIntentRecords(records, FIXED_TIME);
  const actual = graph.relations.map((relation) => ({
    from: idToLabel.get(relation.from) ?? relation.from,
    to: idToLabel.get(relation.to) ?? relation.to,
    type: relation.type,
  }));
  return { counts: compareSets(actual, fixture.expected), actual };
}

function evaluateDsl2TodoCase(fixture: GoldDsl2TodoCase): {
  duplicates: Counts;
  citationRequired: number;
  citationCited: number;
  proposals: number;
  classifiedDuplicates: number;
  snapshot: unknown;
} {
  const { records, labels } = buildFixtureRecords(fixture.id, fixture.records);
  const graph = linkIntentRecords(records, FIXED_TIME);
  const diagnostics = diagnoseGraph(graph, FIXED_TIME);
  const diagnosticIds = diagnostics.diagnostics.map((item) => item.id);
  if (!diagnosticIds.length) throw new Error(`Gold DSL2TODO case ${fixture.id} produced no diagnostics`);
  const conclusionContent: Omit<Conclusion, 'id'> = {
    schemaVersion: 't2c.conclusion/v1',
    kind: 'finding',
    title: `Gold finding: ${fixture.id}`,
    detail: 'Versioned gold evidence requires a reviewed TODO proposal.',
    severity: diagnostics.diagnostics[0]?.severity ?? 'warning',
    diagnosticIds,
    recordIds: records.map((record) => record.id),
    confidence: 1,
    generation: deterministicGeneration(),
  };
  const conclusion: Conclusion = { ...conclusionContent, id: createConclusionId(conclusionContent) };
  const proposals = fixture.proposals.map((raw) => {
    const recordIds = raw.requiredRecordLabels.map((label) => {
      const id = labels.get(label);
      if (!id) throw new Error(`Gold proposal ${raw.label} references unknown record label ${label}`);
      return id;
    });
    const content: Omit<TodoProposal, 'id'> = {
      schemaVersion: 't2c.todo-proposal/v1',
      title: raw.title,
      description: raw.description,
      priority: raw.priority,
      status: 'proposed',
      target: raw.target,
      acceptanceCriteria: raw.acceptanceCriteria,
      dependencies: [],
      conclusionIds: [conclusion.id],
      diagnosticIds,
      recordIds,
      confidence: 1,
      generation: deterministicGeneration(),
    };
    return { fixture: raw, proposal: { ...content, id: createTodoProposalId(content) } };
  });
  const validation = validateAndClassifyTodoProposals(
    proposals.map(({ proposal }) => proposal),
    { graph, diagnostics, conclusions: [conclusion] },
  );
  const duplicateIds = new Set(validation.duplicateProposalIds);
  const actual = proposals.filter(({ proposal }) => duplicateIds.has(proposal.id)).map(({ fixture }) => fixture.label);
  const expected = proposals.filter(({ fixture }) => fixture.expectedDuplicate).map(({ fixture }) => fixture.label);
  let citationRequired = records.length + diagnosticIds.length;
  let citationCited = conclusion.recordIds.filter((id) => graph.records.some((record) => record.id === id)).length
    + conclusion.diagnosticIds.filter((id) => diagnosticIds.includes(id)).length;
  for (const { fixture: raw, proposal } of proposals) {
    citationRequired += raw.requiredRecordLabels.length + diagnosticIds.length + 1;
    citationCited += proposal.recordIds.filter((id) => raw.requiredRecordLabels.some((label) => labels.get(label) === id)).length;
    citationCited += proposal.diagnosticIds.filter((id) => diagnosticIds.includes(id)).length;
    citationCited += proposal.conclusionIds.includes(conclusion.id) ? 1 : 0;
  }
  return {
    duplicates: compareSets(actual, expected),
    citationRequired,
    citationCited,
    proposals: proposals.length,
    classifiedDuplicates: validation.duplicateProposalIds.length,
    snapshot: {
      conclusion,
      proposals: proposals.map(({ fixture: raw, proposal }) => ({ label: raw.label, proposal })),
      duplicateLabels: actual,
    },
  };
}

function buildFixtureRecords(caseId: string, fixtures: GoldFixtureRecord[]): {
  records: IntentRecord[];
  labels: Map<string, string>;
} {
  const labels = new Map<string, string>();
  const records = fixtures.map((fixture, index) => {
    const record = buildRecord({
      kind: 'gold_fixture',
      action: fixture.action,
      object: fixture.text,
      text: fixture.text,
      ...(fixture.target ? { target: fixture.target } : {}),
      polarity: fixture.polarity ?? 'positive',
      modality: fixture.sourceKind === 'todo' ? 'required' : 'observed',
      lifecycle: fixture.lifecycle,
      sourceKind: fixture.sourceKind,
      sourcePath: `evaluation/${caseId}/${fixture.label}-${index + 1}.md`,
      sourceLines: { start: 1, end: 1 },
      extractor: 't2c/gold-fixture@1',
      epistemicClass: fixture.sourceKind === 'todo' ? 'plan' : fixture.sourceKind === 'git' ? 'fact' : 'declaration',
      confidence: 1,
      basis: ['versioned_gold_fixture'],
    });
    if (labels.has(fixture.label)) throw new Error(`Duplicate gold fixture label: ${fixture.label}`);
    labels.set(fixture.label, record.id);
    return record;
  });
  return { records, labels };
}

function deterministicGeneration(): GroundedGenerationMetadata {
  return {
    runtimeVersion: T2C_VERSION,
    generatedAt: FIXED_TIME,
    requestedMode: 'deterministic',
    effectiveMode: 'deterministic',
    degraded: false,
    model: null,
    provider: null,
    responseId: null,
    configurationFingerprint: sha256('t2c-gold-evaluation/v1'),
    reason: null,
  };
}

interface Counts { truePositive: number; falsePositive: number; falseNegative: number }

function emptyCounts(): Counts {
  return { truePositive: 0, falsePositive: 0, falseNegative: 0 };
}

function addCounts(target: Counts, value: Counts): void {
  target.truePositive += value.truePositive;
  target.falsePositive += value.falsePositive;
  target.falseNegative += value.falseNegative;
}

function compareSets(actual: unknown[], expected: unknown[]): Counts {
  const actualCounts = frequency(actual.map(stableStringify));
  const expectedCounts = frequency(expected.map(stableStringify));
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  for (const key of new Set([...actualCounts.keys(), ...expectedCounts.keys()])) {
    const actualCount = actualCounts.get(key) ?? 0;
    const expectedCount = expectedCounts.get(key) ?? 0;
    truePositive += Math.min(actualCount, expectedCount);
    falsePositive += Math.max(0, actualCount - expectedCount);
    falseNegative += Math.max(0, expectedCount - actualCount);
  }
  return { truePositive, falsePositive, falseNegative };
}

function frequency(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

function metric(counts: Counts): BinaryMetric {
  return {
    ...counts,
    precision: ratio(counts.truePositive, counts.truePositive + counts.falsePositive),
    recall: ratio(counts.truePositive, counts.truePositive + counts.falseNegative),
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Math.round((numerator / denominator) * 1_000_000) / 1_000_000;
}

function assertGoldDataset(value: unknown): asserts value is GoldDataset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Gold dataset must be an object');
  const dataset = value as Partial<GoldDataset>;
  if (dataset.schemaVersion !== 't2c.gold-dataset/v1') throw new Error('Unsupported gold dataset schemaVersion');
  if (typeof dataset.name !== 'string' || !dataset.name.trim()) throw new Error('Gold dataset name must be non-blank');
  if (typeof dataset.description !== 'string' || !dataset.description.trim()) throw new Error('Gold dataset description must be non-blank');
  if (!Array.isArray(dataset.extraction) || !Array.isArray(dataset.linking) || !Array.isArray(dataset.dsl2todo)) {
    throw new Error('Gold dataset extraction, linking and dsl2todo must be arrays');
  }
  if (!dataset.extraction.length || !dataset.linking.length || !dataset.dsl2todo.length) {
    throw new Error('Gold dataset must cover extraction, linking and DSL2TODO');
  }
  const ids = [...dataset.extraction, ...dataset.linking, ...dataset.dsl2todo].map((fixture) => fixture.id);
  if (ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error('Gold case IDs must be non-blank and unique');
  }
  const channels = new Set(dataset.extraction.map((fixture) => fixture.channel));
  for (const required of ['nl', 'documentation', 'markdown']) {
    if (!channels.has(required as GoldExtractionChannel)) throw new Error(`Gold dataset is missing ${required} extraction coverage`);
  }
}
