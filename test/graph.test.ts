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

test('A changelog entry naming an extracted documentation file has release evidence', () => {
  const changelog = buildRecord({
    kind: 'changelog_entry', action: 'document', object: 'performance analysis',
    target: { paths: ['docs/OPTIMIZATION.md'] }, text: 'Added `docs/OPTIMIZATION.md`.',
    lifecycle: 'released', sourceKind: 'changelog', sourcePath: 'CHANGELOG.md',
    sourceLines: { start: 4, end: 4 }, extractor: 'test', epistemicClass: 'claim',
    confidence: 0.95, basis: ['fixture'],
  });
  const documentation = buildRecord({
    kind: 'documentation_statement', action: 'document', object: 'performance analysis',
    target: {}, text: 'Measured performance analysis.', modality: 'observed',
    lifecycle: 'implemented', sourceKind: 'document', sourcePath: 'docs/OPTIMIZATION.md',
    sourceLines: { start: 1, end: 1 }, extractor: 'test', epistemicClass: 'fact',
    confidence: 1, basis: ['fixture'],
  });

  const report = diagnoseGraph(linkIntentRecords([changelog, documentation]), '2026-07-30T00:00:00.000Z');
  assert.ok(!report.diagnostics.some((item) => item.code === 'CHANGELOG_WITHOUT_IMPLEMENTATION'));
});

test('Diagnostics ignore non-actionable changelog mechanics but retain release claims', () => {
  const changelog = (text: string, paths: string[] = []) => buildRecord({
    kind: 'changelog_entry', action: 'release', object: text,
    target: { paths }, text, lifecycle: 'released', sourceKind: 'changelog',
    sourcePath: 'CHANGELOG.md', sourceLines: { start: 4, end: 4 },
    extractor: 'test', epistemicClass: 'claim', confidence: 0.95,
    basis: ['fixture'],
  });
  const fixtures = [
    changelog('Update project/calls.mmd', ['project/calls.mmd']),
    changelog('Placeholder for changes in upcoming release'),
    changelog('... and 12 more files'),
    changelog('Update src/runtime.ts', ['src/runtime.ts']),
    changelog('Update README.md'),
    changelog('update debug/.cache/state.pkl', ['debug/.cache/state.pkl']),
    changelog('Update docs/api.md', ['docs/api.md']),
    changelog('Update project/custom-runtime.ts', ['project/custom-runtime.ts']),
  ];

  for (const record of fixtures) {
    const report = diagnoseGraph(linkIntentRecords([record]), '2026-07-31T00:00:00.000Z');
    assert.ok(
      !report.diagnostics.some((item) => item.recordIds.includes(record.id)
        && ['CHANGELOG_WITHOUT_IMPLEMENTATION', 'UNLINKED_RECORD'].includes(item.code)),
      `${record.statement.text} is release-note mechanics, not an unsupported implementation claim`,
    );
  }

  const substantive = [
    changelog('Added Jenkinsfile support for deployment pipelines'),
    changelog('Update src/runtime.ts to reject invalid tokens', ['src/runtime.ts']),
    changelog('Updated authentication in src/runtime.ts', ['src/runtime.ts']),
    changelog('Update support for Dockerfile parsing'),
  ];
  for (const record of substantive) {
    const report = diagnoseGraph(linkIntentRecords([record]), '2026-07-31T00:00:00.000Z');
    assert.ok(report.diagnostics.some((item) =>
      item.code === 'CHANGELOG_WITHOUT_IMPLEMENTATION' && item.recordIds.includes(record.id)));
    assert.ok(report.diagnostics.some((item) =>
      item.code === 'UNLINKED_RECORD' && item.recordIds.includes(record.id)));
  }
});
