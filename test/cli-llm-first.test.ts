import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import type { WorkspaceComparison } from '../src/comparison/workspace.js';
import type { PipelineManifest } from '../src/core/types.js';

const exec = promisify(execFile);

test('CLI pipeline defaults omitted task mode to audited require-llm', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cli-llm-first-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await exec('git', ['init', '-q', '--initial-branch=main'], { cwd: root });
  await exec('git', ['config', 'user.email', 'llm-first@todo2code.local'], { cwd: root });
  await exec('git', ['config', 'user.name', 't2c llm-first test'], { cwd: root });
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const ready = true;\n');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-q', '-m', 'fixture'], { cwd: root });

  const cli = path.resolve('dist/src/cli.js');
  const output = '.intent-llm-first';
  await assert.rejects(
    exec(process.execPath, [
      cli, 'pipeline', root,
      '--task', 'none',
      '--todo', 'none',
      '--changelog', 'none',
      '--docs', 'missing/**/*.md',
      '--no-communication',
      '--out', output,
    ], {
      cwd: root,
      env: {
        ...process.env,
        OPENROUTER_API_KEY: '',
        T2C_ENV_FILE: 'missing.env',
        T2C_ENABLE_PYTHON_AST: 'false',
        T2C_ENABLE_GO_AST: 'false',
        T2C_ENABLE_JAVA_AST: 'false',
        T2C_ENABLE_RUST_AST: 'false',
        T2C_ENABLE_PHP_AST: 'false',
      },
    }),
    (error: unknown) => error instanceof Error && /tasks requires LLM.*OPENROUTER_API_KEY/s.test(String(error)),
  );

  const runs = await fs.readdir(path.join(root, output, 'runs'));
  assert.equal(runs.length, 1);
  const manifest = JSON.parse(await fs.readFile(
    path.join(root, output, 'runs', runs[0]!, 'manifest.json'), 'utf8',
  )) as PipelineManifest;
  assert.equal(manifest.configuration.taskSynthesisMode, 'require-llm');
  assert.equal(manifest.status, 'failed');
  assert.equal(manifest.failure?.stage, 'taskSynthesis');
  assert.equal(manifest.failure?.code, 'LLM_NOT_CONFIGURED');
  await assert.rejects(fs.access(path.join(root, output, 'latest.json')));
});

test('CLI workspace comparison defaults documentation enrichment to audited LLM', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cli-compare-llm-first-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await exec('git', ['init', '-q', '--initial-branch=main'], { cwd: root });
  await exec('git', ['config', 'user.email', 'llm-first@todo2code.local'], { cwd: root });
  await exec('git', ['config', 'user.name', 't2c llm-first test'], { cwd: root });
  await fs.writeFile(path.join(root, 'README.md'), '# Contract\n\nThe runtime must validate requests.\n');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-q', '-m', 'fixture'], { cwd: root });

  const cli = path.resolve('dist/src/cli.js');
  const environment = {
    ...process.env,
    OPENROUTER_API_KEY: '',
    T2C_ENV_FILE: 'missing.env',
    T2C_ENABLE_PYTHON_AST: 'false',
    T2C_ENABLE_GO_AST: 'false',
    T2C_ENABLE_JAVA_AST: 'false',
    T2C_ENABLE_RUST_AST: 'false',
    T2C_ENABLE_PHP_AST: 'false',
  };
  const llmFirst = await exec(process.execPath, [
    cli, 'compare-workspace', root,
    '--base', 'HEAD',
    '--task', 'none',
    '--todo', 'none',
    '--changelog', 'none',
    '--markdown-mode', 'deterministic',
    '--communication-mode', 'deterministic',
    '--out', '.intent-compare-llm-first',
  ], { cwd: root, env: environment });
  const llmFirstResult = JSON.parse(llmFirst.stdout) as WorkspaceComparison;
  for (const artifact of [llmFirstResult.artifacts.baseManifest, llmFirstResult.artifacts.workspaceManifest]) {
    const manifest = JSON.parse(await fs.readFile(path.resolve(root, artifact!), 'utf8')) as PipelineManifest;
    assert.equal(manifest.stages.documentationExtraction.requestedMode, 'llm');
    assert.equal(manifest.stages.documentationExtraction.status, 'fallback');
    assert.equal(manifest.stages.documentationExtraction.reason?.code, 'LLM_NOT_CONFIGURED');
  }

  const offline = await exec(process.execPath, [
    cli, 'compare-workspace', root,
    '--base', 'HEAD',
    '--task', 'none',
    '--todo', 'none',
    '--changelog', 'none',
    '--markdown-mode', 'deterministic',
    '--communication-mode', 'deterministic',
    '--no-docs-llm',
    '--out', '.intent-compare-offline',
  ], { cwd: root, env: environment });
  const offlineResult = JSON.parse(offline.stdout) as WorkspaceComparison;
  assert.equal(offlineResult.schemaVersion, 't2c.workspace-comparison/v1');
  const offlineManifest = JSON.parse(await fs.readFile(
    path.resolve(root, offlineResult.artifacts.workspaceManifest!),
    'utf8',
  )) as PipelineManifest;
  assert.equal(offlineManifest.stages.documentationExtraction.requestedMode, 'deterministic');
  assert.equal(offlineManifest.stages.documentationExtraction.status, 'succeeded');
});
