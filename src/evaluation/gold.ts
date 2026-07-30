import { promises as fs } from 'node:fs';
import { sha256, stableStringify } from '../core/id.js';
import { evaluateDsl2TodoCase, evaluateLinkingCase } from './gold-cases.js';
import { projectRecord, runExtractionCase } from './gold-extraction.js';
import {
  addCounts,
  compareSets,
  emptyCounts,
  metric,
  ratio,
  type Counts,
} from './gold-metrics.js';
import {
  assertGoldDataset,
  GOLD_RELATION_CLASSES,
  type BinaryMetric,
  type GoldDataset,
  type GoldDsl2TodoCase,
  type GoldEvaluationReport,
  type GoldExtractionCase,
  type GoldExtractionChannel,
  type GoldLinkingCase,
} from './gold-types.js';

export {
  GOLD_FIXED_TIME,
  GOLD_RELATION_CLASSES,
  assertGoldDataset,
} from './gold-types.js';
export type {
  BinaryMetric,
  GoldDataset,
  GoldDsl2TodoCase,
  GoldEvaluationReport,
  GoldExpectedRelation,
  GoldExtractionCase,
  GoldExtractionChannel,
  GoldFixtureRecord,
  GoldLinkingCase,
  GoldProposalFixture,
  GoldRecordProjection,
  GoldRelationClass,
} from './gold-types.js';

interface EvaluationCore {
  extraction: GoldEvaluationReport['extraction'];
  linking: GoldEvaluationReport['linking'];
  dsl2todo: GoldEvaluationReport['dsl2todo'];
}

interface EvaluationRun {
  metrics: EvaluationCore;
  outputFingerprint: string;
}

interface EvaluationResult<T> {
  metric: T;
  snapshots: unknown[];
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
  const stable = fingerprints[0] === fingerprints[1];
  return {
    schemaVersion: 't2c.gold-report/v1',
    dataset: {
      schemaVersion: dataset.schemaVersion,
      name: dataset.name,
      fingerprint: sha256(stableStringify(dataset)),
    },
    ...first.metrics,
    stability: { repeatedRuns: 2, stable, rate: stable ? 1 : 0, fingerprints },
  };
}

export function goldReportIsPerfect(report: GoldEvaluationReport): boolean {
  return report.extraction.overall.precision === 1
    && report.extraction.overall.recall === 1
    && report.linking.precision === 1
    && report.linking.recall === 1
    && report.linking.forbiddenViolations === 0
    && report.dsl2todo.citationCompleteness.rate === 1
    && report.dsl2todo.deduplication.precision === 1
    && report.dsl2todo.deduplication.recall === 1
    && report.stability.stable;
}

export function renderGoldReportMarkdown(report: GoldEvaluationReport): string {
  const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
  const support = (value: BinaryMetric): string => (
    `${value.truePositive} / ${value.falsePositive} / ${value.falseNegative}`
  );
  const rows = (['nl', 'documentation', 'markdown'] as const).map((channel) => {
    const value = report.extraction.byChannel[channel];
    return `| Extraction: ${channel} | ${percent(value.precision)} | ${percent(value.recall)} | ${support(value)} |`;
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
    `| Linking: overall | ${percent(report.linking.precision)} | ${percent(report.linking.recall)} | ${support(report.linking)} |`,
    `| Linking: exact target | ${percent(report.linking.byClass['exact-target'].precision)} | ${percent(report.linking.byClass['exact-target'].recall)} | ${support(report.linking.byClass['exact-target'])} |`,
    `| Linking: capability topic | ${percent(report.linking.byClass['capability-topic'].precision)} | ${percent(report.linking.byClass['capability-topic'].recall)} | ${support(report.linking.byClass['capability-topic'])} |`,
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
  const extraction = await evaluateExtraction(dataset.extraction);
  const linking = evaluateLinking(dataset.linking);
  const dsl2todo = evaluateDsl2Todo(dataset.dsl2todo);
  const outputSnapshot = [...extraction.snapshots, ...linking.snapshots, ...dsl2todo.snapshots];
  return {
    metrics: {
      extraction: extraction.metric,
      linking: linking.metric,
      dsl2todo: dsl2todo.metric,
    },
    outputFingerprint: sha256(stableStringify(outputSnapshot)),
  };
}

async function evaluateExtraction(
  fixtures: GoldExtractionCase[],
): Promise<EvaluationResult<GoldEvaluationReport['extraction']>> {
  const byChannel: Record<GoldExtractionChannel, Counts> = {
    nl: emptyCounts(),
    documentation: emptyCounts(),
    markdown: emptyCounts(),
  };
  const snapshots: unknown[] = [];
  for (const fixture of fixtures) {
    const actual = (await runExtractionCase(fixture)).map(projectRecord);
    snapshots.push({ scope: 'extraction', caseId: fixture.id, actual });
    addCounts(byChannel[fixture.channel], compareSets(actual, fixture.expected));
  }
  const overall = emptyCounts();
  Object.values(byChannel).forEach((counts) => addCounts(overall, counts));
  return {
    metric: {
      overall: metric(overall),
      byChannel: {
        nl: metric(byChannel.nl),
        documentation: metric(byChannel.documentation),
        markdown: metric(byChannel.markdown),
      },
    },
    snapshots,
  };
}

function evaluateLinking(fixtures: GoldLinkingCase[]): EvaluationResult<GoldEvaluationReport['linking']> {
  const counts = emptyCounts();
  const byClass = Object.fromEntries(GOLD_RELATION_CLASSES.map((name) => [name, emptyCounts()]));
  let forbiddenViolations = 0;
  const snapshots = fixtures.map((fixture) => {
    const result = evaluateLinkingCase(fixture);
    addCounts(counts, result.counts);
    for (const name of GOLD_RELATION_CLASSES) addCounts(byClass[name]!, result.byClass[name]);
    forbiddenViolations += result.forbiddenViolations;
    return { scope: 'linking', caseId: fixture.id, actual: result.actual };
  });
  return {
    metric: {
      ...metric(counts),
      byClass: {
        'exact-target': metric(byClass['exact-target']!),
        'capability-topic': metric(byClass['capability-topic']!),
      },
      forbiddenViolations,
    },
    snapshots,
  };
}

function evaluateDsl2Todo(
  fixtures: GoldDsl2TodoCase[],
): EvaluationResult<GoldEvaluationReport['dsl2todo']> {
  const duplicateCounts = emptyCounts();
  const totals = { citationRequired: 0, citationCited: 0, proposals: 0, classifiedDuplicates: 0 };
  const snapshots = fixtures.map((fixture) => {
    const result = evaluateDsl2TodoCase(fixture);
    addCounts(duplicateCounts, result.duplicates);
    totals.citationRequired += result.citationRequired;
    totals.citationCited += result.citationCited;
    totals.proposals += result.proposals;
    totals.classifiedDuplicates += result.classifiedDuplicates;
    return { scope: 'dsl2todo', caseId: fixture.id, actual: result.snapshot };
  });
  return {
    metric: {
      citationCompleteness: {
        cited: totals.citationCited,
        required: totals.citationRequired,
        rate: ratio(totals.citationCited, totals.citationRequired),
      },
      deduplication: {
        ...metric(duplicateCounts),
        classifiedDuplicates: totals.classifiedDuplicates,
        proposals: totals.proposals,
        rate: ratio(totals.classifiedDuplicates, totals.proposals),
      },
    },
    snapshots,
  };
}
