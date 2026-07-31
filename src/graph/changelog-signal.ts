import type { IntentRecord } from '../core/types.js';

const GENERATED_ANALYSIS_BASENAMES = new Set([
  'analysis.json',
  'analysis.toon',
  'analysis.toon.yaml',
  'analysis.yaml',
  'calls.mmd',
  'calls.png',
  'calls.toon',
  'calls.toon.yaml',
  'calls.yaml',
  'compact_flow.mmd',
  'compact_flow.png',
  'context.md',
  'dashboard.html',
  'duplication.toon',
  'duplication.toon.yaml',
  'evolution.toon',
  'evolution.toon.yaml',
  'flow.mmd',
  'flow.png',
  'flow.toon',
  'flow.toon.yaml',
  'index.html',
  'map.toon',
  'map.toon.yaml',
  'prompt.txt',
  'readme.md',
  'validation.toon',
  'validation.toon.yaml',
]);

/**
 * Whether a changelog record makes a release claim that should be grounded.
 *
 * Changelog generators also emit bookkeeping rows: placeholders, a compact
 * "... and N more files" continuation, and updates of todo2code/code2llm
 * analysis artifacts under the reserved project/ directory. Reporting those
 * as unsupported implementation claims hides real release discrepancies.
 *
 * The classifier is deliberately narrow. A behavioral update, including one
 * that names a documentation or source file, stays actionable.
 */
export function isActionableChangelogRecord(record: IntentRecord): boolean {
  if (record.source.kind !== 'changelog') return true;
  const text = record.statement.text.trim();
  if (isPlaceholder(text) || isFileSummary(text) || isFileOnlyUpdate(text)) return false;

  const paths = record.statement.target.paths;
  return paths.length === 0 || !paths.every(isGeneratedAnalysisPath);
}

function isPlaceholder(text: string): boolean {
  return /^(?:placeholder(?:\s+for\b.*)?|tbd|to be determined|n\/a|none|no (?:changes|updates)(?:\s+yet)?)[.!]?$/i.test(text);
}

function isFileSummary(text: string): boolean {
  return /^(?:\.\.\.|…)?\s*(?:and\s+)?\d+\s+more\s+files?[.!]?$/i.test(text);
}

/**
 * A bare "Update <file>" row records version-control mechanics, not behavior.
 *
 * Additional words are intentionally disqualifying: "Update runtime.ts to
 * reject invalid tokens" still makes an implementation claim. The token must
 * look like a path or conventional repository filename so prose such as
 * "Update support" remains actionable.
 */
function isFileOnlyUpdate(text: string): boolean {
  const match = text.match(/^update\s+`?([^`\s]+)`?[.!]?$/i);
  const candidate = match?.[1]?.replace(/[.!]$/, '') ?? '';
  if (!candidate || /^https?:/i.test(candidate)) return false;
  const basename = candidate.split('/').at(-1) ?? '';
  return candidate.includes('/')
    || basename.startsWith('.')
    || basename.includes('.')
    || ['Dockerfile', 'Jenkinsfile', 'Makefile'].includes(basename);
}

function isGeneratedAnalysisPath(value: string): boolean {
  const segments = value.trim().replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments[0]?.toLowerCase() !== 'project') return false;
  const basename = segments.at(-1)?.toLowerCase() ?? '';
  return GENERATED_ANALYSIS_BASENAMES.has(basename)
    || basename.endsWith('.toon')
    || basename.endsWith('.toon.yaml')
    || basename.endsWith('.mmd');
}
