import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { pathExists, readText, relativePosix } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import {
  detectPolarity,
  extractPaths,
  extractSymbols,
  extractTickets,
  extractVersions,
  inferObject,
} from '../core/text.js';
import type { ExtractionResult, IntentAction, IntentRecord } from '../core/types.js';
import { readListBlock } from './markdown-block.js';

/** Deterministic CHANGELOG.md -> Intent DSL converter. */
export async function extractChangelog(root: string, changelogPath: string, config: T2CConfig): Promise<ExtractionResult> {
  const absolute = path.resolve(root, changelogPath);
  if (!(await pathExists(absolute))) return { records: [], warnings: [`CHANGELOG file not found: ${changelogPath}`] };
  const body = await readText(absolute, config.maxFileBytes);
  const relative = relativePosix(root, absolute);
  const records: IntentRecord[] = [];
  const lines = body.split(/\r?\n/);
  let version: string | null = null;
  let releaseDate: string | null = null;
  let category = 'Changed';

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const versionHeading = raw.match(/^\s*##\s+\[?([^\]\s]+)\]?\s*(?:[-–—]\s*(\d{4}-\d{2}-\d{2}))?/);
    if (versionHeading) {
      version = versionHeading[1] ?? null;
      releaseDate = versionHeading[2] ?? null;
      continue;
    }
    const categoryHeading = raw.match(/^\s*###\s+(.+?)\s*#*\s*$/);
    if (categoryHeading) {
      category = categoryHeading[1]?.trim() ?? 'Changed';
      continue;
    }
    const bullet = raw.match(/^\s*[-*+]\s+(.+?)\s*$/);
    if (!bullet || !version) continue;
    const block = readListBlock(lines, index, bullet[1] ?? '');
    index = block.endIndex;
    const text = block.text;
    const action = changelogAction(category, text);
    records.push(buildRecord({
      kind: 'changelog_entry',
      action,
      subject: `release:${version}`,
      object: inferObject(text, action),
      target: {
        paths: extractPaths(text),
        symbols: extractSymbols(text),
        tickets: extractTickets(text),
        versions: [version, ...extractVersions(text)],
      },
      modality: 'claimed',
      polarity: detectPolarity(text),
      text,
      lifecycle: version.toLowerCase() === 'unreleased' ? 'proposed' : 'released',
      sourceKind: 'changelog',
      sourcePath: relative,
      sourceLines: { start: block.startLine, end: block.endLine },
      extractor: 't2c/markdown-changelog@1',
      rawExcerpt: block.raw.join('\n'),
      epistemicClass: 'claim',
      confidence: 0.92,
      basis: ['markdown_release_heading', 'keep_a_changelog_category'],
      observedAt: releaseDate ? `${releaseDate}T00:00:00.000Z` : null,
      metadata: { version, releaseDate, category, llmUsed: false },
    }));
  }
  return { records, warnings: records.length ? [] : [`No versioned changelog entries found in ${relative}`] };
}

function changelogAction(category: string, text: string): IntentAction {
  const normalized = category.toLowerCase();
  if (normalized.includes('add')) return 'add';
  if (normalized.includes('fix') || normalized.includes('secur')) return 'fix';
  if (normalized.includes('remov') || normalized.includes('deprecat')) return 'remove';
  if (normalized.includes('document')) return 'document';
  if (normalized.includes('test')) return 'test';
  if (normalized.includes('change')) return 'change';
  const lower = text.toLowerCase();
  if (/\badd|new|doda/.test(lower)) return 'add';
  if (/\bfix|napraw|popraw/.test(lower)) return 'fix';
  return 'release';
}
