import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { resolveGlobs } from '../core/io.js';
import { OPENROUTER_TIMEOUT_POLICY } from '../llm/openrouter-timeout.js';
import { assertNonNegativeInteger } from './workspace-helpers.js';
import type {
  WorkspaceComparisonDeadlineDecision,
  WorkspaceComparisonDeadlineLoad,
  WorkspaceComparisonOptions,
} from './workspace-types.js';

export const WORKSPACE_COMPARISON_DEADLINE_POLICY = Object.freeze({
  inputBytesBaseline: 128 * 1024,
  llmWorkUnitsBaseline: 16,
  scaleFactor: 2,
  maximumMultiplier: 4,
  maximumDeadlineMs: 40 * 60 * 1000,
});

// Generated graphs are denser than their source records. Platform currently
// produces a ~136 MiB graph, so the generic 128 MiB JSON ceiling rejects an
// artifact that the bounded pipeline has just produced. Keep a separate,
// explicit ceiling for the two comparison graphs instead of weakening the
// default limit for every JSON consumer.
export const WORKSPACE_COMPARISON_GRAPH_MAX_BYTES = 256 * 1024 * 1024;

/** Bound the two-pipeline operation, not only each individual provider call. */
export function calculateWorkspaceComparisonDeadline(
  load: WorkspaceComparisonDeadlineLoad,
): WorkspaceComparisonDeadlineDecision {
  assertNonNegativeInteger(load.inputBytes, 'input bytes');
  assertNonNegativeInteger(load.llmWorkUnits, 'LLM work units');
  const baseDeadlineMs = OPENROUTER_TIMEOUT_POLICY.maximumTimeoutMs;
  const pressure = Math.max(
    1,
    load.inputBytes / WORKSPACE_COMPARISON_DEADLINE_POLICY.inputBytesBaseline,
    load.llmWorkUnits / WORKSPACE_COMPARISON_DEADLINE_POLICY.llmWorkUnitsBaseline,
  );
  const steps = pressure <= 1 ? 0 : Math.ceil(Math.log2(pressure));
  const multiplier = Math.min(
    WORKSPACE_COMPARISON_DEADLINE_POLICY.maximumMultiplier,
    WORKSPACE_COMPARISON_DEADLINE_POLICY.scaleFactor ** steps,
  );
  const scaledDeadlineMs = baseDeadlineMs * multiplier;
  const effectiveDeadlineMs = Math.min(
    WORKSPACE_COMPARISON_DEADLINE_POLICY.maximumDeadlineMs,
    scaledDeadlineMs,
  );
  const capped = effectiveDeadlineMs < scaledDeadlineMs;
  return {
    ...load,
    baseDeadlineMs,
    pressure,
    multiplier,
    effectiveDeadlineMs,
    capped,
  };
}

export async function workspaceComparisonDeadlineLoad(
  root: string,
  options: WorkspaceComparisonOptions,
  config: T2CConfig,
): Promise<WorkspaceComparisonDeadlineLoad> {
  const files = new Set<string>();
  const addIfPresent = async (file: string | null | undefined): Promise<void> => {
    if (!file) return;
    const absolute = path.resolve(root, file);
    const relative = path.relative(root, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return;
    try {
      if ((await fs.stat(absolute)).isFile()) files.add(absolute);
    } catch {
      // Missing optional inputs are skipped by the pipeline too.
    }
  };
  await Promise.all([
    addIfPresent(options.taskFile),
    addIfPresent(options.todoFile === undefined ? 'TODO.md' : options.todoFile),
    addIfPresent(options.changelogFile === undefined ? 'CHANGELOG.md' : options.changelogFile),
  ]);
  const documentFiles = await resolveGlobs(
    root,
    options.documentPatterns ?? config.documentPatterns,
    options.documentExcludes ?? config.documentExcludes,
  );
  const documentFileSet = new Set(documentFiles);
  for (const file of documentFiles) files.add(file);

  let inputBytes = 0;
  let documentChunks = 0;
  for (const file of files) {
    const size = (await fs.stat(file)).size;
    inputBytes += size;
    if (documentFileSet.has(file)) {
      documentChunks += Math.min(config.documentMaxChunks, Math.max(1, Math.ceil(size / config.documentChunkChars)));
    }
  }
  const markdownMode = options.markdownMode ?? config.markdownMode;
  const communicationMode = options.communicationMode ?? config.communicationMode;
  const semanticUnitsPerPipeline = (options.includeDocumentationLlm ? documentChunks : 0)
    + (markdownMode === 'deterministic' ? 0 : 2)
    + (config.nlMode === 'deterministic' || !options.taskFile ? 0 : 1)
    + (communicationMode === 'deterministic' ? 0 : 1);
  return {
    inputBytes: inputBytes * 2,
    llmWorkUnits: semanticUnitsPerPipeline * 2,
  };
}
