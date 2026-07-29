import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { pathExists, readJson } from '../src/core/io.js';
import type { IntentGraph } from '../src/core/types.js';
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
  assert.equal(result.manifest.llm.summary, false);
  assert.equal(result.manifest.status, 'degraded');
  assert.equal(result.manifest.runtime.version, '0.2.0');
  assert.equal(result.manifest.stages.naturalLanguageExtraction.status, 'fallback');
  assert.equal(result.manifest.stages.naturalLanguageExtraction.reason?.code, 'LLM_NOT_CONFIGURED');
  assert.equal(result.manifest.stages.documentationExtraction.status, 'skipped');
  assert.equal(result.manifest.stages.summary.status, 'fallback');
  assert.equal(result.manifest.configuration.llm.configured, false);
  assert.ok(!JSON.stringify(result.manifest.configuration).includes('apiKey'));
  assert.match(result.manifest.configuration.fingerprint, /^[a-f0-9]{64}$/);
  const graph = await readJson<IntentGraph>(result.graphPath);
  assert.ok(graph.records.some((record) => record.source.kind === 'nl'));
  assert.ok(graph.records.some((record) => record.source.kind === 'git'));
  assert.ok(graph.records.some((record) => record.source.kind === 'ast'));
  assert.ok(graph.records.some((record) => record.source.kind === 'todo'));
});
