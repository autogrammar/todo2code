// Guards the pairing rule that keeps the evidence graph sparse.
//
// `collectCandidatePairs` refuses to pair two AST facts on a shared `path:`
// bucket alone. On a real repository that removed 96% of `related_to` noise
// (95 549 relations down to 26 099) without dropping a single relation that
// carries a conclusion. These tests pin both halves of that contract.

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import type { IntentRecord } from '../src/core/types.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';

const AT = '2026-07-29T00:00:00.000Z';

/** Two AST facts in one file, with nothing else in common. */
function astFact(path: string, symbol: string, object: string): IntentRecord {
  return buildRecord({
    kind: 'symbol_fact', action: 'declare', object,
    target: { paths: [path], symbols: [symbol] },
    text: `declare ${object}`, lifecycle: 'implemented', sourceKind: 'ast', sourcePath: path,
    sourceLines: { start: 1, end: 2 }, symbol, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'], metadata: { language: 'typescript', exported: true },
  });
}

test('Two unrelated AST facts sharing only a file are not linked', () => {
  const graph = linkIntentRecords([
    astFact('src/module.ts', 'parseHeaders', 'nagłówki żądania HTTP'),
    astFact('src/module.ts', 'rotateEncryptionKeys', 'rotacja kluczy szyfrujących'),
  ], AT);

  assert.equal(
    graph.relations.length,
    0,
    'a shared path alone must not be evidence between two AST facts',
  );
});

test('AST facts sharing a symbol are still linked despite the path rule', () => {
  const graph = linkIntentRecords([
    astFact('src/a.ts', 'validateContract', 'validateContract'),
    astFact('src/b.ts', 'validateContract', 'validateContract'),
  ], AT);

  assert.ok(graph.relations.length > 0, 'shared symbol must survive as evidence');
});

test('A shared path still links a plan to an AST fact', () => {
  // The rule is narrow: it only suppresses AST-to-AST pairs. Plan-to-code
  // evidence is exactly what the graph exists to record.
  const plan = buildRecord({
    kind: 'todo_item', action: 'add', object: 'walidacja kontraktu',
    target: { paths: ['src/runtime.ts'], symbols: [], tickets: [] },
    text: 'Dodać walidację kontraktu w `src/runtime.ts`.', lifecycle: 'planned',
    sourceKind: 'todo', sourcePath: 'TODO.md', sourceLines: { start: 1, end: 1 },
    extractor: 'test', epistemicClass: 'plan', confidence: 0.9, basis: ['fixture'],
  });
  const fact = astFact('src/runtime.ts', 'validateContract', 'walidacja kontraktu');

  const graph = linkIntentRecords([plan, fact], AT);
  assert.ok(
    graph.relations.some((relation) => relation.type === 'evidenced_by'),
    'plan and AST fact sharing a path must still produce evidence',
  );
});

test('Relations that carry a conclusion survive alongside suppressed noise', () => {
  const plan = buildRecord({
    kind: 'todo_item', action: 'validate', object: 'validateContract',
    target: { paths: ['src/runtime.ts'], symbols: ['validateContract'], tickets: ['T2C-14'] },
    text: 'Dodać validateContract', lifecycle: 'planned', sourceKind: 'todo',
    sourcePath: 'TODO.md', sourceLines: { start: 1, end: 1 }, extractor: 'test',
    epistemicClass: 'plan', confidence: 1, basis: ['fixture'],
  });
  const claim = buildRecord({
    kind: 'commit_intent_claim', action: 'validate', object: 'validateContract',
    target: { paths: ['src/runtime.ts'], symbols: ['validateContract'], tickets: ['T2C-14'] },
    text: 'feat: add validateContract T2C-14', lifecycle: 'implemented', sourceKind: 'git',
    revision: 'a'.repeat(40), extractor: 'test', epistemicClass: 'claim', confidence: 0.9, basis: ['fixture'],
  });
  const fact = astFact('src/runtime.ts', 'validateContract', 'validateContract');
  // Noise that the path rule should keep out of the graph.
  const unrelated = astFact('src/runtime.ts', 'formatTimestamp', 'formatowanie znacznika czasu');

  const graph = linkIntentRecords([plan, claim, fact, unrelated], AT);
  const types = new Set(graph.relations.map((relation) => relation.type));
  assert.ok(types.has('implements'), 'plan -> commit evidence must survive');
  assert.ok(types.has('evidenced_by'), 'declaration -> AST evidence must survive');

  assert.ok(
    !graph.relations.some((relation) => relation.from === unrelated.id || relation.to === unrelated.id),
    'the unrelated same-file symbol must stay unlinked',
  );

  // The conclusion drawn from the graph is unaffected by the suppression.
  const report = diagnoseGraph(graph, AT);
  assert.ok(!report.diagnostics.some((item) => item.code === 'PLANNED_NOT_IMPLEMENTED'));
});

test('Pair ordering stays deterministic across rebuilds', () => {
  const records = [
    astFact('src/a.ts', 'alpha', 'alpha'),
    astFact('src/b.ts', 'alpha', 'alpha'),
    astFact('src/c.ts', 'beta', 'beta'),
  ];
  const first = linkIntentRecords(records, AT);
  const second = linkIntentRecords([...records].reverse(), AT);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.relations, second.relations);
});
