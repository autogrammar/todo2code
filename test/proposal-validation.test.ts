import assert from 'node:assert/strict';
import test from 'node:test';
import { createConclusionId, createTodoProposalId } from '../src/core/id.js';
import { buildRecord } from '../src/core/record.js';
import { assertTodoProposals } from '../src/core/schema.js';
import type {
  Conclusion,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  TodoProposal,
} from '../src/core/types.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { validateAndClassifyTodoProposals } from '../src/synthesis/validation.js';

const NOW = '2026-07-29T12:00:00.000Z';

function context(): { graph: IntentGraph; diagnostics: DiagnosticReport; conclusion: Conclusion } {
  const record = buildRecord({
    kind: 'todo_item', action: 'add', object: 'existing audited task', text: 'Implement existing audited task.',
    target: { paths: ['src/existing.ts'], tickets: ['T2C-200'] }, lifecycle: 'planned', sourceKind: 'todo',
    sourcePath: 'TODO.md', sourceLines: { start: 7, end: 7 }, extractor: 'test/proposal-validation',
    epistemicClass: 'plan', confidence: 1, basis: ['fixture'],
  });
  const graph = linkIntentRecords([record], NOW);
  const diagnostics = diagnoseGraph(graph, NOW);
  const diagnostic = diagnostics.diagnostics.find((item) => item.recordIds.includes(record.id));
  assert.ok(diagnostic);
  const content: Omit<Conclusion, 'id'> = {
    schemaVersion: 't2c.conclusion/v1', kind: 'finding', title: 'Work remains planned',
    detail: 'The planned record has no implementation evidence.', severity: diagnostic.severity,
    diagnosticIds: [diagnostic.id], recordIds: [record.id], confidence: 0.9, generation: generation(),
  };
  const conclusion = { ...content, id: createConclusionId(content) };
  return { graph, diagnostics, conclusion };
}

function generation(): GroundedGenerationMetadata {
  return {
    generator: 't2c/test-fixture', generatorVersion: '1',
    runtimeVersion: '0.4.0', generatedAt: NOW, requestedMode: 'require-llm', effectiveMode: 'llm',
    degraded: false, model: 'test/model', provider: 'test', responseId: 'response',
    configurationFingerprint: 'b'.repeat(64), reason: null,
  };
}

function proposal(
  title: string,
  ticket: string,
  conclusion: Conclusion,
  priority: TodoProposal['priority'],
): TodoProposal {
  const content: Omit<TodoProposal, 'id'> = {
    schemaVersion: 't2c.todo-proposal/v1', title, description: `${title} with runtime tests.`,
    priority, status: 'proposed', target: { paths: [], symbols: [], tickets: [ticket], versions: [] },
    acceptanceCriteria: ['The implementation passes its focused runtime tests.'], dependencies: [],
    conclusionIds: [conclusion.id], diagnosticIds: [...conclusion.diagnosticIds],
    recordIds: [...conclusion.recordIds], confidence: 0.85, generation: generation(),
  };
  return { ...content, id: createTodoProposalId(content) };
}

test('Proposal validation reports existing TODO duplicates and orders dependencies before priority', () => {
  const { graph, diagnostics, conclusion } = context();
  const duplicate = proposal('Implement existing audited task', 'T2C-200', conclusion, 'P0');
  const prerequisite = proposal('Build shared validation helper', 'T2C-201', conclusion, 'P2');
  const dependent = proposal('Expose validation command', 'T2C-202', conclusion, 'P0');
  dependent.dependencies = [prerequisite.id];

  const result = validateAndClassifyTodoProposals(
    [duplicate, prerequisite, dependent],
    { graph, diagnostics, conclusions: [conclusion] },
  );
  assert.deepEqual(result.duplicateProposalIds, [duplicate.id]);
  assert.equal(result.newProposalIds.includes(duplicate.id), false);
  assert.deepEqual(new Set(result.newProposalIds), new Set([prerequisite.id, dependent.id]));
  assert.deepEqual(result.duplicates[0]?.existingRecordIds, conclusion.recordIds);
  assert.ok(result.duplicates[0]?.basis.includes('shared_ticket_and_text'));
  assert.ok(result.orderedProposalIds.indexOf(prerequisite.id) < result.orderedProposalIds.indexOf(dependent.id));
});

test('Proposal validation rejects dependency cycles and whitespace-only criterion duplicates', () => {
  const { graph, diagnostics, conclusion } = context();
  const left = proposal('Left task', 'T2C-203', conclusion, 'P1');
  const right = proposal('Right task', 'T2C-204', conclusion, 'P1');
  left.dependencies = [right.id];
  right.dependencies = [left.id];
  assert.throws(
    () => assertTodoProposals([left, right], { graph, diagnostics, conclusions: [conclusion] }),
    /dependency cycle/,
  );

  const criteria = proposal('Criteria task', 'T2C-205', conclusion, 'P1');
  criteria.acceptanceCriteria = ['Same criterion', ' Same criterion '];
  criteria.id = createTodoProposalId(criteria);
  assert.throws(
    () => assertTodoProposals([criteria], { graph, diagnostics, conclusions: [conclusion] }),
    /unique after trimming/,
  );
});
