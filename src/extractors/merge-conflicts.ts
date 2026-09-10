import type { T2CConfig } from '../config/env.js';
import { createIntentId, sha256 } from '../core/id.js';
import { loadIgnoreMatcher } from '../core/ignore.js';
import { readText, relativePosix, walkFiles } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import type { ExtractionResult, IntentRecord } from '../core/types.js';

// Conflict grammar is independent of the language grammar it temporarily breaks.
// Restrict it to source/document/configuration formats accepted by the code editor.
const EXTENSIONS = ['.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.go', '.java',
  '.php', '.rs', '.md', '.json', '.toml', '.yaml', '.yml'];
interface Block { start: number; end: number; width: number; style: 'merge' | 'diff3' }
interface Marker { kind: string; width: number }

function marker(line: string): Marker | null {
  const match = /^([<|=>])\1{6,63}(?:[ \t].*)?$/.exec(line.replace(/\r$/, ''));
  if (!match) return null;
  const kind = match[1]!;
  const width = line.match(/^[<|=>]+/)![0].length;
  // A separator has no label. Labels are evidence, never paths or commands.
  if (kind === '=' && line.slice(width).trim()) return null;
  return { kind, width };
}

/** Parse complete, nonnested blocks; malformed input yields no partial facts. */
function blocks(lines: string[]): Block[] | null {
  const result: Block[] = [];
  let current: { start: number; width: number; phase: 'ours' | 'base' | 'theirs'; style: Block['style'] } | null = null;
  for (let index = 0; index < lines.length; index++) {
    const token = marker(lines[index]!);
    if (!token) continue;
    if (!current) {
      if (token.kind === '<') current = { start: index + 1, width: token.width, phase: 'ours', style: 'merge' };
      continue;
    }
    if (token.width !== current.width || token.kind === '<') return null;
    if (token.kind === '|' && current.phase === 'ours') {
      current.phase = 'base';
      current.style = 'diff3';
    } else if (token.kind === '=' && current.phase !== 'theirs') {
      current.phase = 'theirs';
    } else if (token.kind === '>' && current.phase === 'theirs') {
      result.push({ start: current.start, end: index + 1, width: current.width, style: current.style });
      current = null;
    } else return null;
  }
  return current ? null : result;
}

function conflictRecords(relative: string, body: string): IntentRecord[] | null {
  const lines = body.split('\n');
  const parsed = blocks(lines);
  if (!parsed) return null;
  return parsed.map((block) => {
    const excerpt = lines.slice(block.start - 1, block.end).join('\n');
    const blockHash = sha256(excerpt);
    const record = buildRecord({
      kind: 'merge_conflict_fact', action: 'block', object: 'unresolved conflict marker block',
      target: { paths: [relative], symbols: [] }, modality: 'observed',
      text: `conflict marker block in ${relative}:${block.start}-${block.end}`,
      lifecycle: 'blocked', sourceKind: 'git', sourcePath: relative,
      sourceLines: { start: block.start, end: block.end }, extractor: 't2c/merge-conflict-markers@1',
      rawExcerpt: excerpt.slice(0, 2000),
      epistemicClass: 'fact', confidence: 1, basis: ['complete_git_conflict_marker_grammar'],
      metadata: { llmUsed: false, gitIndexVerified: false, conflictStyle: block.style, markerWidth: block.width, blockSha256: blockHash },
    });
    return { ...record, id: createIntentId({ recordId: record.id, blockHash }, 'INT-GIT') };
  });
}

/** Observed marker syntax, not an assertion about Git state or a resolution choice. */
export async function extractMergeConflicts(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  const matcher = await loadIgnoreMatcher(root);
  const files = await walkFiles(root, { extensions: EXTENSIONS, maxFiles: 20_000, matcher });
  for (const file of files) {
    const relative = relativePosix(root, file);
    try {
      const body = await readText(file, config.maxFileBytes);
      if (body.includes('\0')) continue;
      const extracted = conflictRecords(relative, body);
      if (extracted === null) warnings.push(`${relative}: malformed merge conflict markers; no conflict evidence emitted`);
      else records.push(...extracted);
    } catch {
      warnings.push(`${relative}: conflict evidence could not be read within the source boundary`);
    }
  }
  return { records, warnings };
}
