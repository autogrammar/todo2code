import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { compareWorkspaceIntent } from '../src/comparison/workspace.js';
import { pathExists, readJson } from '../src/core/io.js';
import type { PipelineManifest } from '../src/core/types.js';
import { makeConfig } from './helpers.js';

const exec = promisify(execFile);

test('workspace comparison measures origin/main against uncommitted filesystem intent', async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-workspace-test-'));
  const root = path.join(parent, 'repo');
  const remote = path.join(parent, 'origin.git');
  await fs.mkdir(root);
  await exec('git', ['init', '-q', '--initial-branch=main'], { cwd: root });
  await exec('git', ['config', 'user.email', 'test@todo2code.local'], { cwd: root });
  await exec('git', ['config', 'user.name', 't2c test'], { cwd: root });
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n\n- [ ] Add `validateContract` in `runtime.ts`.\n', 'utf8');
  await fs.writeFile(path.join(root, 'CHANGELOG.md'), '# Changelog\n', 'utf8');
  await fs.writeFile(path.join(root, '.gitignore'), '.intent-workspace/\n', 'utf8');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-q', '-m', 'plan: add validateContract'], { cwd: root });
  await exec('git', ['init', '-q', '--bare', remote], { cwd: parent });
  await exec('git', ['remote', 'add', 'origin', remote], { cwd: root });
  await exec('git', ['push', '-q', '-u', 'origin', 'main'], { cwd: root });

  await fs.writeFile(path.join(root, 'runtime.ts'), 'export function validateContract(): boolean { return true; }\n', 'utf8');
  await fs.writeFile(path.join(root, 'unplanned.ts'), 'export function unplannedFeature(): boolean { return true; }\n', 'utf8');
  const config = makeConfig(root);
  config.enablePythonAst = false;
  config.enableGoAst = false;
  config.nlMode = 'deterministic';
  config.openRouter.apiKey = 'must-not-be-used';
  config.openRouter.baseUrl = 'http://127.0.0.1:1';
  const comparison = await compareWorkspaceIntent({
    root,
    outputDir: '.intent-workspace',
    includeDocumentationLlm: false,
  }, config);

  assert.equal(comparison.base.ref, 'origin/main');
  assert.equal(comparison.workspace.dirty, true);
  assert.deepEqual(comparison.workspace.changedFiles, ['runtime.ts', 'unplanned.ts']);
  assert.equal(comparison.workspace.ahead, 0);
  assert.equal(comparison.workspace.behind, 0);
  assert.ok(comparison.diff.summary.recordsAdded > 0);
  assert.ok(comparison.diff.records.added.some((record) => record.statement.object.includes('validateContract')));
  assert.equal(comparison.trend.direction, 'mixed');
  assert.ok(comparison.trend.implementationCoverageDelta > 0);
  assert.ok(comparison.trend.gapsDelta > 0);
  assert.notEqual(comparison.workspace.graphFingerprint, comparison.base.graphFingerprint);
  assert.ok(await pathExists(path.join(root, comparison.artifacts.comparison ?? '')));
  assert.ok(await pathExists(path.join(root, comparison.artifacts.diffSvg ?? '')));
  assert.ok(await pathExists(path.join(root, comparison.artifacts.trendMarkdown ?? '')));
  const baseManifest = await readJson<PipelineManifest>(path.join(root, comparison.artifacts.baseManifest ?? ''));
  const workspaceManifest = await readJson<PipelineManifest>(path.join(root, comparison.artifacts.workspaceManifest ?? ''));
  assert.equal(baseManifest.stages.summary.status, 'skipped');
  assert.equal(workspaceManifest.stages.summary.status, 'skipped');
  assert.equal(baseManifest.configuration.summaryLlm, false);
});
