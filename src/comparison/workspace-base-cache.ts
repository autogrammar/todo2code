import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { graphFingerprint, sha256, stableStringify } from '../core/id.js';
import { ensureDir, readJson, writeJson } from '../core/io.js';
import { assertIntentGraph } from '../core/schema.js';
import type { DiagnosticReport, IntentGraph, PipelineManifest, PipelineOptions } from '../core/types.js';
import { manifestConfiguration } from '../pipeline/run-helpers.js';
import type { PipelineResult } from '../pipeline/run.js';
import { T2C_VERSION } from '../version.js';
import { WORKSPACE_COMPARISON_GRAPH_MAX_BYTES } from './workspace-deadline.js';
import { git, scopedOutputDirectory } from './workspace-helpers.js';

export interface BasePipelineCacheKeyInput {
  baseTreeId: string;
  options: PipelineOptions;
  config: T2CConfig;
  t2cVersion?: string;
  extractorVersions?: Record<string, string>;
}

export interface CachedBaseRun {
  cacheKey: string;
  cacheDir: string;
  hit: boolean;
  graphPath: string;
  diagnosticsPath: string;
  graph: IntentGraph;
  diagnostics: DiagnosticReport;
  manifest: PipelineManifest;
}

export function defaultExtractorVersions(t2cVersion = T2C_VERSION): Record<string, string> {
  return {
    ast: t2cVersion,
    communication: t2cVersion,
    configuration: t2cVersion,
    documentation: t2cVersion,
    git: t2cVersion,
    markdown: t2cVersion,
    nl: t2cVersion,
    runtime: t2cVersion,
  };
}

export function computeBasePipelineCacheKey(input: BasePipelineCacheKeyInput): string {
  const version = (input.t2cVersion ?? T2C_VERSION).trim();
  const normalizedOptions: PipelineOptions = {
    ...input.options,
    root: '.',
    outputDir: '.intent-compare-base',
  };
  const configuration = manifestConfiguration(normalizedOptions, input.config);
  const extractors = {
    ...defaultExtractorVersions(version),
    ...(input.extractorVersions ?? {}),
  };
  return sha256(stableStringify({
    schema: 't2c.base-pipeline-cache/v1',
    baseTreeId: input.baseTreeId.trim(),
    t2cVersion: version,
    configuration,
    taskFile: input.options.taskFile ?? null,
    todoFile: input.options.todoFile ?? null,
    changelogFile: input.options.changelogFile ?? null,
    includeDocumentationLlm: Boolean(input.options.includeDocumentationLlm),
    extractorVersions: extractors,
  }));
}

export async function resolveBaseTreeId(
  repositoryRoot: string,
  baseCommit: string,
  relativeAnalysisRoot: string,
): Promise<string> {
  const normalizedSubpath = relativeAnalysisRoot.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const spec = normalizedSubpath ? `${baseCommit}:${normalizedSubpath}` : `${baseCommit}^{tree}`;
  return (await git(repositoryRoot, ['rev-parse', '--verify', spec])).trim();
}

export async function resolveBaseCacheDirectory(
  root: string,
  outputDir: string,
  requestedCacheDir: string | undefined,
  allowOutsideRoot: boolean,
  cacheKey: string,
): Promise<string> {
  if (requestedCacheDir && requestedCacheDir.trim()) {
    const scoped = await scopedOutputDirectory(root, requestedCacheDir.trim(), allowOutsideRoot);
    return path.resolve(root, scoped, 'base', cacheKey);
  }
  return path.resolve(root, outputDir, 'cache', 'base', cacheKey);
}

export async function readVerifiedCachedBaseRun(
  cacheDir: string,
  cacheKey: string,
): Promise<CachedBaseRun | null> {
  const graphPath = path.join(cacheDir, 'graph.json');
  const diagnosticsPath = path.join(cacheDir, 'diagnostics.json');
  const manifestPath = path.join(cacheDir, 'manifest.json');
  try {
    const [graph, diagnostics, manifest] = await Promise.all([
      readJson<IntentGraph>(graphPath, WORKSPACE_COMPARISON_GRAPH_MAX_BYTES),
      readJson<DiagnosticReport>(diagnosticsPath),
      readJson<PipelineManifest>(manifestPath),
    ]);
    assertIntentGraph(graph);
    if (graph.fingerprint !== graphFingerprint(graph.records, graph.relations)) {
      throw new Error('Stored base graph fingerprint does not match recomputed fingerprint');
    }
    if (
      !diagnostics
      || diagnostics.schemaVersion !== 't2c.diagnostics/v1'
      || !Array.isArray(diagnostics.diagnostics)
      || !diagnostics.counts
      || typeof diagnostics.counts.blocking !== 'number'
    ) {
      throw new Error('Invalid cached base diagnostics report');
    }
    if (
      !manifest
      || manifest.schemaVersion !== 't2c.run/v1'
      || !manifest.stages
      || typeof manifest.stages !== 'object'
    ) {
      throw new Error('Invalid cached base pipeline manifest');
    }
    return {
      cacheKey,
      cacheDir,
      hit: true,
      graphPath,
      diagnosticsPath,
      graph,
      diagnostics,
      manifest,
    };
  } catch {
    await fs.rm(cacheDir, { recursive: true, force: true }).catch(() => {});
    return null;
  }
}

export async function writeCachedBaseRun(
  cacheDir: string,
  cacheKey: string,
  baseRun: PipelineResult,
): Promise<CachedBaseRun> {
  const parentDir = path.dirname(cacheDir);
  await ensureDir(parentDir);
  const stagingDir = path.join(parentDir, `.staging-${cacheKey}-${process.pid}-${Date.now()}`);
  await ensureDir(stagingDir);
  try {
    const stagedGraphPath = path.join(stagingDir, 'graph.json');
    const stagedDiagnosticsPath = path.join(stagingDir, 'diagnostics.json');
    const stagedManifestPath = path.join(stagingDir, 'manifest.json');
    await Promise.all([
      linkOrCopyFile(baseRun.graphPath, stagedGraphPath),
      linkOrCopyFile(baseRun.diagnosticsPath, stagedDiagnosticsPath),
      writeJson(stagedManifestPath, baseRun.manifest),
    ]);
    await fs.rm(cacheDir, { recursive: true, force: true }).catch(() => {});
    try {
      await fs.rename(stagingDir, cacheDir);
    } catch {
      await ensureDir(cacheDir);
      await Promise.all([
        linkOrCopyFile(stagedGraphPath, path.join(cacheDir, 'graph.json')),
        linkOrCopyFile(stagedDiagnosticsPath, path.join(cacheDir, 'diagnostics.json')),
        linkOrCopyFile(stagedManifestPath, path.join(cacheDir, 'manifest.json')),
      ]);
    }
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
  }
  const graphPath = path.join(cacheDir, 'graph.json');
  const diagnosticsPath = path.join(cacheDir, 'diagnostics.json');
  const [graph, diagnostics] = await Promise.all([
    readJson<IntentGraph>(graphPath, WORKSPACE_COMPARISON_GRAPH_MAX_BYTES),
    readJson<DiagnosticReport>(diagnosticsPath),
  ]);
  return {
    cacheKey,
    cacheDir,
    hit: false,
    graphPath,
    diagnosticsPath,
    graph,
    diagnostics,
    manifest: baseRun.manifest,
  };
}

export async function linkOrCopyFile(sourcePath: string, targetPath: string): Promise<void> {
  await ensureDir(path.dirname(targetPath));
  await fs.rm(targetPath, { force: true }).catch(() => {});
  try {
    await fs.link(sourcePath, targetPath);
  } catch {
    await fs.copyFile(sourcePath, targetPath);
  }
}
