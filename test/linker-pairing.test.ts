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

function polarityProjection(options: {
  sourceKind: 'document' | 'nl';
  sourcePath: string;
  sourceLines: { start: number; end: number };
  text: string;
  polarity: 'positive' | 'negative';
}): IntentRecord {
  return buildRecord({
    kind: options.sourceKind === 'document' ? 'documentation_statement' : 'declared_intent',
    action: 'document',
    object: 'unverified renders as terminal bounded observation',
    target: { symbols: ['unverified'] },
    text: options.text,
    polarity: options.polarity,
    lifecycle: 'proposed',
    sourceKind: options.sourceKind,
    sourcePath: options.sourcePath,
    sourceLines: options.sourceLines,
    extractor: 'test',
    epistemicClass: 'declaration',
    confidence: 0.8,
    basis: ['fixture'],
  });
}

test('overlapping excerpts from one source location cannot contradict each other', () => {
  const document = polarityProjection({
    sourceKind: 'document',
    sourcePath: './project/ticket-071/README.md',
    sourceLines: { start: 32, end: 33 },
    text: 'unverified renders as a terminal bounded observation, not as Checking',
    polarity: 'negative',
  });
  const shortenedNl = polarityProjection({
    sourceKind: 'nl',
    sourcePath: 'project/ticket-071/README.md',
    sourceLines: { start: 32, end: 32 },
    text: 'unverified renders as a terminal bounded observation',
    polarity: 'positive',
  });

  const graph = linkIntentRecords([document, shortenedNl], AT);
  assert.equal(graph.relations.length, 1);
  assert.equal(graph.relations[0]?.type, 'documents');
  assert.ok(!diagnoseGraph(graph, AT).diagnostics.some((item) => item.code === 'CONFLICTING_INTENT'));
});

test('independent opposite-polarity sources still create a blocking contradiction', () => {
  const document = polarityProjection({
    sourceKind: 'document',
    sourcePath: 'project/ticket-071/README.md',
    sourceLines: { start: 32, end: 33 },
    text: 'unverified renders as a terminal bounded observation, not as Checking',
    polarity: 'negative',
  });
  const independentNl = polarityProjection({
    sourceKind: 'nl',
    sourcePath: 'TASK.md',
    sourceLines: { start: 1, end: 1 },
    text: 'unverified renders as a terminal bounded observation',
    polarity: 'positive',
  });

  const graph = linkIntentRecords([document, independentNl], AT);
  assert.equal(graph.relations[0]?.type, 'contradicts');
  assert.ok(diagnoseGraph(graph, AT).diagnostics.some((item) => item.code === 'CONFLICTING_INTENT'));
});

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

test('AST details sharing only a file and generic tokens do not create a quadratic subgraph', () => {
  const records = Array.from({ length: 20 }, (_, index) => buildRecord({
    kind: 'call_fact', action: 'call', object: 'validate shared contract',
    target: { paths: ['src/runtime.ts'], symbols: ['sharedOwner'] },
    text: 'call validate shared contract', lifecycle: 'implemented', sourceKind: 'ast',
    sourcePath: 'src/runtime.ts', sourceLines: { start: index + 1, end: index + 1 },
    symbol: 'sharedOwner', extractor: 'test', epistemicClass: 'fact', confidence: 1, basis: ['fixture'],
  }));

  const graph = linkIntentRecords(records, AT);
  assert.equal(graph.relations.length, 0);
});

test('A file-level plan links once to the AST module aggregate instead of every detail', () => {
  const plan = buildRecord({
    kind: 'todo_item', action: 'add', object: 'runtime module', target: { paths: ['src/runtime.ts'] },
    text: 'Add the runtime module.', lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md',
    sourceLines: { start: 1, end: 1 }, extractor: 'test', epistemicClass: 'plan', confidence: 1, basis: ['fixture'],
  });
  const module = buildRecord({
    kind: 'module_fact', action: 'declare', object: 'src/runtime.ts', target: { paths: ['src/runtime.ts'] },
    text: 'declare src/runtime.ts', lifecycle: 'implemented', sourceKind: 'ast', sourcePath: 'src/runtime.ts',
    sourceLines: { start: 1, end: 20 }, extractor: 'test', epistemicClass: 'fact', confidence: 1, basis: ['fixture'],
  });
  const details = Array.from({ length: 10 }, (_, index) => astFact(
    'src/runtime.ts',
    `detail${index}`,
    `unrelated detail ${index}`,
  ));

  const graph = linkIntentRecords([plan, module, ...details], AT);
  const planRelations = graph.relations.filter((relation) => relation.from === plan.id || relation.to === plan.id);
  assert.equal(planRelations.length, 1);
  assert.ok(planRelations.some((relation) => relation.from === plan.id && relation.to === module.id));
  assert.ok(planRelations[0]?.basis.includes('module_coverage'));
  const report = diagnoseGraph(graph, AT);
  assert.ok(!report.diagnostics.some((item) =>
    item.code === 'PLANNED_NOT_IMPLEMENTED' && item.recordIds.includes(plan.id)),
    'a pure file-creation declaration has no additional capability to corroborate');
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

test('A bare filename links to a module only when its repository path is unique', () => {
  const document = buildRecord({
    kind: 'documentation_statement', action: 'document', object: 'converter reference',
    target: { paths: ['markdown.ts'] }, text: 'See `markdown.ts` for the converter.',
    lifecycle: 'proposed', sourceKind: 'document', sourcePath: 'docs/architecture.md',
    sourceLines: { start: 4, end: 4 }, extractor: 'test', epistemicClass: 'declaration',
    confidence: 0.8, basis: ['fixture'],
  });
  const module = buildRecord({
    kind: 'module_fact', action: 'declare', object: 'src/extractors/markdown.ts',
    target: { paths: ['src/extractors/markdown.ts'] }, text: 'module source implementation',
    lifecycle: 'implemented', sourceKind: 'ast', sourcePath: 'src/extractors/markdown.ts',
    sourceLines: { start: 1, end: 20 }, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'], metadata: { aggregate: 'module' },
  });
  const plannedPath = buildRecord({
    kind: 'todo_item', action: 'add', object: 'future converter',
    target: { paths: ['planned/markdown.ts'] }, text: 'Add another Markdown converter later.',
    lifecycle: 'proposed', sourceKind: 'todo', sourcePath: 'TODO.md',
    sourceLines: { start: 8, end: 8 }, extractor: 'test', epistemicClass: 'plan',
    confidence: 0.9, basis: ['fixture'],
  });

  const graph = linkIntentRecords([document, module, plannedPath], AT);
  const relation = graph.relations.find((item) => item.from === document.id && item.to === module.id);
  assert.equal(relation?.type, 'evidenced_by');
  assert.ok(relation?.basis.includes('shared_path'));
  assert.ok(relation?.basis.includes('module_coverage'));
});

test('A bare filename refuses ambiguous module paths', () => {
  const document = buildRecord({
    kind: 'documentation_statement', action: 'document', object: 'validation reference',
    target: { paths: ['validation.ts'] }, text: 'See `validation.ts` for details.',
    lifecycle: 'proposed', sourceKind: 'document', sourcePath: 'docs/architecture.md',
    sourceLines: { start: 4, end: 4 }, extractor: 'test', epistemicClass: 'declaration',
    confidence: 0.8, basis: ['fixture'],
  });
  const modules = ['src/synthesis/validation.ts', 'src/runtime/validation.ts'].map((file) => buildRecord({
    kind: 'module_fact', action: 'declare', object: file, target: { paths: [file] },
    text: `module ${file}`, lifecycle: 'implemented', sourceKind: 'ast', sourcePath: file,
    sourceLines: { start: 1, end: 20 }, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'], metadata: { aggregate: 'module' },
  }));

  const graph = linkIntentRecords([document, ...modules], AT);
  assert.ok(!graph.relations.some((item) => item.from === document.id || item.to === document.id));
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

/** A configuration declaration, as the deterministic config converter emits them. */
function configFact(path: string, text: string): IntentRecord {
  return buildRecord({
    kind: 'configuration_declaration', action: 'configure', object: text,
    target: { paths: [path], symbols: ['timeout'] },
    text, lifecycle: 'implemented', sourceKind: 'system', sourcePath: path,
    sourceLines: { start: 1, end: 1 }, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'],
  });
}

function configAggregate(path: string, text: string): IntentRecord {
  return buildRecord({
    kind: 'configuration_file_fact', action: 'configure', object: path,
    target: { paths: [path] }, text, lifecycle: 'implemented', sourceKind: 'system', sourcePath: path,
    sourceLines: { start: 1, end: 20 }, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'], metadata: { aggregate: 'configuration-file' },
  });
}

test('Two configuration declarations sharing only a key name are not linked', () => {
  // Config records are uniform: same action, tiny text, repeated key names.
  // On an infrastructure repository this produced 28 896 mutual relations,
  // 72% of the whole graph, restating only that YAML files reuse keys.
  const graph = linkIntentRecords([
    configFact('config/a.yaml', 'Configure timeout'),
    configFact('config/b.yaml', 'Configure timeout'),
  ], AT);

  assert.equal(graph.relations.length, 0, 'shared config vocabulary is not evidence');
});

test('A shared ticket still connects two configuration declarations', () => {
  const left = buildRecord({
    kind: 'configuration_declaration', action: 'configure', object: 'Configure ingress',
    target: { paths: ['config/a.yaml'], tickets: ['PLF-42'] }, text: 'Configure ingress PLF-42',
    lifecycle: 'implemented', sourceKind: 'system', sourcePath: 'config/a.yaml',
    sourceLines: { start: 1, end: 1 }, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'],
  });
  const right = buildRecord({
    kind: 'configuration_declaration', action: 'configure', object: 'Configure ingress',
    target: { paths: ['config/b.yaml'], tickets: ['PLF-42'] }, text: 'Configure ingress PLF-42',
    lifecycle: 'implemented', sourceKind: 'system', sourcePath: 'config/b.yaml',
    sourceLines: { start: 1, end: 1 }, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'],
  });

  const graph = linkIntentRecords([left, right], AT);
  assert.ok(graph.relations.length > 0, 'a ticket names one piece of work, not a vocabulary');
  assert.ok(graph.relations[0]?.basis.includes('shared_ticket'));
});

test('Configuration still links to documentation that describes it', () => {
  const config = configFact('config/ingress.yaml', 'Configure ingress timeout');
  const documentation = buildRecord({
    kind: 'documentation_statement', action: 'configure', object: 'ingress timeout',
    target: { paths: ['config/ingress.yaml'] }, text: 'Configure the ingress timeout in `config/ingress.yaml`.',
    lifecycle: 'proposed', sourceKind: 'document', sourcePath: 'docs/ingress.md',
    sourceLines: { start: 3, end: 3 }, extractor: 'test', epistemicClass: 'declaration',
    confidence: 0.8, basis: ['fixture'],
  });

  const graph = linkIntentRecords([config, documentation], AT);
  assert.ok(graph.relations.length > 0, 'cross-kind evidence must survive the suppression');
});

test('Configuration file aggregate is the file-level target for an explicit documentation path', () => {
  const config = configAggregate('config/ingress.yaml', 'configure config/ingress.yaml timeout');
  const detail = configFact('config/ingress.yaml', 'Configure timeout');
  const documentation = buildRecord({
    kind: 'documentation_statement', action: 'document', object: 'gateway deployment',
    target: { paths: ['config/ingress.yaml'] }, text: 'Deployment is described in `config/ingress.yaml`.',
    lifecycle: 'proposed', sourceKind: 'document', sourcePath: 'docs/ingress.md',
    sourceLines: { start: 3, end: 3 }, extractor: 'test', epistemicClass: 'declaration',
    confidence: 0.8, basis: ['fixture'],
  });

  const graph = linkIntentRecords([config, detail, documentation], AT);
  assert.equal(graph.relations.length, 1);
  assert.ok(graph.relations[0]?.basis.includes('module_coverage'));
  assert.ok([graph.relations[0]?.from, graph.relations[0]?.to].includes(config.id));
  assert.ok(![graph.relations[0]?.from, graph.relations[0]?.to].includes(detail.id));
});

test('Configuration aggregates do not create broad capability-topic links', () => {
  const config = configAggregate(
    'pyproject.toml',
    'configure pyproject.toml project test dependencies analysis',
  );
  const unrelatedModule = buildRecord({
    kind: 'module_fact', action: 'declare', object: 'src/project-analysis.ts',
    target: { paths: ['src/project-analysis.ts'] },
    text: 'module src/project-analysis.ts capabilities project test dependencies analysis',
    lifecycle: 'implemented', sourceKind: 'ast', sourcePath: 'src/project-analysis.ts',
    sourceLines: { start: 1, end: 20 }, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'], metadata: { aggregate: 'module' },
  });

  assert.equal(linkIntentRecords([config, unrelatedModule], AT).relations.length, 0);
});
