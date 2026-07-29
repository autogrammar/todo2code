import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { pathExists, readJson } from '../src/core/io.js';
import type { IntentGraph, PipelineManifest } from '../src/core/types.js';
import { runPipeline } from '../src/pipeline/run.js';
import { makeConfig } from './helpers.js';

const exec = promisify(execFile);

test('Offline pipeline writes a complete run', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-pipeline-'));
  await fs.writeFile(path.join(root, 'TASK.md'), 'System musi dodać `validateContract` dla T2C-14.\n');
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n- [x] Dodać `validateContract` dla T2C-14.\n');
  await fs.writeFile(path.join(root, 'CHANGELOG.md'), '# Changelog\n## [1.0.0] - 2026-07-29\n### Added\n- Dodano `validateContract` dla T2C-14.\n');
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
    documentPatterns: [],
    includeDocumentationLlm: false,
    outputDir: '.intent-test',
    gitCommitCount: 10,
    allowSummaryFallback: true,
    nlMode: 'prefer-llm',
  }, config);
  assert.ok(await pathExists(result.graphPath));
  assert.ok(await pathExists(result.diagnosticsPath));
  assert.ok(await pathExists(result.summaryPath));
  assert.equal(result.manifest.llm.documentationExtraction, false);
  assert.equal(result.manifest.llm.naturalLanguageExtraction, false);
  assert.equal(result.manifest.llm.markdownExtraction, false);
  assert.equal(result.manifest.llm.summary, false);
  assert.equal(result.manifest.status, 'degraded');
  assert.equal(result.manifest.failure, null);
  assert.equal(result.manifest.runtime.version, '0.2.0');
  assert.equal(result.manifest.stages.naturalLanguageExtraction.status, 'fallback');
  assert.equal(result.manifest.stages.naturalLanguageExtraction.reason?.code, 'LLM_NOT_CONFIGURED');
  assert.equal(result.manifest.stages.markdownExtraction.status, 'fallback');
  assert.equal(result.manifest.stages.markdownExtraction.reason?.code, 'LLM_NOT_CONFIGURED');
  assert.equal(result.manifest.stages.documentationExtraction.status, 'skipped');
  assert.equal(result.manifest.stages.summary.status, 'fallback');
  assert.equal(result.manifest.configuration.llm.configured, false);
  assert.equal(result.manifest.configuration.markdownMode, 'prefer-llm');
  assert.equal(result.manifest.configuration.llm.markdownModel, 'test/model');
  assert.ok(!JSON.stringify(result.manifest.configuration).includes('apiKey'));
  assert.match(result.manifest.configuration.fingerprint, /^[a-f0-9]{64}$/);
  const graph = await readJson<IntentGraph>(result.graphPath);
  assert.ok(graph.records.some((record) => record.source.kind === 'nl'));
  assert.ok(graph.records.some((record) => record.source.kind === 'git'));
  assert.ok(graph.records.some((record) => record.source.kind === 'ast'));
  assert.ok(graph.records.some((record) => record.source.kind === 'todo'));
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
