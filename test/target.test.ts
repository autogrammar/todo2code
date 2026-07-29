import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { normalizePath, normalizeSymbol, pathAliases, symbolAliases } from '../src/core/target.js';
import { buildRealityView } from '../src/diff/reality.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';

test('Target normalization canonicalizes paths, symbols and cross-language separators', () => {
  assert.equal(normalizePath('`./src\\runtime.ts`'), 'src/runtime.ts');
  assert.equal(normalizeSymbol('`crate::Runtime::validateContract()`'), 'crate.Runtime.validateContract');
  assert.deepEqual(symbolAliases('crate::Runtime::validateContract()'), [
    'crate.runtime.validatecontract', 'runtime.validatecontract', 'validatecontract',
  ]);
  assert.deepEqual(pathAliases('./src/runtime.ts'), ['src/runtime.ts', 'runtime.ts']);
});

test('Qualified AST symbols align with short plan and documentation targets', () => {
  const plan = buildRecord({
    kind: 'todo_item', action: 'validate', object: 'contract', target: { symbols: ['validateContract'] },
    text: 'Implement validateContract', lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md',
    extractor: 'test', epistemicClass: 'plan', confidence: 1, basis: ['test'],
  });
  const document = buildRecord({
    kind: 'documented_requirement', action: 'validate', object: 'contract', target: { symbols: ['Runtime.validateContract'] },
    text: 'Runtime validates the contract', lifecycle: 'planned', sourceKind: 'document', sourcePath: 'docs/runtime.md',
    extractor: 'test', epistemicClass: 'llm_inference', confidence: 0.8, basis: ['test'],
  });
  const fact = buildRecord({
    kind: 'symbol_fact', action: 'declare', object: 'Runtime.validateContract',
    target: { paths: ['src/runtime.ts'], symbols: ['Runtime.validateContract'] }, text: 'declare Runtime.validateContract',
    lifecycle: 'implemented', sourceKind: 'ast', sourcePath: 'src/runtime.ts', symbol: 'Runtime.validateContract',
    extractor: 'test', epistemicClass: 'fact', confidence: 1, basis: ['test'],
  });
  const graph = linkIntentRecords([plan, document, fact], '2026-07-29T00:00:00.000Z');
  assert.ok(graph.relations.some((relation) => relation.from === plan.id && relation.to === fact.id));
  assert.ok(graph.relations.some((relation) => relation.from === document.id && relation.to === fact.id));
  const reality = buildRealityView(graph, diagnoseGraph(graph), '2026-07-29T00:00:00.000Z');
  assert.equal(reality.totals.topics, 1);
  assert.equal(reality.totals.implementationCoverage, 1);
  assert.equal(reality.totals.documentedCodeCoverage, 1);
});
