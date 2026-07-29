import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { assertIntentGraphDiff } from '../src/core/schema.js';
import type { IntentRecord } from '../src/core/types.js';
import { buildRealityView, renderRealityMarkdown, renderRealitySvg } from '../src/diff/reality.js';
import { diffText, renderTextDiffHtml, renderTextDiffSvg, renderUnifiedDiff } from '../src/diff/text.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { diffIntentGraphs, renderGraphDiffSvg } from '../src/graph/diff.js';
import { linkIntentRecords } from '../src/graph/linker.js';

function record(object: string, line: number, path = 'src/runtime.ts'): IntentRecord {
  return buildRecord({
    kind: 'declared_intent',
    action: 'add',
    object,
    text: `Add ${object}`,
    lifecycle: 'proposed',
    sourceKind: 'nl',
    sourcePath: path,
    sourceLines: { start: line, end: line },
    extractor: 'test',
    epistemicClass: 'declaration',
    confidence: 1,
    basis: ['test'],
  });
}

test('graph diff detects changed source identities, additions and SVG-safe labels', () => {
  const before = linkIntentRecords([record('old contract', 4)], '2026-07-29T00:00:00.000Z');
  const after = linkIntentRecords([
    record('new contract', 4),
    record('<script>alert(1)</script>', 8),
  ], '2026-07-29T00:01:00.000Z');
  const diff = diffIntentGraphs(before, after, '2026-07-29T00:02:00.000Z');
  assert.doesNotThrow(() => assertIntentGraphDiff(diff));

  assert.equal(diff.schemaVersion, 't2c.diff/v1');
  assert.equal(diff.summary.recordsChanged, 1);
  assert.equal(diff.summary.recordsAdded, 1);
  assert.equal(diff.summary.recordsRemoved, 0);
  assert.ok(diff.records.changed[0]?.changedFields.includes('statement.object'));
  assert.equal(diff.fingerprint.length, 64);

  const svg = renderGraphDiffSvg(diff);
  assert.match(svg, /^<svg /);
  assert.match(svg, /Records \+/);
  assert.match(svg, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.ok(!svg.includes('<script>alert(1)</script>'));
});

test('graph diff is empty for graphs with identical evidence', () => {
  const before = linkIntentRecords([record('stable contract', 4)], '2026-07-29T00:00:00.000Z');
  const after = { ...before, generatedAt: '2026-07-29T01:00:00.000Z' };
  const diff = diffIntentGraphs(before, after);
  assert.deepEqual(diff.summary, {
    recordsAdded: 0,
    recordsRemoved: 0,
    recordsChanged: 0,
    recordsUnchanged: 1,
    relationsAdded: 0,
    relationsRemoved: 0,
    relationsUnchanged: 0,
  });
});

test('file diff emits deterministic unified, SVG and HTML views', () => {
  const diff = diffText('const value = 1;\nkeep();\n', 'const value = 2;\nkeep();\nnewLine();\n', {
    beforePath: 'before.ts',
    afterPath: 'after.ts',
  });

  assert.deepEqual(diff.summary, { added: 2, removed: 1, unchanged: 1 });
  assert.match(renderUnifiedDiff(diff), /-const value = 1;/);
  assert.match(renderUnifiedDiff(diff), /\+const value = 2;/);
  assert.match(renderTextDiffSvg([diff]), /^<svg /);
  assert.match(renderTextDiffHtml([diff]), /^<!doctype html>/);
});

test('intent-vs-reality builds an explainable SVG and Markdown projection', () => {
  const graph = linkIntentRecords([
    record('planned endpoint', 1, 'TASK.md'),
    buildRecord({
      kind: 'implemented_fact',
      action: 'add',
      object: 'existing handler',
      text: 'existing handler',
      lifecycle: 'implemented',
      sourceKind: 'ast',
      sourcePath: 'src/server.ts',
      sourceLines: { start: 5, end: 5 },
      extractor: 'test',
      epistemicClass: 'fact',
      confidence: 1,
      basis: ['test'],
    }),
  ], '2026-07-29T00:00:00.000Z');
  const view = buildRealityView(graph, diagnoseGraph(graph), '2026-07-29T00:01:00.000Z');

  assert.equal(view.schemaVersion, 't2c.reality/v1');
  assert.equal(view.totals.topics, 2);
  assert.equal(view.totals.gaps, 2);
  assert.match(renderRealitySvg(view), /^<svg /);
  assert.match(renderRealityMarkdown(view), /Intent vs Reality/);
});
