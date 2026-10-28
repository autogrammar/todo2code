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
  computeBasePipelineCacheKey,
  type WorkspaceComparison,
  WORKSPACE_COMPARISON_GRAPH_MAX_BYTES,
} from '../src/comparison/workspace.js';
import { commonPipelineOptions } from '../src/comparison/workspace-helpers.js';
import { pathExists, readJson, writeJson } from '../src/core/io.js';
import type { IntentGraph, PipelineManifest } from '../src/core/types.js';
import { makeConfig } from './helpers.js';

const exec = promisify(execFile);

test('workspace comparison has a bounded graph ceiling above large Platform evidence', () => {
  const observedPlatformGraphBytes = 142_557_246;
  assert.ok(WORKSPACE_COMPARISON_GRAPH_MAX_BYTES > observedPlatformGraphBytes);
  assert.equal(WORKSPACE_COMPARISON_GRAPH_MAX_BYTES, 256 * 1024 * 1024);
});

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

test('workspace comparison measures origin/main against uncommitted filesystem intent', async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-workspace-test-'));
  t.after(async () => fs.rm(parent, { recursive: true, force: true }));
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
  // exposed diagnostics (#137)
  const baseDiagnosticsFile = await readJson<{ schemaVersion: string; diagnostics: unknown[] }>(path.join(root, comparison.artifacts.baseDiagnostics ?? ''));
  const workspaceDiagnosticsFile = await readJson<{ schemaVersion: string; diagnostics: unknown[] }>(path.join(root, comparison.artifacts.workspaceDiagnostics ?? ''));
  assert.ok(Array.isArray(baseDiagnosticsFile.diagnostics));
  assert.ok(Array.isArray(workspaceDiagnosticsFile.diagnostics));
  const trendMarkdown = await fs.readFile(path.join(root, comparison.artifacts.trendMarkdown ?? ''), 'utf8');
  assert.match(trendMarkdown, /Code with documentation: not measured/);
  const baseManifest = await readJson<PipelineManifest>(path.join(root, comparison.artifacts.baseManifest ?? ''));
  const workspaceManifest = await readJson<PipelineManifest>(path.join(root, comparison.artifacts.workspaceManifest ?? ''));
  assert.equal(baseManifest.stages.summary.status, 'skipped');
  assert.equal(workspaceManifest.stages.summary.status, 'skipped');
  assert.equal(baseManifest.configuration.summaryLlm, false);
  assert.equal(await pathExists(path.join(root, '.intent')), false, 'ambient cache directory is not used');

  const repeated = await compareWorkspaceIntent({
    root,
    outputDir: '.intent-workspace',
    includeDocumentationLlm: false,
  }, config);
  assert.deepEqual(
    repeated.workspace.changedFiles,
    ['runtime.ts', 'unplanned.ts'],
    'existing comparison evidence is excluded from the observed Git state',
  );

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
  assert.equal(await pathExists(path.join(root, '.intent')), false, 'external output also owns extractor caches');
  assert.ok(await pathExists(path.join(outside, 'cache')), 'extractor cache follows the external output directory');
});

test('base pipeline cache key changes when base tree, t2c version, config, or extractor versions change', () => {
  const config = makeConfig('/tmp/t2c-cache-key');
  const options = commonPipelineOptions({ root: '/tmp/t2c-cache-key', outputDir: '.intent' }, config);
  const baseline = computeBasePipelineCacheKey({
    baseTreeId: 'aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111',
    options,
    config,
    t2cVersion: '0.5.2',
  });
  const differentTree = computeBasePipelineCacheKey({
    baseTreeId: 'bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222',
    options,
    config,
    t2cVersion: '0.5.2',
  });
  const differentVersion = computeBasePipelineCacheKey({
    baseTreeId: 'aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111',
    options,
    config,
    t2cVersion: '0.5.3',
  });
  const modifiedConfig = makeConfig('/tmp/t2c-cache-key');
  modifiedConfig.maxFileBytes = config.maxFileBytes + 1024;
  const differentConfig = computeBasePipelineCacheKey({
    baseTreeId: 'aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111',
    options,
    config: modifiedConfig,
    t2cVersion: '0.5.2',
  });
  const differentExtractor = computeBasePipelineCacheKey({
    baseTreeId: 'aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111',
    options,
    config,
    t2cVersion: '0.5.2',
    extractorVersions: { ast: '0.6.0' },
  });

  assert.notEqual(baseline, differentTree);
  assert.notEqual(baseline, differentVersion);
  assert.notEqual(baseline, differentConfig);
  assert.notEqual(baseline, differentExtractor);
});

test('base pipeline cache hit yields byte-identical comparison payload and detects corrupt or partial entries', async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-workspace-cache-'));
  t.after(async () => fs.rm(parent, { recursive: true, force: true }));
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

  const config = makeConfig(root);
  config.enablePythonAst = false;
  config.enableGoAst = false;
  config.nlMode = 'deterministic';
  config.markdownMode = 'deterministic';
  config.openRouter.apiKey = 'test-placeholder';
  config.openRouter.baseUrl = 'http://127.0.0.1:1';

  const cold = await compareWorkspaceIntent({
    root,
    outputDir: '.intent-workspace',
    includeDocumentationLlm: false,
  }, config);
  const baseCacheRoot = path.join(root, '.intent-workspace', 'cache', 'base');
  const cacheKeys = await fs.readdir(baseCacheRoot);
  assert.equal(cacheKeys.length, 1);
  const cacheDir = path.join(baseCacheRoot, cacheKeys[0]!);
  const cachedGraphPath = path.join(cacheDir, 'graph.json');
  assert.ok(await pathExists(cachedGraphPath));

  // Verify hard-link between cached base graph and comparison base.graph.json
  const coldBaseGraphStat = await fs.stat(path.join(root, cold.artifacts.baseGraph ?? ''));
  const cachedGraphStat = await fs.stat(cachedGraphPath);
  assert.equal(coldBaseGraphStat.ino, cachedGraphStat.ino, 'base.graph.json is hard-linked from cache');

  const warm = await compareWorkspaceIntent({
    root,
    outputDir: '.intent-workspace',
    includeDocumentationLlm: false,
  }, config);
  const normalizeComparison = (value: WorkspaceComparison): WorkspaceComparison => ({
    ...value,
    generatedAt: '2026-01-01T00:00:00.000Z',
    diff: {
      ...value.diff,
      generatedAt: '2026-01-01T00:00:00.000Z',
    },
    artifacts: {},
  });
  const coldRaw = JSON.stringify(normalizeComparison(await readJson<WorkspaceComparison>(path.join(root, cold.artifacts.comparison ?? ''))), null, 2);
  const warmRaw = JSON.stringify(normalizeComparison(await readJson<WorkspaceComparison>(path.join(root, warm.artifacts.comparison ?? ''))), null, 2);
  assert.equal(warmRaw, coldRaw, 'cache hit yields byte-identical comparison payload to cold run');
  const warmBaseManifest = await readJson<PipelineManifest>(path.join(root, warm.artifacts.baseManifest ?? ''));
  const coldBaseManifest = await readJson<PipelineManifest>(path.join(root, cold.artifacts.baseManifest ?? ''));
  assert.equal(warmBaseManifest.runId, coldBaseManifest.runId, 'cache hit reuses cached base run without rerunning base pipeline');

  // Corrupt the stored graph fingerprint -> must be detected and recomputed
  const tamperedGraph = await readJson<IntentGraph>(cachedGraphPath);
  await fs.unlink(cachedGraphPath);
  await writeJson(cachedGraphPath, { ...tamperedGraph, fingerprint: '0'.repeat(64) });
  const afterTamper = await compareWorkspaceIntent({
    root,
    outputDir: '.intent-workspace',
    includeDocumentationLlm: false,
  }, config);
  assert.equal(afterTamper.base.graphFingerprint, cold.base.graphFingerprint);
  const recomputedManifest = await readJson<PipelineManifest>(path.join(root, afterTamper.artifacts.baseManifest ?? ''));
  assert.notEqual(recomputedManifest.runId, coldBaseManifest.runId, 'corrupt fingerprint forced base pipeline recomputation');

  // Partial cache entry (missing diagnostics.json) -> must be detected and recomputed
  await fs.rm(path.join(cacheDir, 'diagnostics.json'), { force: true });
  const afterPartial = await compareWorkspaceIntent({
    root,
    outputDir: '.intent-workspace',
    includeDocumentationLlm: false,
  }, config);
  assert.equal(afterPartial.base.graphFingerprint, cold.base.graphFingerprint);
  const partialRecomputedManifest = await readJson<PipelineManifest>(path.join(root, afterPartial.artifacts.baseManifest ?? ''));
  assert.notEqual(partialRecomputedManifest.runId, recomputedManifest.runId, 'partial cache forced base pipeline recomputation');
});
