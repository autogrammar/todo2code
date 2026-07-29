import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { createConclusionId, createTodoProposalId } from '../src/core/id.js';
import { buildRecord } from '../src/core/record.js';
import {
  assertConclusion,
  assertConclusions,
  assertTodoProposal,
  assertTodoProposals,
} from '../src/core/schema.js';
import type {
  Conclusion,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  TodoProposal,
} from '../src/core/types.js';
import { linkIntentRecords } from '../src/graph/linker.js';

const GENERATED_AT = '2026-07-29T12:00:00.000Z';
const DIAGNOSTIC_ID = 'DIAG-11111111111111111111';

function fixtureGraph(): IntentGraph {
  const record = buildRecord({
    kind: 'planned_work',
    action: 'add',
    object: 'grounded task proposal',
    text: 'Add a grounded task proposal with acceptance criteria.',
    target: { paths: ['src/synthesis/tasks.ts'], tickets: ['T2C-101'] },
    lifecycle: 'planned',
    sourceKind: 'todo',
    sourcePath: 'TODO.md',
    sourceLines: { start: 10, end: 10 },
    extractor: 'test/grounded-contracts',
    epistemicClass: 'plan',
    confidence: 1,
    basis: ['fixture'],
  });
  return linkIntentRecords([record], GENERATED_AT);
}

function fixtureDiagnostics(graph: IntentGraph): DiagnosticReport {
  return {
    schemaVersion: 't2c.diagnostics/v1',
    generatedAt: GENERATED_AT,
    graphFingerprint: graph.fingerprint,
    diagnostics: [{
      id: DIAGNOSTIC_ID,
      code: 'PLANNED_NOT_IMPLEMENTED',
      severity: 'warning',
      title: 'Planned work lacks implementation evidence',
      detail: 'The graph contains a plan without matching code evidence.',
      recordIds: [graph.records[0]!.id],
      suggestedAction: 'Implement and test the planned behavior.',
    }],
    counts: { info: 0, warning: 1, review_required: 0, blocking: 0 },
  };
}

function deterministicGeneration(): GroundedGenerationMetadata {
  return {
    runtimeVersion: '0.4.0',
    generatedAt: GENERATED_AT,
    requestedMode: 'deterministic',
    effectiveMode: 'deterministic',
    degraded: false,
    model: null,
    provider: null,
    responseId: null,
    configurationFingerprint: 'a'.repeat(64),
    reason: null,
  };
}

function fixtureConclusion(graph: IntentGraph): Conclusion {
  const content: Omit<Conclusion, 'id'> = {
    schemaVersion: 't2c.conclusion/v1',
    kind: 'finding',
    title: 'Implementation evidence is missing',
    detail: 'The planned task has no matching implementation record.',
    severity: 'warning',
    diagnosticIds: [DIAGNOSTIC_ID],
    recordIds: [graph.records[0]!.id],
    confidence: 0.94,
    generation: deterministicGeneration(),
  };
  return { ...content, id: createConclusionId(content) };
}

function fixtureProposal(graph: IntentGraph, conclusion: Conclusion): TodoProposal {
  const content: Omit<TodoProposal, 'id'> = {
    schemaVersion: 't2c.todo-proposal/v1',
    title: 'Implement grounded task synthesis',
    description: 'Generate validated proposals from graph diagnostics.',
    priority: 'P0',
    status: 'proposed',
    target: {
      paths: ['src/synthesis/tasks.ts'],
      symbols: ['synthesizeTodoProposals'],
      tickets: ['T2C-101'],
      versions: [],
    },
    acceptanceCriteria: [
      'Every proposal cites a diagnostic and an intent record.',
      'Invalid citations fail runtime validation.',
    ],
    dependencies: [],
    conclusionIds: [conclusion.id],
    diagnosticIds: [DIAGNOSTIC_ID],
    recordIds: [graph.records[0]!.id],
    confidence: 0.9,
    generation: deterministicGeneration(),
  };
  return { ...content, id: createTodoProposalId(content) };
}

test('Grounded conclusion and TODO proposal contracts accept traceable values', () => {
  const graph = fixtureGraph();
  const diagnostics = fixtureDiagnostics(graph);
  const conclusion = fixtureConclusion(graph);
  const proposal = fixtureProposal(graph, conclusion);

  assert.doesNotThrow(() => assertConclusion(conclusion, { graph, diagnostics }));
  assert.doesNotThrow(() => assertConclusions([conclusion], { graph, diagnostics }));
  assert.doesNotThrow(() => assertTodoProposal(proposal, { graph, diagnostics, conclusions: [conclusion] }));
  assert.doesNotThrow(() => assertTodoProposals([proposal], { graph, diagnostics, conclusions: [conclusion] }));
});

test('Stable IDs ignore ordering noise but change with semantic content', () => {
  const graph = fixtureGraph();
  const conclusion = fixtureConclusion(graph);
  const proposal = fixtureProposal(graph, conclusion);

  assert.equal(createConclusionId({
    ...conclusion,
    diagnosticIds: [DIAGNOSTIC_ID, DIAGNOSTIC_ID],
  }), conclusion.id);
  assert.notEqual(createConclusionId({ ...conclusion, severity: 'blocking' }), conclusion.id);

  assert.equal(createTodoProposalId({
    ...proposal,
    target: {
      ...proposal.target,
      paths: [...proposal.target.paths].reverse(),
      tickets: [...proposal.target.tickets].reverse(),
    },
    acceptanceCriteria: [...proposal.acceptanceCriteria].reverse(),
  }), proposal.id);
  assert.notEqual(createTodoProposalId({ ...proposal, description: 'A different task.' }), proposal.id);
});

test('Validators reject ungrounded citations and stale semantic IDs', () => {
  const graph = fixtureGraph();
  const diagnostics = fixtureDiagnostics(graph);
  const conclusion = fixtureConclusion(graph);
  const proposal = fixtureProposal(graph, conclusion);

  const unknownDiagnostic = structuredClone(conclusion);
  unknownDiagnostic.diagnosticIds = ['DIAG-22222222222222222222'];
  unknownDiagnostic.id = createConclusionId(unknownDiagnostic);
  assert.throws(
    () => assertConclusion(unknownDiagnostic, { graph, diagnostics }),
    /references unknown ids/,
  );

  const noRecordCitation = structuredClone(conclusion);
  noRecordCitation.recordIds = [];
  noRecordCitation.id = createConclusionId(noRecordCitation);
  assert.throws(() => assertConclusion(noRecordCitation, { graph, diagnostics }), /at least one id/);

  const staleId = structuredClone(proposal);
  staleId.description = 'Changed without regenerating its stable ID.';
  assert.throws(
    () => assertTodoProposal(staleId, { graph, diagnostics, conclusions: [conclusion] }),
    /does not match semantic content/,
  );

  const unknownConclusion = structuredClone(proposal);
  unknownConclusion.conclusionIds = ['CONC-22222222222222222222'];
  assert.throws(
    () => assertTodoProposal(unknownConclusion, { graph, diagnostics, conclusions: [conclusion] }),
    /references unknown ids/,
  );
});

test('Generation metadata exposes LLM failures instead of silently masking them', () => {
  const graph = fixtureGraph();
  const diagnostics = fixtureDiagnostics(graph);
  const conclusion = fixtureConclusion(graph);

  const hiddenFallback = structuredClone(conclusion);
  hiddenFallback.generation.requestedMode = 'prefer-llm';
  assert.throws(() => assertConclusion(hiddenFallback, { graph, diagnostics }), /must be marked degraded/);

  const invalidRequiredLlm = structuredClone(conclusion);
  invalidRequiredLlm.generation.requestedMode = 'require-llm';
  assert.throws(() => assertConclusion(invalidRequiredLlm, { graph, diagnostics }), /cannot use deterministic output/);

  const visibleFallback = structuredClone(conclusion);
  visibleFallback.generation.requestedMode = 'prefer-llm';
  visibleFallback.generation.degraded = true;
  visibleFallback.generation.reason = 'openrouter_timeout';
  assert.doesNotThrow(() => assertConclusion(visibleFallback, { graph, diagnostics }));

  const llmOutput = structuredClone(conclusion);
  llmOutput.generation.requestedMode = 'require-llm';
  llmOutput.generation.effectiveMode = 'llm';
  llmOutput.generation.model = 'qwen/qwen3.7-plus';
  llmOutput.generation.provider = 'openrouter';
  llmOutput.generation.responseId = 'response-123';
  assert.doesNotThrow(() => assertConclusion(llmOutput, { graph, diagnostics }));
});

test('TODO proposal collections enforce dependency integrity', () => {
  const graph = fixtureGraph();
  const diagnostics = fixtureDiagnostics(graph);
  const conclusion = fixtureConclusion(graph);
  const proposal = fixtureProposal(graph, conclusion);
  proposal.dependencies = ['TPROP-22222222222222222222'];

  assert.throws(
    () => assertTodoProposals([proposal], { graph, diagnostics, conclusions: [conclusion] }),
    /unknown dependency/,
  );
});

test('Published JSON schemas identify both grounded contract versions', async () => {
  const [conclusionSchema, proposalSchema] = await Promise.all([
    readFile(resolve('schemas/conclusion.schema.json'), 'utf8'),
    readFile(resolve('schemas/todo-proposal.schema.json'), 'utf8'),
  ]);
  const conclusion = JSON.parse(conclusionSchema) as { properties: { schemaVersion: { const: string } } };
  const proposal = JSON.parse(proposalSchema) as { properties: { schemaVersion: { const: string } } };
  assert.equal(conclusion.properties.schemaVersion.const, 't2c.conclusion/v1');
  assert.equal(proposal.properties.schemaVersion.const, 't2c.todo-proposal/v1');
});
