import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  GOLD_DATASET_VERSIONS,
  GOLD_EXTRACTION_CHANNELS,
  evaluateGoldDataset,
  goldReportIsPerfect,
  loadGoldDataset,
  renderGoldReportMarkdown,
} from '../src/evaluation/gold.js';

const DATASET = path.resolve('evaluation/gold/v2/dataset.json');

test('versioned gold dataset reports perfect offline quality and repeated-run stability', async () => {
  const dataset = await loadGoldDataset(DATASET);
  const report = await evaluateGoldDataset(dataset);

  assert.equal(report.schemaVersion, 't2c.gold-report/v2');
  assert.equal(report.extraction.overall.precision, 1);
  assert.equal(report.extraction.overall.recall, 1);
  assert.equal(report.linking.precision, 1);
  assert.equal(report.linking.recall, 1);
  assert.equal(report.dsl2todo.citationCompleteness.rate, 1);
  assert.equal(report.dsl2todo.deduplication.precision, 1);
  assert.equal(report.dsl2todo.deduplication.recall, 1);
  assert.equal(report.dsl2todo.deduplication.rate, 0.5);
  assert.equal(report.stability.stable, true);
  assert.equal(report.stability.fingerprints[0], report.stability.fingerprints[1]);
  assert.equal(goldReportIsPerfect(report), true);
  assert.match(renderGoldReportMarkdown(report), /Repeated-run stability: \*\*PASS\*\*/);
});

test('gold linking reports exact-target and capability-topic quality separately', async () => {
  const dataset = await loadGoldDataset(DATASET);
  const report = await evaluateGoldDataset(dataset);

  // A blended number lets a capability-topic regression hide behind ticket
  // matching, which is the failure this split exists to expose.
  for (const relationClass of ['exact-target', 'capability-topic'] as const) {
    const value = report.linking.byClass[relationClass];
    assert.ok(value.truePositive > 0, `${relationClass} must be covered by the dataset`);
    assert.equal(value.precision, 1, `${relationClass} precision`);
    assert.equal(value.recall, 1, `${relationClass} recall`);
  }
  assert.equal(report.linking.forbiddenViolations, 0);
  assert.match(renderGoldReportMarkdown(report), /\| Linking: capability topic \|/);
});

test('gold capability-topic support is large enough to detect a floor regression', async () => {
  const dataset = await loadGoldDataset(DATASET);
  const report = await evaluateGoldDataset(dataset);
  const forbidden = dataset.linking.filter((item) => (item.forbidden ?? []).length > 0);

  // With a single positive and a single negative, moving the three-topic floor
  // could not be told apart from noise. The sample has to be able to lose
  // something measurable in both directions.
  assert.ok(
    report.linking.byClass['capability-topic'].truePositive >= 6,
    'capability-topic needs several positives',
  );
  assert.ok(forbidden.length >= 4, 'capability-topic needs several hard negatives');
  assert.equal(report.linking.forbiddenViolations, 0);
});

test('gold known gaps are measured and kept out of precision and recall', async () => {
  const dataset = await loadGoldDataset(DATASET);
  const report = await evaluateGoldDataset(dataset);

  // The Polish-prose-to-English-module case is a real miss. Scoring it as a
  // failure would make the offline gate permanently red; dropping it would
  // leave the barrier unmeasured, which is how it survived unquantified.
  assert.ok(report.linking.knownGaps.cases >= 1);
  assert.ok(report.linking.knownGaps.expected >= 1);
  assert.equal(report.linking.knownGaps.satisfied, 0);
  assert.equal(goldReportIsPerfect(report), true);
  assert.match(renderGoldReportMarkdown(report), /Known linking gaps: \*\*0\/\d+\*\*/);
});

test('gold reports cross-language positives and hard negatives as a separate cohort', async () => {
  const dataset = await loadGoldDataset(DATASET);
  const report = await evaluateGoldDataset(dataset);

  assert.ok(report.linking.crossLanguage.cases >= 6);
  assert.ok(report.linking.crossLanguage.expected >= 6);
  assert.ok(report.linking.crossLanguage.forbidden >= 6);
  assert.equal(report.linking.crossLanguage.satisfied, 0);
  assert.equal(report.linking.crossLanguage.forbiddenViolations, 0);
  assert.equal(
    report.linking.semanticReranking.satisfied,
    report.linking.semanticReranking.expected,
  );
  assert.ok(report.linking.semanticReranking.expected >= 6);
  assert.equal(report.linking.semanticReranking.forbiddenViolations, 0);
  assert.equal(report.linking.semanticReranking.abstained, 1);
  assert.match(renderGoldReportMarkdown(report), /Cross-language linking: \*\*0\/\d+\*\*/);
  assert.match(renderGoldReportMarkdown(report), /Cross-language reranking: \*\*6\/6\*\*/);
});

test('gold diagnostics separate a false DONE claim from an evidenced one', async () => {
  const dataset = await loadGoldDataset(DATASET);
  const report = await evaluateGoldDataset(dataset);
  const falseDone = dataset.diagnostics?.find((item) => item.id === 'diagnostics-false-done-without-evidence');
  const trueDone = dataset.diagnostics?.find((item) => item.id === 'diagnostics-true-done-with-evidence');

  assert.ok(falseDone?.expected.some((item) => item.code === 'PLANNED_NOT_IMPLEMENTED'));
  assert.ok(trueDone?.forbidden?.some((item) => item.code === 'PLANNED_NOT_IMPLEMENTED'));
  assert.equal(report.diagnostics.precision, 1);
  assert.equal(report.diagnostics.recall, 1);
  assert.equal(report.diagnostics.forbiddenViolations, 0);
  assert.ok(report.diagnostics.cases >= 5);
});

test('gold v1 stays evaluable after the v2 contract extension', async () => {
  const dataset = await loadGoldDataset(path.resolve('evaluation/gold/v1/dataset.json'));
  const report = await evaluateGoldDataset(dataset);

  assert.equal(dataset.schemaVersion, 't2c.gold-dataset/v1');
  assert.equal(dataset.diagnostics, undefined);
  // An absent scope must not silently pass as measured coverage either way.
  assert.equal(report.diagnostics.cases, 0);
  assert.equal(report.diagnostics.truePositive, 0);
  assert.equal(goldReportIsPerfect(report), true);
});

test('gold loader rejects unsupported dataset versions', async () => {
  await assert.rejects(
    () => evaluateGoldDataset({ schemaVersion: 't2c.gold-dataset/v3' } as never),
    /Unsupported gold dataset schemaVersion/,
  );
});

test('gold evaluator rejects unknown linking cohorts', async () => {
  const dataset = await loadGoldDataset(DATASET);
  const linking = dataset.linking.map((fixture, index) => (
    index === 0 ? { ...fixture, cohort: 'hidden-blended-score' as never } : fixture
  ));
  await assert.rejects(
    () => evaluateGoldDataset({ ...dataset, linking }),
    /Unsupported gold linking cohort/,
  );
});

test('gold v2 must declare diagnostics coverage', async () => {
  const dataset = await loadGoldDataset(DATASET);
  await assert.rejects(
    () => evaluateGoldDataset({ ...dataset, diagnostics: [] }),
    /must cover diagnostics/,
  );
});

test('published gold schema matches the runtime contract', async () => {
  const schema = JSON.parse(await fs.readFile(path.resolve('schemas/gold-dataset.schema.json'), 'utf8')) as {
    properties: { schemaVersion: { enum: string[] } };
    $defs: { extractionCase: { properties: { channel: { enum: string[] } } } };
  };

  // The schema is published documentation, so drift from the asserted contract
  // is invisible until someone writes a dataset against the wrong one.
  assert.deepEqual(schema.properties.schemaVersion.enum, GOLD_DATASET_VERSIONS);
  assert.deepEqual(schema.$defs.extractionCase.properties.channel.enum, GOLD_EXTRACTION_CHANNELS);
});

test('gold evaluator rejects fixture files outside its temporary workspace', async () => {
  const dataset = await loadGoldDataset(DATASET);
  const fixture = dataset.extraction.find((item) => item.channel === 'markdown');
  assert.ok(fixture?.files);
  fixture.files = { '../../outside.md': '# must not be written\n' };
  await assert.rejects(() => evaluateGoldDataset(dataset), /outside configured T2C_ROOT/);
});
