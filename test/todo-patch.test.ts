import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createConclusionId, createTodoProposalId, sha256 } from '../src/core/id.js';
import { buildRecord } from '../src/core/record.js';
import type {
  Conclusion,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  PipelineStageAudit,
  TodoProposal,
} from '../src/core/types.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { executeAction } from '../src/services/actions.js';
import {
  applyTodoPatch,
  createTodoPatch,
  writeTodoPatchArtifacts,
} from '../src/synthesis/todo-patch.js';
import { validateAndClassifyTodoProposals } from '../src/synthesis/validation.js';
import { makeConfig } from './helpers.js';

const NOW = '2026-07-30T06:00:00.000Z';

interface Fixture {
  graph: IntentGraph;
  diagnostics: DiagnosticReport;
  conclusion: Conclusion;
  existing: TodoProposal;
  prerequisite: TodoProposal;
  dependent: TodoProposal;
  audit: PipelineStageAudit;
}

function fixture(): Fixture {
  const record = buildRecord({
    kind: 'todo_item', action: 'add', object: 'existing reviewed task', text: 'Implement existing reviewed task.',
    target: { paths: ['src/existing.ts'], tickets: ['T2C-300'] }, lifecycle: 'planned', sourceKind: 'todo',
    sourcePath: 'TODO.md', sourceLines: { start: 3, end: 3 }, extractor: 'test/todo-patch',
    epistemicClass: 'plan', confidence: 1, basis: ['fixture'],
  });
  const graph = linkIntentRecords([record], NOW);
  const diagnostics = diagnoseGraph(graph, NOW);
  const diagnostic = diagnostics.diagnostics.find((item) => item.recordIds.includes(record.id));
  assert.ok(diagnostic);
  const conclusionContent: Omit<Conclusion, 'id'> = {
    schemaVersion: 't2c.conclusion/v1', kind: 'finding', title: 'Reviewed work is incomplete',
    detail: 'The plan has no implementation fact.', severity: diagnostic.severity,
    diagnosticIds: [diagnostic.id], recordIds: [record.id], confidence: 0.9, generation: generation(),
  };
  const conclusion = { ...conclusionContent, id: createConclusionId(conclusionContent) };
  const existing = proposal('Implement existing reviewed task', 'T2C-300', 'P0', conclusion);
  const prerequisite = proposal('Build patch renderer', 'T2C-301', 'P2', conclusion);
  const dependent = proposal('Expose reviewed patch', 'T2C-302', 'P0', conclusion);
  dependent.dependencies = [prerequisite.id];
  return {
    graph, diagnostics, conclusion, existing, prerequisite, dependent,
    audit: {
      runtimeVersion: '0.4.0', configuration: { mode: 'require-llm' }, status: 'succeeded',
      requestedMode: 'llm', effectiveMode: 'llm', degraded: false, recordCount: 6, warningCount: 0,
      model: 'test/model', durationMs: 5, reason: null,
      responses: [{ responseId: 'response-1', model: 'test/model', provider: 'test', usage: null }],
    },
  };
}

function generation(): GroundedGenerationMetadata {
  return {
    generator: 't2c/test-fixture', generatorVersion: '1',
    runtimeVersion: '0.4.0', generatedAt: NOW, requestedMode: 'require-llm', effectiveMode: 'llm',
    degraded: false, model: 'test/model', provider: 'test', responseId: 'response-1',
    configurationFingerprint: 'a'.repeat(64), reason: null,
  };
}

function proposal(title: string, ticket: string, priority: TodoProposal['priority'], conclusion: Conclusion): TodoProposal {
  const content: Omit<TodoProposal, 'id'> = {
    schemaVersion: 't2c.todo-proposal/v1', title, description: `${title} with audited behavior.`, priority,
    status: 'proposed', target: { paths: ['src/synthesis/todo-patch.ts'], symbols: [], tickets: [ticket], versions: [] },
    acceptanceCriteria: [`${title} passes focused tests.`], dependencies: [], conclusionIds: [conclusion.id],
    diagnosticIds: [...conclusion.diagnosticIds], recordIds: [...conclusion.recordIds], confidence: 0.85,
    generation: generation(),
  };
  return { ...content, id: createTodoProposalId(content) };
}

function patchInput(todoContent = '# TODO\n\n- [ ] Implement existing reviewed task.\n') {
  const values = fixture();
  const proposals = [values.existing, values.dependent, values.prerequisite];
  const validation = validateAndClassifyTodoProposals(proposals, {
    graph: values.graph, diagnostics: values.diagnostics, conclusions: [values.conclusion],
  });
  return { ...values, proposals, validation, todoContent };
}

test('TODO patch rendering is stable, dependency-first and excludes classified duplicates', () => {
  const input = patchInput();
  const options = {
    todoPath: 'TODO.md', todoContent: input.todoContent, graph: input.graph, diagnostics: input.diagnostics,
    conclusions: [input.conclusion], proposals: input.proposals, validation: input.validation,
    synthesisAudit: input.audit, createdAt: NOW,
  };
  const first = createTodoPatch(options);
  const second = createTodoPatch(options);
  assert.deepEqual(first, second);
  assert.deepEqual(first.artifact.selectedProposalIds, [input.prerequisite.id, input.dependent.id]);
  assert.deepEqual(first.artifact.duplicateProposalIds, [input.existing.id]);
  assert.equal(first.markdown.includes(input.existing.title), false);
  assert.ok(first.markdown.indexOf(input.prerequisite.id) < first.markdown.indexOf(input.dependent.id));
  assert.match(first.markdown, /Acceptance criteria:/);
  assert.match(first.markdown, /Targets:/);
  assert.match(first.markdown, /Diagnostics:/);
  assert.equal(first.artifact.renderedPatchHash, sha256(first.markdown));
});

test('empty and duplicate-only results render an explicit no-op patch', () => {
  const input = patchInput();
  const empty = validateAndClassifyTodoProposals([], {
    graph: input.graph, diagnostics: input.diagnostics, conclusions: [input.conclusion],
  });
  const emptyRendered = createTodoPatch({
    todoPath: 'TODO.md', todoContent: input.todoContent, graph: input.graph, diagnostics: input.diagnostics,
    conclusions: [input.conclusion], proposals: [], validation: empty, synthesisAudit: input.audit, createdAt: NOW,
  });
  assert.deepEqual(emptyRendered.artifact.selectedProposalIds, []);
  assert.deepEqual(emptyRendered.artifact.duplicateProposalIds, []);
  assert.match(emptyRendered.markdown, /No new TODO proposals/);

  const duplicateOnly = validateAndClassifyTodoProposals([input.existing], {
    graph: input.graph, diagnostics: input.diagnostics, conclusions: [input.conclusion],
  });
  const rendered = createTodoPatch({
    todoPath: 'TODO.md', todoContent: input.todoContent, graph: input.graph, diagnostics: input.diagnostics,
    conclusions: [input.conclusion], proposals: [input.existing], validation: duplicateOnly,
    synthesisAudit: input.audit, createdAt: NOW,
  });
  assert.deepEqual(rendered.artifact.selectedProposalIds, []);
  assert.deepEqual(rendered.artifact.duplicateProposalIds, [input.existing.id]);
  assert.match(rendered.markdown, /No new TODO proposals/);
});

test('apply rejects missing or wrong approval, stale TODO and a tampered patch', async () => {
  const input = patchInput();
  const directory = await fs.mkdtemp(path.join(tmpdir(), 't2c-todo-patch-reject-'));
  const todoPath = path.join(directory, 'TODO.md');
  await fs.writeFile(todoPath, input.todoContent);
  const written = await writeTodoPatchArtifacts({
    directory, todoPath: 'TODO.md', todoContent: input.todoContent, graph: input.graph,
    diagnostics: input.diagnostics, conclusions: [input.conclusion], proposals: input.proposals, validation: input.validation,
    synthesisAudit: input.audit, createdAt: NOW,
  });
  assert.equal(await fs.readFile(todoPath, 'utf8'), input.todoContent);
  const base = { todoPath, patchPath: written.patchPath, auditPath: written.auditPath, receiptPath: path.join(directory, 'receipt.json') };
  await assert.rejects(() => applyTodoPatch(base), /approval is required/);
  await assert.rejects(() => applyTodoPatch({ ...base, approval: { actor: 'reviewer', patchHash: '0'.repeat(64) } }), /approval hash/);

  await fs.writeFile(todoPath, `${input.todoContent}- [ ] Concurrent edit\n`);
  await assert.rejects(() => applyTodoPatch({ ...base, approval: { actor: 'reviewer', patchHash: written.artifact.renderedPatchHash } }), /Source TODO changed/);
  await fs.writeFile(todoPath, input.todoContent);
  await fs.appendFile(written.patchPath, 'tampered\n');
  await assert.rejects(() => applyTodoPatch({ ...base, approval: { actor: 'reviewer', patchHash: written.artifact.renderedPatchHash } }), /content hash/);
});

test('approved apply is atomic, receipt-backed and idempotent', async () => {
  const input = patchInput();
  const directory = await fs.mkdtemp(path.join(tmpdir(), 't2c-todo-patch-apply-'));
  const todoPath = path.join(directory, 'TODO.md');
  const receiptPath = path.join(directory, 'TODO.patch.receipt.json');
  await fs.writeFile(todoPath, input.todoContent);
  await fs.chmod(todoPath, 0o640);
  const written = await writeTodoPatchArtifacts({
    directory, todoPath: 'TODO.md', todoContent: input.todoContent, graph: input.graph,
    diagnostics: input.diagnostics, conclusions: [input.conclusion], proposals: input.proposals, validation: input.validation,
    synthesisAudit: input.audit, createdAt: NOW,
  });
  const options = {
    todoPath, patchPath: written.patchPath, auditPath: written.auditPath, receiptPath,
    approval: { actor: 'human-reviewer', patchHash: written.artifact.renderedPatchHash }, now: new Date(NOW),
  };
  const first = await applyTodoPatch(options);
  assert.equal(first.applied, true);
  assert.equal(first.idempotent, false);
  assert.equal(first.receipt.approvedBy, 'human-reviewer');
  assert.equal(first.receipt.approvedAt, NOW);
  const appliedContent = await fs.readFile(todoPath, 'utf8');
  assert.ok(appliedContent.endsWith(written.markdown));
  assert.equal(first.receipt.resultTodoHash, sha256(appliedContent));
  assert.equal((await fs.stat(todoPath)).mode & 0o777, 0o640);

  const second = await applyTodoPatch(options);
  assert.equal(second.applied, false);
  assert.equal(second.idempotent, true);
  assert.deepEqual(second.receipt, first.receipt);
  assert.equal(await fs.readFile(todoPath, 'utf8'), appliedContent);

  await fs.unlink(receiptPath);
  const recovered = await applyTodoPatch(options);
  assert.equal(recovered.applied, false);
  assert.equal(recovered.idempotent, true);
  assert.equal(recovered.receipt.resultTodoHash, first.receipt.resultTodoHash);
  assert.equal(await fs.readFile(todoPath, 'utf8'), appliedContent);
});

test('service actions execute LLM propose -> render -> approved apply with scoped artifacts', async () => {
  const input = patchInput();
  const diagnostic = input.diagnostics.diagnostics.find((item) => item.recordIds.length > 0);
  assert.ok(diagnostic);
  const directory = await fs.mkdtemp(path.join(tmpdir(), 't2c-actions-todo-'));
  await fs.writeFile(path.join(directory, 'TODO.md'), input.todoContent);
  await fs.writeFile(path.join(directory, 'graph.json'), `${JSON.stringify(input.graph)}\n`);
  await fs.writeFile(path.join(directory, 'diagnostics.json'), `${JSON.stringify(input.diagnostics)}\n`);
  const config = makeConfig(directory);
  config.openRouter.apiKey = 'test-secret';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'todo-action-response', model: 'test/model', provider: 'test',
    choices: [{ message: { content: JSON.stringify({
      conclusions: [{
        key: 'finding', kind: 'finding', title: 'New reviewed work is required',
        detail: 'The cited diagnostic requires a new implementation task.', severity: diagnostic.severity,
        diagnosticIds: [diagnostic.id], recordIds: diagnostic.recordIds, confidence: 0.9,
      }],
      proposals: [{
        key: 'task', title: 'Implement a new reviewed workflow',
        description: 'Add the missing workflow through the audited action boundary.', priority: 'P0',
        target: { paths: ['src/new-workflow.ts'], symbols: [], tickets: ['T2C-399'], versions: [] },
        acceptanceCriteria: ['The complete reviewed action flow passes its end-to-end test.'],
        dependencyKeys: [], conclusionKeys: ['finding'], diagnosticIds: [diagnostic.id],
        recordIds: diagnostic.recordIds, confidence: 0.88,
      }],
    }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const synthesis = await executeAction('propose_todo', {
      root: directory, graphPath: 'graph.json', diagnosticsPath: 'diagnostics.json',
      mode: 'require-llm', output: 'run/synthesis.json',
    }, config) as AuditedActionSynthesis;
    assert.equal(synthesis.audit.status, 'succeeded');
    assert.equal(synthesis.validation.newProposalIds.length, 1);

    const rendered = await executeAction('render_todo', {
      root: directory, graphPath: 'graph.json', diagnosticsPath: 'diagnostics.json', synthesis,
      todo: 'TODO.md', patch: 'run/TODO.patch', audit: 'run/TODO.patch.json',
    }, config) as { artifact: { renderedPatchHash: string } };
    const applied = await executeAction('apply_todo', {
      root: directory, todo: 'TODO.md', patch: 'run/TODO.patch', audit: 'run/TODO.patch.json',
      receipt: 'run/TODO.patch.receipt.json', actor: 'integration-reviewer',
      approvalHash: rendered.artifact.renderedPatchHash,
    }, config) as { applied: boolean; receipt: { approvedBy: string } };
    assert.equal(applied.applied, true);
    assert.equal(applied.receipt.approvedBy, 'integration-reviewer');
    assert.match(await fs.readFile(path.join(directory, 'TODO.md'), 'utf8'), /Implement a new reviewed workflow/);
    assert.ok((await fs.stat(path.join(directory, 'run', 'synthesis.json'))).isFile());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

interface AuditedActionSynthesis {
  audit: { status: string };
  validation: { newProposalIds: string[] };
}
