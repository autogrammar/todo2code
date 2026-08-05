import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  calculateWorkspaceComparisonDeadline,
  classifyWorkspaceTrend,
  compareWorkspaceIntent,
} from '../src/comparison/workspace.js';
import { pathExists, readJson } from '../src/core/io.js';
import type { PipelineManifest } from '../src/core/types.js';
import { makeConfig } from './helpers.js';

const exec = promisify(execFile);

test('workspace comparison deadline scales aggregate input and LLM work in bounded 2x steps', () => {
  const baseline = calculateWorkspaceComparisonDeadline({ inputBytes: 128 * 1024, llmWorkUnits: 16 });
  assert.equal(baseline.multiplier, 1);
  assert.equal(baseline.effectiveDeadlineMs, 600_000);

  const doubled = calculateWorkspaceComparisonDeadline({ inputBytes: (128 * 1024) + 1, llmWorkUnits: 16 });
  assert.equal(doubled.multiplier, 2);
  assert.equal(doubled.effectiveDeadlineMs, 1_200_000);

  const quadrupled = calculateWorkspaceComparisonDeadline({ inputBytes: 1, llmWorkUnits: 33 });
  assert.equal(quadrupled.multiplier, 4);
  assert.equal(quadrupled.effectiveDeadlineMs, 2_400_000);
  assert.throws(
    () => calculateWorkspaceComparisonDeadline({ inputBytes: -1, llmWorkUnits: 1 }),
    /input bytes must be a non-negative safe integer/,
  );
});

test('workspace headline trend ignores AST-only topic and source churn', () => {
  const direction = classifyWorkspaceTrend({
    implementationCoverageDelta: 0,
    documentedCodeCoverageDelta: 0,
    documentationComparable: false,
    diagnosticsDelta: { info: 25, warning: 12, review_required: 0, blocking: 0 },
  });
  assert.equal(direction, 'unchanged');
  assert.equal(classifyWorkspaceTrend({
    implementationCoverageDelta: 0.1,
    documentedCodeCoverageDelta: 0,
    documentationComparable: false,
    diagnosticsDelta: { info: 0, warning: 0, review_required: 0, blocking: 0 },
  }), 'improved');
  assert.equal(classifyWorkspaceTrend({
    implementationCoverageDelta: 0,
    documentedCodeCoverageDelta: 0,
    documentationComparable: false,
    diagnosticsDelta: { info: 0, warning: 0, review_required: 1, blocking: 0 },
  }), 'regressed');
});

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
  config.markdownMode = 'deterministic';
  config.openRouter.apiKey = 'test-placeholder';
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
  assert.equal(comparison.trend.direction, 'improved');
  assert.ok(comparison.trend.implementationCoverageDelta > 0);
  assert.equal(comparison.trend.gapsDelta, 0);
  assert.equal(comparison.base.coverage.documentationMeasured, false);
  assert.equal(comparison.workspace.coverage.documentationMeasured, false);
  assert.notEqual(comparison.workspace.graphFingerprint, comparison.base.graphFingerprint);
  assert.ok(await pathExists(path.join(root, comparison.artifacts.comparison ?? '')));
  assert.ok(await pathExists(path.join(root, comparison.artifacts.diffSvg ?? '')));
  assert.ok(await pathExists(path.join(root, comparison.artifacts.trendMarkdown ?? '')));
  const trendMarkdown = await fs.readFile(path.join(root, comparison.artifacts.trendMarkdown ?? ''), 'utf8');
  assert.match(trendMarkdown, /Code with documentation: not measured/);
  const baseManifest = await readJson<PipelineManifest>(path.join(root, comparison.artifacts.baseManifest ?? ''));
  const workspaceManifest = await readJson<PipelineManifest>(path.join(root, comparison.artifacts.workspaceManifest ?? ''));
  assert.equal(baseManifest.stages.summary.status, 'skipped');
  assert.equal(workspaceManifest.stages.summary.status, 'skipped');
  assert.equal(baseManifest.configuration.summaryLlm, false);

  const outside = path.join(parent, 'outside-comparison');
  await assert.rejects(
    () => compareWorkspaceIntent({ root, outputDir: outside, includeDocumentationLlm: false }, config),
    /outside configured T2C_ROOT/,
  );
  assert.equal(await pathExists(outside), false, 'an absolute --out must not be rewritten under or outside the repo');

  // The restriction is configurable everywhere else, so an operator analysing a
  // third-party checkout can keep its artifacts out of that tree.
  const permitted = await compareWorkspaceIntent(
    { root, outputDir: outside, includeDocumentationLlm: false },
    { ...config, allowOutsideRoot: true },
  );
  // `artifacts` stays root-relative, which is how every consumer resolves it.
  const comparisonFile = path.resolve(root, permitted.artifacts.comparison ?? '');
  assert.ok(await pathExists(comparisonFile));
  assert.equal(path.relative(outside, comparisonFile).startsWith('..'), false, 'artifacts land under the requested directory');
  assert.equal(await pathExists(path.join(root, 'outside-comparison')), false);
});
