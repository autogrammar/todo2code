// Engine-level tests for the diff primitives. `diff.test.ts` covers the
// end-to-end projections; this file pins the Myers implementation, the hunk
// builder and the reality status rules against regressions.

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import type { IntentRecord } from '../src/core/types.js';
import { buildRealityView, renderRealityMarkdown, renderRealitySvg } from '../src/diff/reality.js';
import {
  diffText,
  renderTextDiffHtml,
  renderTextDiffSvg,
  renderUnifiedDiff,
  splitLines,
  toSideBySideRows,
} from '../src/diff/text.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';

const AT = '2026-07-29T00:00:00.000Z';

test('splitLines treats a trailing newline as a terminator, not an extra line', () => {
  assert.deepEqual(splitLines('a\nb\n'), ['a', 'b']);
  assert.deepEqual(splitLines('a\nb'), ['a', 'b']);
  assert.deepEqual(splitLines('a\r\nb\r\n'), ['a', 'b']);
});

test('Identical inputs produce no hunks', () => {
  const diff = diffText('one\ntwo\nthree\n', 'one\ntwo\nthree\n');
  assert.equal(diff.hunks.length, 0);
  assert.deepEqual(diff.summary, { added: 0, removed: 0, unchanged: 3 });
});

test('A modified line keeps both sides addressable by original line number', () => {
  const diff = diffText('a\nb\nc\n', 'a\nB\nc\n');
  const changed = diff.hunks.flatMap((hunk) => hunk.lines).filter((line) => line.type !== 'equal');
  assert.deepEqual(changed.map((line) => line.text), ['b', 'B']);
  assert.equal(changed[0]?.beforeLine, 2);
  assert.equal(changed[0]?.afterLine, null);
  assert.equal(changed[1]?.beforeLine, null);
  assert.equal(changed[1]?.afterLine, 2);
});

test('Pure insertion and pure deletion are not reported as replacements', () => {
  const inserted = diffText('a\nc\n', 'a\nb\nc\n');
  assert.deepEqual(inserted.summary, { added: 1, removed: 0, unchanged: 2 });

  const deleted = diffText('a\nb\nc\n', 'a\nc\n');
  assert.deepEqual(deleted.summary, { added: 0, removed: 1, unchanged: 2 });
  const removed = deleted.hunks.flatMap((hunk) => hunk.lines).find((line) => line.type === 'delete');
  assert.equal(removed?.text, 'b');
  assert.equal(removed?.beforeLine, 2);
});

test('Empty-to-content and content-to-empty are handled as block changes', () => {
  assert.equal(diffText('', 'x\ny\n').summary.added, 2);
  assert.equal(diffText('x\ny\n', '').summary.removed, 2);
});

test('Context width controls hunk size', () => {
  const before = Array.from({ length: 30 }, (_, index) => `line ${index + 1}`).join('\n');
  const after = before.split('\n').map((line, index) => (index === 14 ? 'changed' : line)).join('\n');

  const tight = diffText(before, after, { context: 1 });
  assert.equal(tight.hunks.length, 1);
  assert.equal(tight.hunks[0]?.lines.length, 4); // context + delete + insert + context
  assert.equal(diffText(before, after, { context: 5 }).hunks[0]?.lines.length, 12);
});

test('Nearby changes merge into a single hunk', () => {
  const before = Array.from({ length: 20 }, (_, index) => `l${index}`).join('\n');
  const after = before
    .split('\n')
    .map((line, index) => (index === 5 || index === 8 ? `${line}!` : line))
    .join('\n');
  assert.equal(diffText(before, after, { context: 3 }).hunks.length, 1);
});

test('Distant changes stay in separate hunks', () => {
  const before = Array.from({ length: 40 }, (_, index) => `l${index}`).join('\n');
  const after = before
    .split('\n')
    .map((line, index) => (index === 2 || index === 30 ? `${line}!` : line))
    .join('\n');
  assert.equal(diffText(before, after, { context: 2 }).hunks.length, 2);
});

test('Oversized inputs fall back to a bounded block replace', () => {
  const before = Array.from({ length: 200 }, (_, index) => `a${index}`).join('\n');
  const after = Array.from({ length: 200 }, (_, index) => `b${index}`).join('\n');
  const diff = diffText(before, after, { maxCompareLines: 64 });
  assert.equal(diff.truncated, true);
  assert.equal(diff.summary.added, 200);
  assert.equal(diff.summary.removed, 200);
});

test('Unified output carries a well formed hunk header', () => {
  const patch = renderUnifiedDiff(diffText('a\nb\n', 'a\nc\n', { beforePath: 'old.txt', afterPath: 'new.txt' }));
  assert.match(patch, /^--- a\/old\.txt\n\+\+\+ b\/new\.txt\n/);
  assert.match(patch, /^@@ -\d+,\d+ \+\d+,\d+ @@$/m);
});

test('Side-by-side rows pair deletions with insertions', () => {
  const rows = diffText('a\nb\nc\n', 'a\nB\nC\n').hunks.flatMap(toSideBySideRows);
  const paired = rows.filter((row) => row.left?.type === 'delete' && row.right?.type === 'insert');
  assert.deepEqual(paired.map((row) => [row.left?.text, row.right?.text]), [['b', 'B'], ['c', 'C']]);
});

test('Unbalanced change runs leave one side empty rather than misaligning', () => {
  const rows = diffText('a\nb\n', 'X\nY\nZ\n').hunks.flatMap(toSideBySideRows);
  assert.ok(rows.some((row) => row.left === null && row.right?.type === 'insert'));
});

test('Renderers escape source markup', () => {
  const diff = diffText('const a = "<b>";\n', 'const a = "<i>&</i>";\n', { path: 'x.ts' });

  const svg = renderTextDiffSvg([diff], { title: 'Diff <check> & "quote"' });
  assert.ok(svg.trimEnd().endsWith('</svg>'));
  assert.ok(svg.includes('Diff &lt;check&gt; &amp; &quot;quote&quot;'));
  assert.ok(!svg.includes('"<i>'));

  const html = renderTextDiffHtml([diff]);
  assert.ok(!html.includes('<i>&</i>'));
  assert.ok(html.includes('&lt;i&gt;'));
});

test('SVG rendering caps rows and reports the remainder', () => {
  const before = Array.from({ length: 60 }, (_, index) => `a${index}`).join('\n');
  const after = Array.from({ length: 60 }, (_, index) => `b${index}`).join('\n');
  const svg = renderTextDiffSvg([diffText(before, after, { path: 'big.txt' })], { maxRows: 10 });
  assert.match(svg, /more rows not rendered/);
});

// -- Intent vs reality ------------------------------------------------------

function planRecord(path: string, object: string): IntentRecord {
  return buildRecord({
    kind: 'todo_item', action: 'add', object, target: { paths: [path], symbols: [object] },
    text: `Dodać ${object}`, lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md',
    sourceLines: { start: 1, end: 1 }, extractor: 'test', epistemicClass: 'plan', confidence: 0.9, basis: ['fixture'],
  });
}

function factRecord(path: string, object: string): IntentRecord {
  return buildRecord({
    kind: 'symbol_fact', action: 'declare', object, target: { paths: [path], symbols: [object] },
    text: `declare ${object}`, lifecycle: 'implemented', sourceKind: 'ast', sourcePath: path,
    sourceLines: { start: 2, end: 4 }, symbol: object, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'], metadata: { language: 'typescript', exported: true },
  });
}

function viewOf(records: IntentRecord[]) {
  const graph = linkIntentRecords(records, AT);
  return buildRealityView(graph, diagnoseGraph(graph, AT), AT);
}

test('Reality view keys topics by target and records lane presence', () => {
  const view = viewOf([planRecord('src/only-planned.ts', 'plannedOnly'), factRecord('src/only-code.ts', 'codeOnly')]);
  assert.equal(view.totals.declaredRecords, 1);
  assert.equal(view.totals.observedRecords, 1);

  const planned = view.rows.find((row) => row.key === 'path:src/only-planned.ts');
  assert.equal(planned?.status, 'planned_not_implemented');
  assert.equal(planned?.lanes.ast, 0);

  const code = view.rows.find((row) => row.key === 'path:src/only-code.ts');
  assert.equal(code?.status, 'implemented_not_planned');
  assert.equal(code?.lanes.ast, 1);
});

test('A topic holding declared and observed records is never reported as planned-only', () => {
  // Regression guard: status follows lane presence. Deriving it from a single
  // member's diagnostic mislabelled well-covered topics as "planned, no code".
  const view = viewOf([planRecord('src/shared.ts', 'sharedSymbol'), factRecord('src/shared.ts', 'sharedSymbol')]);
  const row = view.rows.find((item) => item.key === 'path:src/shared.ts');
  assert.ok(row, 'expected a topic for src/shared.ts');
  assert.equal(row?.lanes.todo, 1);
  assert.equal(row?.lanes.ast, 1);
  assert.equal(view.totals.implementationCoverage, 1);
  assert.equal(view.totals.plannedCodeCoverage, 1);
  assert.equal(view.totals.documentedCodeCoverage, 0);
  assert.equal(view.totals.documentationMeasured, false);
  assert.match(renderRealityMarkdown(view), /documented code: not measured/);
  assert.equal(row?.status, 'aligned');
  assert.ok(row?.diagnosticCodes.includes('IMPLEMENTED_NOT_DOCUMENTED'));
});

test('Reality coverage stays open when a shared path has unrelated capabilities', () => {
  const plan = buildRecord({
    kind: 'todo_item', action: 'add', object: 'bounded exponential retry backoff',
    target: { paths: ['src/retry.py'] },
    text: 'Implement bounded exponential retry backoff in `src/retry.py`.',
    lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md',
    sourceLines: { start: 1, end: 1 }, extractor: 'test', epistemicClass: 'plan',
    confidence: 1, basis: ['fixture'],
  });
  const unrelatedModule = buildRecord({
    kind: 'module_fact', action: 'declare', object: 'src/retry.py',
    target: { paths: ['src/retry.py'] }, text: 'module src/retry.py capabilities enqueue',
    lifecycle: 'implemented', sourceKind: 'ast', sourcePath: 'src/retry.py',
    sourceLines: { start: 1, end: 10 }, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'], metadata: { aggregate: 'module', capabilities: ['enqueue'] },
  });

  const view = viewOf([plan, unrelatedModule]);
  const row = view.rows.find((item) => item.key === 'path:src/retry.py');
  assert.equal(row?.status, 'planned_not_implemented');
  assert.equal(view.totals.implementationAlignedTopics, 0);
  assert.equal(view.totals.implementationCoverage, 0);
});

test('Shared-path relations do not collapse unrelated files into one topic', () => {
  // The linker links every AST symbol in a file via `shared_path`; grouping by
  // connected components collapsed whole repositories into a single row.
  const view = viewOf([
    factRecord('src/a.ts', 'alpha'),
    factRecord('src/a.ts', 'alphaTwo'),
    factRecord('src/b.ts', 'beta'),
    factRecord('src/c.ts', 'gamma'),
  ]);
  const keys = view.rows.map((row) => row.key).sort();
  assert.deepEqual(keys, ['path:src/a.ts', 'path:src/b.ts', 'path:src/c.ts']);
  assert.equal(view.rows.find((row) => row.key === 'path:src/a.ts')?.lanes.ast, 2);
});

test('Reality view is deterministic for identical input', () => {
  const records = [planRecord('src/a.ts', 'alpha'), factRecord('src/b.ts', 'beta')];
  const first = viewOf(records);
  const second = viewOf(records);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.rows, second.rows);
});

test('Reality SVG escapes topic labels', () => {
  const view = viewOf([planRecord('src/<x>.ts', 'a & b')]);
  const svg = renderRealitySvg(view);
  assert.ok(svg.trimEnd().endsWith('</svg>'));
  assert.ok(!svg.includes('src/<x>.ts'));
  assert.ok(svg.includes('&lt;x&gt;'));
});
