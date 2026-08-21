import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import type { PipelineManifest } from '../src/core/types.js';

const exec = promisify(execFile);

test('compare-workspace CLI honors explicit deterministic NL mode', async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cli-compare-'));
  t.after(async () => fs.rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'repo');
  const remote = path.join(parent, 'origin.git');
  await fs.mkdir(root);
  await exec('git', ['init', '-q', '--initial-branch=main'], { cwd: root });
  await exec('git', ['config', 'user.email', 'compare@todo2code.local'], { cwd: root });
  await exec('git', ['config', 'user.name', 't2c compare test'], { cwd: root });
  await fs.writeFile(path.join(root, 'TASK.md'), 'System must validate the ticket intent.\n');
  await fs.writeFile(path.join(root, '.gitignore'), '.intent-compare/\n.intent/\n');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-q', '-m', 'initial comparison fixture'], { cwd: root });
  await exec('git', ['init', '-q', '--bare', remote], { cwd: parent });
  await exec('git', ['remote', 'add', 'origin', remote], { cwd: root });
  await exec('git', ['push', '-q', '-u', 'origin', 'main'], { cwd: root });

  const cli = path.resolve('dist/src/cli.js');
  const result = await exec(process.execPath, [
    cli,
    'compare-workspace',
    root,
    '--task', 'TASK.md',
    '--todo', 'none',
    '--changelog', 'none',
    '--docs', 'README-does-not-exist.md',
    '--nl-mode', 'deterministic',
    '--markdown-mode', 'deterministic',
    '--communication-mode', 'deterministic',
    '--out', '.intent-compare',
  ], {
    cwd: root,
    env: {
      ...process.env,
      OPENROUTER_API_KEY: '',
      T2C_ENV_FILE: 'missing.env',
      T2C_NL_MODE: 'require-llm',
      T2C_ENABLE_PYTHON_AST: 'false',
      T2C_ENABLE_GO_AST: 'false',
      T2C_ENABLE_JAVA_AST: 'false',
      T2C_ENABLE_RUST_AST: 'false',
    },
  });

  const comparison = JSON.parse(result.stdout) as { artifacts: Record<string, string> };
  for (const key of ['baseManifest', 'workspaceManifest']) {
    const manifest = JSON.parse(
      await fs.readFile(path.resolve(root, comparison.artifacts[key] ?? ''), 'utf8'),
    ) as PipelineManifest;
    assert.equal(manifest.configuration.nlMode, 'deterministic');
    assert.equal(manifest.stages.naturalLanguageExtraction.status, 'succeeded');
    assert.equal(manifest.stages.naturalLanguageExtraction.effectiveMode, 'deterministic');
  }
});

test('compare-workspace help exposes explicit NL modes', async () => {
  const cli = path.resolve('dist/src/cli.js');
  const result = await exec(process.execPath, [cli, 'compare-workspace', '--help'], {
    env: { ...process.env, T2C_ENV_FILE: 'missing.env' },
  });
  assert.match(result.stdout, /compare-workspace[^\n]+--nl-mode deterministic\|prefer-llm\|require-llm/);
});
