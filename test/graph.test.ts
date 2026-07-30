import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';

test('Linker connects plan, Git claim and AST fact', () => {
  const plan = buildRecord({
    kind: 'todo_item', action: 'validate', object: 'validateContract', target: { paths: ['src/runtime.ts'], symbols: ['validateContract'], tickets: ['T2C-14'] },
    text: 'Dodać validateContract', lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md', sourceLines: { start: 1, end: 1 }, extractor: 'test', epistemicClass: 'plan', confidence: 1, basis: ['fixture'],
  });
  const claim = buildRecord({
    kind: 'commit_intent_claim', action: 'validate', object: 'validateContract', target: { paths: ['src/runtime.ts'], symbols: ['validateContract'], tickets: ['T2C-14'] },
    text: 'feat: add validateContract T2C-14', lifecycle: 'implemented', sourceKind: 'git', revision: 'a'.repeat(40), extractor: 'test', epistemicClass: 'claim', confidence: 0.9, basis: ['fixture'],
  });
  const fact = buildRecord({
    kind: 'symbol_fact', action: 'declare', object: 'validateContract', target: { paths: ['src/runtime.ts'], symbols: ['validateContract'] },
    text: 'declare validateContract', lifecycle: 'implemented', sourceKind: 'ast', sourcePath: 'src/runtime.ts', sourceLines: { start: 2, end: 4 }, symbol: 'validateContract', extractor: 'test', epistemicClass: 'fact', confidence: 1, basis: ['fixture'], metadata: { language: 'typescript', exported: true },
  });
  const graph = linkIntentRecords([plan, claim, fact], '2026-07-29T00:00:00.000Z');
  assert.ok(graph.relations.some((relation) => relation.type === 'implements'));
  assert.ok(graph.relations.some((relation) => relation.type === 'evidenced_by'));
  const report = diagnoseGraph(graph, '2026-07-29T00:00:00.000Z');
  assert.ok(!report.diagnostics.some((item) => item.code === 'PLANNED_NOT_IMPLEMENTED'));
});

test('Linker connects prose intent to a module through three grounded capability topics', () => {
  const intent = buildRecord({
    kind: 'declared_intent', action: 'validate', object: 'documentation response validation', target: {},
    text: 'Validate documentation response fields before rendering.', lifecycle: 'proposed', sourceKind: 'nl',
    sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 }, extractor: 'test', epistemicClass: 'declaration',
    confidence: 0.9, basis: ['fixture'],
  });
  const module = buildRecord({
    kind: 'module_fact', action: 'declare', object: 'src/extractors/docs-record.ts',
    target: { paths: ['src/extractors/docs-record.ts'] },
    text: 'module src/extractors/docs-record.ts capabilities validateDocumentResponse renderDocumentation',
    lifecycle: 'implemented', sourceKind: 'ast', sourcePath: 'src/extractors/docs-record.ts',
    sourceLines: { start: 1, end: 100 }, extractor: 'test', epistemicClass: 'fact', confidence: 1,
    basis: ['fixture'], metadata: { aggregate: 'module' },
  });
  const graph = linkIntentRecords([intent, module], '2026-07-30T00:00:00.000Z');
  assert.equal(graph.relations.length, 1);
  assert.equal(graph.relations[0]?.type, 'evidenced_by');
  assert.ok(graph.relations[0]?.basis.includes('module_topic:3'));
});

test('Linker does not connect a module on one generic topic alone', () => {
  const intent = buildRecord({
    kind: 'declared_intent', action: 'test', object: 'documentation', target: {}, text: 'Test documentation.',
    lifecycle: 'proposed', sourceKind: 'nl', sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 },
    extractor: 'test', epistemicClass: 'declaration', confidence: 0.9, basis: ['fixture'],
  });
  const module = buildRecord({
    kind: 'module_fact', action: 'declare', object: 'src/docs.ts', target: { paths: ['src/docs.ts'] },
    text: 'module src/docs.ts capabilities unrelated', lifecycle: 'implemented', sourceKind: 'ast',
    sourcePath: 'src/docs.ts', sourceLines: { start: 1, end: 10 }, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'], metadata: { aggregate: 'module' },
  });
  assert.equal(linkIntentRecords([intent, module]).relations.length, 0);
});

test('Diagnostics distinguish descriptive documentation from prescriptive requirements', () => {
  const documentation = (modality: 'observed' | 'unknown' | 'required' | 'recommended') => buildRecord({
    kind: 'documentation_statement', action: 'document', object: 'runtime behavior',
    target: { paths: ['src/runtime.ts'] }, text: ['required', 'recommended'].includes(modality)
      ? 'The runtime must validate every request.'
      : 'The runtime validates every request.',
    modality, lifecycle: 'proposed', sourceKind: 'document', sourcePath: 'docs/runtime.md',
    sourceLines: { start: 1, end: 1 }, extractor: 'test', epistemicClass: 'declaration',
    confidence: 0.8, basis: ['fixture'],
  });

  for (const modality of ['observed', 'unknown'] as const) {
    const report = diagnoseGraph(linkIntentRecords([documentation(modality)]), '2026-07-30T00:00:00.000Z');
    assert.ok(!report.diagnostics.some((item) => item.code === 'PLANNED_NOT_IMPLEMENTED'));
  }
  for (const modality of ['required', 'recommended'] as const) {
    const report = diagnoseGraph(linkIntentRecords([documentation(modality)]), '2026-07-30T00:00:00.000Z');
    assert.ok(report.diagnostics.some((item) => item.code === 'PLANNED_NOT_IMPLEMENTED'));
  }
});
