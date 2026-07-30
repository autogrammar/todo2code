import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { pathExists, readJson } from '../src/core/io.js';
import type { Conclusion, IntentGraph, PipelineManifest } from '../src/core/types.js';
import { buildRealityView } from '../src/diff/reality.js';
import { runPipeline } from '../src/pipeline/run.js';
import { executeAction } from '../src/services/actions.js';
import { makeConfig } from './helpers.js';

const exec = promisify(execFile);

test('Offline pipeline writes a complete run', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-pipeline-'));
  await fs.writeFile(path.join(root, 'TASK.md'), 'System musi dodać `validateContract` dla T2C-14.\n');
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n- [x] Dodać `validateContract` dla T2C-14.\n');
  await fs.writeFile(path.join(root, 'CHANGELOG.md'), '# Changelog\n## [1.0.0] - 2026-07-29\n### Added\n- Dodano `validateContract` dla T2C-14.\n');
  await fs.writeFile(path.join(root, 'README.md'), '# Runtime\n\nUse `validateContract` from `runtime.ts` for T2C-14.\n');
  await fs.writeFile(path.join(root, 'runtime.ts'), 'export function validateContract(): void {}\n');
  await exec('git', ['init', '-q'], { cwd: root });
  await exec('git', ['config', 'user.email', 'test@todo2code.local'], { cwd: root });
  await exec('git', ['config', 'user.name', 't2c test'], { cwd: root });
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-q', '-m', 'feat: add validateContract T2C-14'], { cwd: root });

  const config = makeConfig(root);
  const result = await runPipeline({
    root,
    taskFile: 'TASK.md',
    todoFile: 'TODO.md',
    changelogFile: 'CHANGELOG.md',
    documentPatterns: ['README.md'],
    includeDocumentationLlm: false,
    outputDir: '.intent-test',
    gitCommitCount: 10,
    allowSummaryFallback: true,
    nlMode: 'prefer-llm',
  }, config);
  assert.ok(await pathExists(result.graphPath));
  assert.ok(await pathExists(result.diagnosticsPath));
  assert.ok(await pathExists(result.summaryPath));
  assert.ok(await pathExists(result.summaryConclusionsPath));
  assert.equal(result.manifest.llm.documentationExtraction, false);
  assert.equal(result.manifest.llm.naturalLanguageExtraction, false);
  assert.equal(result.manifest.llm.markdownExtraction, false);
  assert.equal(result.manifest.llm.taskSynthesis, false);
  assert.equal(result.manifest.llm.summary, false);
  assert.equal(result.manifest.status, 'degraded');
  assert.equal(result.manifest.failure, null);
  assert.equal(result.manifest.runtime.version, '0.5.0');
  assert.equal(result.manifest.stages.naturalLanguageExtraction.status, 'fallback');
  assert.equal(result.manifest.stages.naturalLanguageExtraction.reason?.code, 'LLM_NOT_CONFIGURED');
  assert.equal(result.manifest.stages.markdownExtraction.status, 'fallback');
  assert.equal(result.manifest.stages.markdownExtraction.reason?.code, 'LLM_NOT_CONFIGURED');
  assert.equal(result.manifest.stages.documentationExtraction.status, 'succeeded');
  assert.equal(result.manifest.stages.documentationExtraction.effectiveMode, 'deterministic');
  assert.equal(result.manifest.stages.taskSynthesis.status, 'skipped');
  assert.equal(result.manifest.stages.summary.status, 'fallback');
  assert.equal(result.manifest.configuration.llm.configured, false);
  assert.equal(result.manifest.configuration.markdownMode, 'prefer-llm');
  assert.equal(result.manifest.configuration.taskSynthesisMode, 'disabled');
  assert.equal(result.manifest.configuration.llm.markdownModel, 'test/model');
  assert.ok(!JSON.stringify(result.manifest.configuration).includes('apiKey'));
  assert.match(result.manifest.configuration.fingerprint, /^[a-f0-9]{64}$/);
  const graph = await readJson<IntentGraph>(result.graphPath);
  const conclusions = await readJson<Conclusion[]>(result.summaryConclusionsPath);
  assert.ok(conclusions.length > 0);
  assert.ok(conclusions.every((item) => item.schemaVersion === 't2c.conclusion/v1'));
  assert.equal(result.manifest.files.summaryConclusions?.endsWith('/summary-conclusions.json'), true);
  assert.ok(graph.records.some((record) => record.source.kind === 'nl'));
  assert.ok(graph.records.some((record) => record.source.kind === 'git'));
  assert.ok(graph.records.some((record) => record.source.kind === 'ast'));
  assert.ok(graph.records.some((record) => record.source.kind === 'todo'));
  assert.ok(graph.records.some((record) => record.source.kind === 'document'
    && record.source.extractor === 't2c/markdown-documentation@1'));
});

test('Pipeline persists synthesis, validation and review patch, then registers approval receipt', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-pipeline-todo-'));
  const todoContent = '# TODO\n\n- [ ] Existing task.\n';
  await fs.writeFile(path.join(root, 'TODO.md'), todoContent);
  const config = makeConfig(root);
  const result = await runPipeline({
    root,
    taskFile: null,
    todoFile: 'TODO.md',
    changelogFile: null,
    documentPatterns: [],
    includeDocumentationLlm: false,
    outputDir: '.intent-todo',
    gitCommitCount: 1,
    allowSummaryFallback: true,
    includeSummaryLlm: false,
    nlMode: 'deterministic',
    markdownMode: 'deterministic',
    taskSynthesisMode: 'prefer-llm',
  }, config);
  assert.ok(result.taskSynthesisPath && await pathExists(result.taskSynthesisPath));
  assert.ok(result.todoPatchPath && await pathExists(result.todoPatchPath));
  assert.ok(result.todoPatchAuditPath && await pathExists(result.todoPatchAuditPath));
  assert.ok(await pathExists(path.join(result.runDirectory, 'todo-validation.json')));
  assert.equal(result.manifest.stages.taskSynthesis.status, 'fallback');
  assert.equal(result.manifest.stages.taskSynthesis.reason?.code, 'LLM_NOT_CONFIGURED');
  assert.equal(result.manifest.configuration.taskSynthesisMode, 'prefer-llm');
  assert.equal(result.manifest.files.taskSynthesis?.endsWith('/task-synthesis.json'), true);
  assert.equal(result.manifest.files.todoValidation?.endsWith('/todo-validation.json'), true);
  assert.equal(await fs.readFile(path.join(root, 'TODO.md'), 'utf8'), todoContent);

  const patchAudit = await readJson<{ renderedPatchHash: string }>(result.todoPatchAuditPath!);
  const receiptPath = path.join(result.runDirectory, 'TODO.patch.receipt.json');
  const applied = await executeAction('apply_todo', {
    root,
    todo: 'TODO.md',
    patch: path.relative(root, result.todoPatchPath!),
    audit: path.relative(root, result.todoPatchAuditPath!),
    receipt: path.relative(root, receiptPath),
    actor: 'pipeline-reviewer',
    approvalHash: patchAudit.renderedPatchHash,
  }, config) as { applied: boolean; idempotent: boolean };
  assert.equal(applied.applied, false);
  assert.equal(applied.idempotent, true);
  const updatedManifest = await readJson<PipelineManifest>(path.join(result.runDirectory, 'manifest.json'));
  assert.equal(updatedManifest.files.todoApplyReceipt?.endsWith('/TODO.patch.receipt.json'), true);
});

test('Pipeline integrates multi-participant communication into graph, diagnostics, reality and run artifacts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-pipeline-communication-'));
  const ticketRoot = path.join(root, 'project', 'COM-1');
  await fs.mkdir(ticketRoot, { recursive: true });
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n', 'utf8');
  await fs.writeFile(path.join(ticketRoot, 'alice.request.md'), [
    '---', 'participant: Alice', 'role: human', 'type: request', 'ticket: COM-1', '---',
    'System must add `secureApply` for COM-1.', '',
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(ticketRoot, 'bob.decision.md'), [
    '---', 'participant: Bob', 'role: human', 'type: decision', 'ticket: COM-1', '---',
    'System must not add `secureApply` for COM-1.', '',
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(ticketRoot, 'codex.claim.md'), [
    '---', 'participant: Codex', 'role: agent', 'type: claim', 'ticket: COM-1', '---',
    'Implemented `unrequestedFeature` for COM-1.', '',
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(ticketRoot, 'unknown.md'), 'Review `secureApply` for COM-1.\n', 'utf8');

  const config = makeConfig(root);
  const result = await runPipeline({
    root, taskFile: null, todoFile: 'TODO.md', changelogFile: null,
    documentPatterns: [], includeDocumentationLlm: false, outputDir: '.intent',
    gitCommitCount: 1, allowSummaryFallback: true, includeSummaryLlm: false,
    nlMode: 'deterministic', markdownMode: 'deterministic',
  }, config);

  assert.equal(result.manifest.stages.communicationAnalysis.status, 'partial');
  assert.equal(result.manifest.stages.communicationAnalysis.effectiveMode, 'deterministic');
  assert.equal(result.manifest.llm.communicationEnrichment, false);
  assert.equal(result.manifest.stages.communicationAnalysis.recordCount, 4);
  assert.ok(result.communicationAnalysisPath && await pathExists(result.communicationAnalysisPath));
  assert.equal(result.manifest.files.communicationAnalysis?.endsWith('/communication-analysis.json'), true);
  assert.equal(result.manifest.files.communicationAnalysisMarkdown?.endsWith('/communication-analysis.md'), true);
  const communicationAnalysis = await readJson<import('../src/communication/analyzer.js').CommunicationAnalysis>(result.communicationAnalysisPath!);
  assert.equal(communicationAnalysis.syntheses.length, 4);
  const graph = await readJson<IntentGraph>(result.graphPath);
  assert.equal(graph.records.filter((record) => record.source.kind === 'agent_log').length, 4);
  const diagnostics = await readJson<import('../src/core/types.js').DiagnosticReport>(result.diagnosticsPath);
  assert.ok(diagnostics.diagnostics.some((item) => item.code === 'HUMAN_COMMUNICATION_CONFLICT'));
  assert.ok(diagnostics.diagnostics.some((item) => item.code === 'AGENT_CLAIM_WITHOUT_EVIDENCE'));
  assert.ok(diagnostics.diagnostics.some((item) => item.code === 'PARTICIPANT_IDENTITY_UNRESOLVED'));
  const reality = buildRealityView(graph, diagnostics);
  assert.ok(reality.rows.some((row) => (row.lanes.agent_log ?? 0) > 0));
  assert.equal(graph.records.some((record) => record.source.kind === 'agent_log' && record.epistemic.class === 'fact'), false);
});

test('Pipeline require-llm task synthesis failure is audited and never publishes latest', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-pipeline-task-failed-'));
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n- [ ] Add task synthesis.\n');
  const config = makeConfig(root);
  await assert.rejects(() => runPipeline({
    root,
    taskFile: null,
    todoFile: 'TODO.md',
    changelogFile: null,
    documentPatterns: [],
    includeDocumentationLlm: false,
    outputDir: '.intent-failed',
    gitCommitCount: 1,
    allowSummaryFallback: true,
    includeSummaryLlm: false,
    nlMode: 'deterministic',
    markdownMode: 'deterministic',
    taskSynthesisMode: 'require-llm',
  }, config), /requires LLM/);
  const runsRoot = path.join(root, '.intent-failed', 'runs');
  const runIds = await fs.readdir(runsRoot);
  const manifest = await readJson<PipelineManifest>(path.join(runsRoot, runIds[0] ?? '', 'manifest.json'));
  assert.equal(manifest.failure?.stage, 'taskSynthesis');
  assert.equal(manifest.failure?.code, 'LLM_NOT_CONFIGURED');
  assert.equal(manifest.stages.taskSynthesis.status, 'failed');
  assert.equal(await pathExists(path.join(root, '.intent-failed', 'latest.json')), false);
});

test('Pipeline persists an audited failure when communication require-llm cannot run', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-pipeline-communication-llm-failed-'));
  await fs.mkdir(path.join(root, 'project', 'COM-9'), { recursive: true });
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n');
  await fs.writeFile(path.join(root, 'project', 'COM-9', 'human.alice.request.md'), [
    '---', 'participant: Alice', 'role: human', 'type: request', '---',
    'System must validate checkout for COM-9.', '',
  ].join('\n'));
  const config = makeConfig(root);
  await assert.rejects(() => runPipeline({
    root, taskFile: null, todoFile: 'TODO.md', changelogFile: null,
    documentPatterns: [], includeDocumentationLlm: false, outputDir: '.intent-failed',
    gitCommitCount: 1, allowSummaryFallback: true, includeSummaryLlm: false,
    nlMode: 'deterministic', markdownMode: 'deterministic', communicationMode: 'require-llm',
  }, config), /Communication enrichment requires LLM/);
  const runs = await fs.readdir(path.join(root, '.intent-failed', 'runs'));
  const manifest = await readJson<PipelineManifest>(path.join(root, '.intent-failed', 'runs', runs[0] ?? '', 'manifest.json'));
  assert.equal(manifest.failure?.stage, 'communicationAnalysis');
  assert.equal(manifest.failure?.code, 'LLM_NOT_CONFIGURED');
  assert.equal(manifest.stages.communicationAnalysis.status, 'failed');
  assert.equal(await pathExists(path.join(root, '.intent-failed', 'latest.json')), false);
});

test('Pipeline persists communication stage failure and does not publish latest', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-pipeline-communication-failed-'));
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n', 'utf8');
  const config = makeConfig(root);
  await assert.rejects(() => runPipeline({
    root, taskFile: null, todoFile: 'TODO.md', changelogFile: null,
    documentPatterns: [], includeDocumentationLlm: false, outputDir: '.intent-failed',
    gitCommitCount: 1, allowSummaryFallback: true, includeSummaryLlm: false,
    nlMode: 'deterministic', markdownMode: 'deterministic', projectDirectory: '../outside',
  }, config), /outside configured T2C_ROOT/);
  const runs = await fs.readdir(path.join(root, '.intent-failed', 'runs'));
  const manifest = await readJson<PipelineManifest>(path.join(root, '.intent-failed', 'runs', runs[0] ?? '', 'manifest.json'));
  assert.equal(manifest.status, 'failed');
  assert.equal(manifest.failure?.stage, 'communicationAnalysis');
  assert.equal(manifest.stages.communicationAnalysis.status, 'failed');
  assert.equal(await pathExists(path.join(root, '.intent-failed', 'latest.json')), false);
});

for (const scenario of [
  { name: 'NL', taskFile: 'TASK.md', todoFile: null, nlMode: 'require-llm' as const, markdownMode: 'deterministic' as const, stage: 'naturalLanguageExtraction' },
  { name: 'Markdown', taskFile: null, todoFile: 'TODO.md', nlMode: 'deterministic' as const, markdownMode: 'require-llm' as const, stage: 'markdownExtraction' },
]) {
  test(`Pipeline persists a failed manifest when ${scenario.name} require-llm aborts`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-pipeline-failed-'));
    await fs.writeFile(path.join(root, 'TASK.md'), 'System musi dodać walidację.\n');
    await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n- [ ] Dodać walidację.\n');
    const config = makeConfig(root);
    await assert.rejects(() => runPipeline({
      root,
      taskFile: scenario.taskFile,
      todoFile: scenario.todoFile,
      changelogFile: null,
      documentPatterns: [],
      includeDocumentationLlm: false,
      outputDir: '.intent-failed',
      gitCommitCount: 1,
      allowSummaryFallback: true,
      includeSummaryLlm: false,
      nlMode: scenario.nlMode,
      markdownMode: scenario.markdownMode,
    }, config), /requires LLM/);

    const runsRoot = path.join(root, '.intent-failed', 'runs');
    const runIds = await fs.readdir(runsRoot);
    assert.equal(runIds.length, 1);
    const runDirectory = path.join(runsRoot, runIds[0] ?? '');
    const manifest = await readJson<PipelineManifest>(path.join(runDirectory, 'manifest.json'));
    assert.equal(manifest.status, 'failed');
    assert.equal(manifest.graphFingerprint, null);
    assert.equal(manifest.failure?.stage, scenario.stage);
    assert.equal(manifest.failure?.code, 'LLM_NOT_CONFIGURED');
    assert.equal(manifest.configuration.llm.configured, false);
    assert.equal(await pathExists(path.join(runDirectory, 'intent.graph.json')), false);
    assert.equal(await pathExists(path.join(root, '.intent-failed', 'latest.json')), false);
  });
}

test('Pipeline persists a failed manifest for an unexpected summary failure', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-pipeline-summary-failed-'));
  const config = makeConfig(root);
  await assert.rejects(() => runPipeline({
    root,
    taskFile: null,
    todoFile: null,
    changelogFile: null,
    documentPatterns: [],
    includeDocumentationLlm: false,
    outputDir: '.intent-failed',
    gitCommitCount: 1,
    allowSummaryFallback: false,
    includeSummaryLlm: true,
    nlMode: 'deterministic',
    markdownMode: 'deterministic',
  }, config), /OPENROUTER_API_KEY is required/);

  const runsRoot = path.join(root, '.intent-failed', 'runs');
  const runIds = await fs.readdir(runsRoot);
  assert.equal(runIds.length, 1);
  const manifest = await readJson<PipelineManifest>(path.join(runsRoot, runIds[0] ?? '', 'manifest.json'));
  assert.equal(manifest.status, 'failed');
  assert.equal(manifest.failure?.stage, 'summary');
  assert.equal(manifest.failure?.code, 'PIPELINE_SUMMARY_FAILED');
  assert.equal(manifest.stages.naturalLanguageExtraction.status, 'skipped');
  assert.equal(manifest.stages.markdownExtraction.status, 'skipped');
  assert.equal(manifest.stages.documentationExtraction.status, 'skipped');
  assert.equal(manifest.stages.taskSynthesis.status, 'skipped');
  assert.equal(manifest.stages.summary.status, 'failed');
});
