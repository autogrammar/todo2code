import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import type { IntentRecord } from '../src/core/types.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';

const NOW = '2026-07-31T12:00:00.000Z';

function nl(symbol: string, paths: string[] = [], missingFields: string[] = []): IntentRecord {
  return buildRecord({
    kind: 'declared_intent',
    action: 'validate',
    object: 'runtime contract validation',
    target: { paths, symbols: [symbol] },
    modality: 'required',
    text: `Validate the runtime contract through ${symbol}.`,
    lifecycle: 'proposed',
    sourceKind: 'nl',
    sourcePath: 'TASK.md',
    sourceLines: { start: 1, end: 1 },
    extractor: 'test/nl',
    epistemicClass: 'declaration',
    confidence: 1,
    basis: ['fixture'],
    metadata: { missingFields },
  });
}

function ast(path: string, symbol: string): IntentRecord {
  return buildRecord({
    kind: 'symbol_fact',
    action: 'declare',
    object: symbol,
    target: { paths: [path], symbols: [symbol] },
    modality: 'observed',
    text: `declare ${symbol}`,
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: path,
    sourceLines: { start: 1, end: 3 },
    symbol,
    extractor: 'test/ast',
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['fixture'],
    metadata: { language: 'typescript', exported: true },
  });
}

test('a short NL symbol resolves to its only AST owner', () => {
  const requirement = nl('validateContract');
  const implementation = ast('src/runtime.ts', 'Runtime.validateContract');
  const graph = linkIntentRecords([requirement, implementation], NOW);
  const relation = graph.relations.find((item) => item.from === requirement.id && item.to === implementation.id);
  assert.ok(relation);
  assert.ok(relation.basis.includes('shared_symbol'));
  assert.ok(!diagnoseGraph(graph, NOW).diagnostics.some((item) => item.code === 'AMBIGUOUS_REQUIREMENT'));
});

test('an ambiguous short NL symbol does not pretend that either AST owner is selected', () => {
  const requirement = nl('validateContract');
  const first = ast('src/api/runtime.ts', 'ApiRuntime.validateContract');
  const second = ast('src/worker/runtime.ts', 'WorkerRuntime.validateContract');
  const graph = linkIntentRecords([requirement, first, second], NOW);

  assert.ok(!graph.relations.some((item) => (item.from === requirement.id || item.to === requirement.id)
    && item.basis.includes('shared_symbol')));
  const diagnostic = diagnoseGraph(graph, NOW).diagnostics.find((item) =>
    item.code === 'AMBIGUOUS_REQUIREMENT' && item.recordIds.includes(requirement.id));
  assert.ok(diagnostic);
  assert.match(diagnostic.detail, /src\/api\/runtime\.ts/);
  assert.match(diagnostic.detail, /src\/worker\/runtime\.ts/);
  assert.match(diagnostic.suggestedAction, /Dodać target\.path/);
  assert.ok(diagnoseGraph(graph, NOW).diagnostics.some((item) =>
    item.code === 'PLANNED_NOT_IMPLEMENTED' && item.recordIds.includes(requirement.id)));
});

test('an explicit path selects one owner of an otherwise ambiguous symbol', () => {
  const requirement = nl('validateContract', ['src/worker/runtime.ts']);
  const first = ast('src/api/runtime.ts', 'ApiRuntime.validateContract');
  const second = ast('src/worker/runtime.ts', 'WorkerRuntime.validateContract');
  const graph = linkIntentRecords([requirement, first, second], NOW);

  assert.ok(graph.relations.some((item) => item.from === requirement.id && item.to === second.id
    && item.basis.includes('shared_symbol')));
  assert.ok(!graph.relations.some((item) => item.from === requirement.id && item.to === first.id));
  assert.ok(!diagnoseGraph(graph, NOW).diagnostics.some((item) =>
    item.code === 'AMBIGUOUS_REQUIREMENT' && item.recordIds.includes(requirement.id)));
});

test('a qualified symbol selects its exact AST declaration without a path', () => {
  const requirement = nl('WorkerRuntime.validateContract');
  const first = ast('src/api/runtime.ts', 'ApiRuntime.validateContract');
  const second = ast('src/worker/runtime.ts', 'WorkerRuntime.validateContract');
  const graph = linkIntentRecords([requirement, first, second], NOW);

  assert.ok(graph.relations.some((item) => item.from === requirement.id && item.to === second.id));
  assert.ok(!graph.relations.some((item) => item.from === requirement.id && item.to === first.id));
});

test('a symbol and explicit path conflict reports the observed AST location', () => {
  const requirement = nl('validateContract', ['src/missing.ts']);
  const implementation = ast('src/runtime.ts', 'Runtime.validateContract');
  const graph = linkIntentRecords([requirement, implementation], NOW);
  const diagnostic = diagnoseGraph(graph, NOW).diagnostics.find((item) =>
    item.code === 'AMBIGUOUS_REQUIREMENT' && item.recordIds.includes(requirement.id));

  assert.ok(!graph.relations.some((item) => item.basis.includes('shared_symbol')));
  assert.match(diagnostic?.detail ?? '', /nie występuje we wskazanej ścieżce/);
  assert.match(diagnostic?.suggestedAction ?? '', /Poprawić target\.path/);
  assert.match(diagnostic?.suggestedAction ?? '', /src\/runtime\.ts/);
});

test('missingFields diagnostics prescribe a concrete edit for every known gap', () => {
  const requirement = nl('newValidator', [], ['acceptance_evidence', 'failure_behavior', 'trigger']);
  const graph = linkIntentRecords([requirement], NOW);
  const diagnostic = diagnoseGraph(graph, NOW).diagnostics.find((item) => item.code === 'AMBIGUOUS_REQUIREMENT');

  assert.match(diagnostic?.suggestedAction ?? '', /mierzalne kryterium akceptacji/);
  assert.match(diagnostic?.suggestedAction ?? '', /zachowanie przy niepowodzeniu/);
  assert.match(diagnostic?.suggestedAction ?? '', /moment lub warunek wykonania/);
});
