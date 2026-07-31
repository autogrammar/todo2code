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

function moduleFact(path: string): IntentRecord {
  return buildRecord({
    kind: 'module_fact',
    action: 'declare',
    object: `declare ${path}`,
    text: `declare ${path}`,
    target: { paths: [path], symbols: [], tickets: [], versions: [] },
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: path,
    sourceLines: { start: 1, end: 1 },
    extractor: 'test',
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['test'],
  });
}

function polishDeclaration(text: string, line: number): IntentRecord {
  return buildRecord({
    kind: 'documentation_statement',
    action: 'validate',
    object: text,
    text,
    modality: 'required',
    lifecycle: 'proposed',
    sourceKind: 'document',
    sourcePath: 'docs/architektura.md',
    sourceLines: { start: line, end: line },
    extractor: 'test',
    epistemicClass: 'declaration',
    confidence: 1,
    basis: ['test'],
  });
}

test('a targetless declaration is filed under the single module it links to', () => {
  // Polish prose naming no path used to be filed under the documentation file
  // it was written in, so a sentence the linker had already connected to code
  // still counted as "planned, no code".
  const graph = linkIntentRecords([
    polishDeclaration('Rejestr uczestników musi weryfikować tożsamość agenta przed zapisem', 3),
    moduleFact('src/communication/participant-identity-registry.ts'),
  ], '2026-07-29T00:00:00.000Z');
  const view = buildRealityView(graph, diagnoseGraph(graph), '2026-07-29T00:01:00.000Z');

  assert.equal(view.totals.topics, 1);
  assert.equal(view.totals.aligned, 1);
  assert.equal(view.rows[0]?.key, 'path:src/communication/participant-identity-registry.ts');
  assert.equal(view.rows[0]?.lanes.document, 1);
  assert.equal(view.rows[0]?.lanes.ast, 1);
});

test('a declaration touching several modules keeps its own topic', () => {
  // Picking a winner among equally linked modules would move the headline
  // metric on a guess; an ambiguous declaration stays where it was.
  const graph = linkIntentRecords([
    polishDeclaration('Walidacja kontraktu i walidacja konfiguracji muszą raportować błędy', 5),
    moduleFact('src/config/contract-validation.ts'),
    moduleFact('src/config/configuration-validation-report.ts'),
  ], '2026-07-29T00:00:00.000Z');
  const view = buildRealityView(graph, diagnoseGraph(graph), '2026-07-29T00:01:00.000Z');
  const declarationRow = view.rows.find((row) => (row.lanes.document ?? 0) > 0);

  assert.ok(declarationRow);
  assert.equal(declarationRow.key, 'path:docs/architektura.md');
  assert.equal(declarationRow.status, 'planned_not_implemented');
});

test('semantically aligned configuration topics retain their evidence grade', () => {
  const configured = buildRecord({
    kind: 'configuration_file_fact',
    action: 'configure',
    object: 'configure config/autonomy.json enabled',
    text: 'configure config/autonomy.json enabled',
    target: { paths: ['config/autonomy.json'], symbols: [], tickets: [], versions: [] },
    lifecycle: 'implemented',
    sourceKind: 'system',
    sourcePath: 'config/autonomy.json',
    sourceLines: { start: 1, end: 1 },
    extractor: 'test',
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['test'],
    metadata: { aggregate: 'configuration-file', capabilities: ['enabled'] },
  });
  const declaration = buildRecord({
    kind: 'documentation_statement',
    action: 'configure',
    object: 'enabled autonomy configuration',
    text: 'The autonomy configuration must declare `enabled` in `config/autonomy.json`',
    target: { paths: ['config/autonomy.json'], symbols: [], tickets: [], versions: [] },
    modality: 'required',
    lifecycle: 'proposed',
    sourceKind: 'document',
    sourcePath: 'docs/autonomy.md',
    sourceLines: { start: 3, end: 3 },
    extractor: 'test',
    epistemicClass: 'declaration',
    confidence: 1,
    basis: ['test'],
  });
  const graph = linkIntentRecords([configured, declaration], '2026-07-29T00:00:00.000Z');
  const view = buildRealityView(graph, diagnoseGraph(graph), '2026-07-29T00:01:00.000Z');
  const row = view.rows.find((item) => item.key === 'path:config/autonomy.json');

  // A behaviour whose implementation *is* configuration is implemented, so the
  // grade must not demote it — it only says the evidence is weaker than a
  // parsed symbol, which an undifferentiated `aligned` could not express.
  assert.equal(row?.status, 'aligned');
  assert.equal(row?.evidence, 'configuration');
  assert.equal(view.totals.aligned, 1);
  assert.deepEqual(view.totals.alignedByEvidence, { code: 0, configuration: 1, none: 0 });
  assert.match(renderRealityMarkdown(view), /Aligned evidence: 0 backed by code or commits, 1 by configuration alone/);
});
