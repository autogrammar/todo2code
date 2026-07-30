import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  evaluateGoldDataset,
  goldReportIsPerfect,
  loadGoldDataset,
  renderGoldReportMarkdown,
} from '../src/evaluation/gold.js';

test('versioned gold dataset reports perfect offline quality and repeated-run stability', async () => {
  const dataset = await loadGoldDataset(path.resolve('evaluation/gold/v1/dataset.json'));
  const report = await evaluateGoldDataset(dataset);

  assert.equal(report.schemaVersion, 't2c.gold-report/v1');
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

test('gold loader rejects unsupported dataset versions', async () => {
  await assert.rejects(
    () => evaluateGoldDataset({ schemaVersion: 't2c.gold-dataset/v2' } as never),
    /Unsupported gold dataset schemaVersion/,
  );
});

test('gold evaluator rejects fixture files outside its temporary workspace', async () => {
  const dataset = await loadGoldDataset(path.resolve('evaluation/gold/v1/dataset.json'));
  const fixture = dataset.extraction.find((item) => item.channel === 'markdown');
  assert.ok(fixture?.files);
  fixture.files = { '../../outside.md': '# must not be written\n' };
  await assert.rejects(() => evaluateGoldDataset(dataset), /outside configured T2C_ROOT/);
});
