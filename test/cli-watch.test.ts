import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import type { PipelineManifest } from '../src/core/types.js';

const exec = promisify(execFile);

test('CLI watch reads TASK.md by default, disables summary LLM and reacts to a live file change', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cli-watch-'));
  await exec('git', ['init', '-q', '--initial-branch=main'], { cwd: root });
  await exec('git', ['config', 'user.email', 'watch@todo2code.local'], { cwd: root });
  await exec('git', ['config', 'user.name', 't2c watch test'], { cwd: root });
  await fs.writeFile(path.join(root, 'TASK.md'), 'System must add `validateContract` in `src/runtime.ts`.\n');
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n');
  await fs.writeFile(path.join(root, 'CHANGELOG.md'), '# Changelog\n');
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'src', 'runtime.ts'), 'export const before = true;\n');
  await fs.writeFile(path.join(root, '.intentignore'), '.intent-watch/\n');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-q', '-m', 'initial watch fixture'], { cwd: root });

  const cli = path.resolve('dist/src/cli.js');
  const child = spawn(process.execPath, [
    cli, 'watch', root,
    '--interval', '0',
    '--scan-interval', '1',
    '--no-docs-llm',
    '--no-summary-llm',
    '--nl-mode', 'deterministic',
    '--markdown-mode', 'deterministic',
    '--communication-mode', 'deterministic',
    '--no-communication',
    '--out', '.intent-watch',
  ], {
    cwd: root,
    env: {
      ...process.env,
      OPENROUTER_API_KEY: 'must-not-be-used',
      T2C_ENV_FILE: 'missing.env',
      T2C_ENABLE_PYTHON_AST: 'false',
      T2C_ENABLE_GO_AST: 'false',
      T2C_ENABLE_JAVA_AST: 'false',
      T2C_ENABLE_RUST_AST: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  // Drain stdout so repeated JSON run reports cannot backpressure the watcher.
  child.stdout.on('data', () => {});
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });

  try {
    const first = await waitForLatest(root, null);
    const firstManifest = await readManifest(root, first.runDirectory);
    assert.equal(firstManifest.configuration.summaryLlm, false);
    assert.equal(firstManifest.stages.summary.status, 'skipped');
    const nlPath = path.resolve(root, firstManifest.files.nlIntent ?? path.join(first.runDirectory, 'nl.intent.jsonl'));
    assert.match(await fs.readFile(nlPath, 'utf8'), /validateContract/);

    await fs.writeFile(path.join(root, 'src', 'runtime.ts'), 'export const after = true;\n');
    const second = await waitForLatest(root, first.runId);
    assert.notEqual(second.runId, first.runId);
    assert.match(stderr, /change\(s\): ~src\/runtime\.ts/);
  } finally {
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) resolve();
      else child.once('exit', () => resolve());
    });
  }
});

async function waitForLatest(
  root: string,
  previousRunId: string | null,
): Promise<{ runId: string; runDirectory: string }> {
  const latestPath = path.join(root, '.intent-watch', 'latest.json');
  // The complete test suite starts compiler-backed adapters in parallel. Give
  // the integration process enough headroom without weakening its assertions.
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const latest = JSON.parse(await fs.readFile(latestPath, 'utf8')) as { runId: string; runDirectory: string };
      if (latest.runId !== previousRunId) return latest;
    } catch {
      // The initial report or atomic latest-pointer write is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for watch run after ${previousRunId ?? 'startup'}`);
}

async function readManifest(root: string, runDirectory: string): Promise<PipelineManifest> {
  return JSON.parse(await fs.readFile(path.join(root, runDirectory, 'manifest.json'), 'utf8')) as PipelineManifest;
}
