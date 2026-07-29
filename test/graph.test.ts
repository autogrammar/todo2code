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
