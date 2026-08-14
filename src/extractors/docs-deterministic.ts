// Deterministic documentation -> Intent DSL baseline.
//
// Until now `document` records could only come from the OpenRouter extractor,
// so every offline run produced none. That is not merely a missing feature: it
// made documentation coverage unmeasurable in `make demo`, `examples:check` and
// any repository without a key, and left the whole documentation axis of
// Intent-vs-Reality dark.
//
// This converter claims far less than the LLM one. It records only what the
// Markdown structure states outright — a heading, a statement that names a file
// or symbol, or a fenced block that declares a language — and leaves semantic
// inference to the audited LLM stage layered on top.

import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { readText, relativePosix, resolveGlobs } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import { assertIntentRecords } from '../core/schema.js';
import {
  classifyActionHeuristically,
  detectModality,
  detectPolarity,
  extractBacktickValues,
  extractPaths,
  extractSymbols,
  extractTickets,
  extractVersions,
  inferObject,
} from '../core/text.js';
import type { ExtractionResult, IntentRecord } from '../core/types.js';
import { readListBlock } from './markdown-block.js';
import { createMarkdownPathResolver, type MarkdownPathResolver } from './markdown-paths.js';

const EXTRACTOR = 't2c/markdown-documentation@2';

/** Maps the raw path tokens of one statement onto repository-relative paths. */
type PathMapper = (paths: string[]) => string[];

/** Headings deeper than this are section decoration rather than a claim. */
const MAX_HEADING_LEVEL = 4;
/** Statements shorter than this carry no recoverable intent. */
const MIN_STATEMENT_CHARS = 24;

export interface DeterministicDocumentationOptions {
  root: string;
  /** Files to convert, already resolved by the caller's glob handling. */
  files: string[];
}

export interface Docs2DslOptions {
  root: string;
  /** Explicit repository-owned files. Relative values resolve below `root`. */
  files?: string[];
  /** Include patterns used only when `files` is omitted. */
  patterns?: string[];
  /** Exclude patterns used only when `files` is omitted. */
  excludes?: string[];
}

/**
 * Independently converts documentation into validated Intent DSL.
 *
 * Explicit files take precedence over patterns, including an explicitly empty
 * list. Pattern defaults come from the supplied configuration. The function
 * performs deterministic extraction only and never enters the LLM pipeline.
 */
export async function docs2dsl(
  options: Docs2DslOptions,
  config: T2CConfig,
): Promise<ExtractionResult> {
  const root = requireStandaloneRoot(options?.root, 'docs2dsl');
  const files = options.files === undefined
    ? await resolveGlobs(
      root,
      requireStringList(options.patterns ?? config.documentPatterns, 'docs2dsl.options.patterns'),
      requireStringList(options.excludes ?? config.documentExcludes, 'docs2dsl.options.excludes'),
    )
    : resolveOwnedFiles(root, requireStringList(options.files, 'docs2dsl.options.files'));
  const result = await extractDocumentationBaseline({ root, files }, config);
  assertIntentRecords(result.records);
  return result;
}

/**
 * Converts documentation files to `document` records without any LLM.
 *
 * Each file contributes at most one record per heading and one per qualifying
 * statement, keeping the output proportional to document structure rather than
 * to prose volume.
 */
export async function extractDocumentationBaseline(
  options: DeterministicDocumentationOptions,
  config: T2CConfig,
): Promise<ExtractionResult> {
  const root = path.resolve(options.root);
  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  const resolver = createMarkdownPathResolver(root);

  for (const file of options.files) {
    try {
      const body = await readText(file, config.maxFileBytes);
      records.push(...convertDocument(root, file, body, await primePathMapper(resolver, body)));
    } catch (error) {
      warnings.push(`${relativePosix(root, file)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { records, warnings };
}

/**
 * Documentation prose names files exactly the way TODO and CHANGELOG do, and
 * until now was the one Markdown converter that kept the shorthand. On
 * `if-uri/urirun` that left 59 records pointing at a root-level
 * `ARCHITECTURE.md` that does not exist while `docs/ARCHITECTURE.md` does.
 *
 * Statement conversion is synchronous, so each file's tokens are resolved once
 * up front and the parser consults the resulting map. A token the map does not
 * know keeps its raw form rather than disappearing.
 */
async function primePathMapper(resolver: MarkdownPathResolver, body: string): Promise<PathMapper> {
  const resolved = new Map<string, string | null>();
  for (const token of new Set(extractPaths(body))) {
    const [value] = await resolver.resolve([token]);
    resolved.set(token, value ?? null);
  }
  return (paths: string[]): string[] => [...new Set(paths.flatMap((value) => {
    const mapped = resolved.get(value);
    if (mapped === undefined) return [value];
    return mapped === null ? [] : [mapped];
  }))];
}

function convertDocument(root: string, filePath: string, body: string, resolvePaths: PathMapper): IntentRecord[] {
  const relative = relativePosix(root, filePath);
  const lines = body.split(/\r?\n/);
  const records: IntentRecord[] = [];
  const headings: string[] = [];
  let fence: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';

    // Fenced blocks are transparent to statement scanning: their content is
    // code, not documentation prose, and would otherwise produce records for
    // every commented line inside an example.
    const fenceMatch = raw.match(/^\s*(```+|~~~+)\s*([A-Za-z0-9_+-]*)/);
    if (fenceMatch) {
      const marker = fenceMatch[1] ?? '';
      if (fence === null) {
        fence = marker;
        const language = (fenceMatch[2] ?? '').trim();
        const record = codeBlockRecord(relative, headings, language, index + 1);
        if (record) records.push(record);
      } else if (marker.startsWith(fence.slice(0, 3))) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) continue;

    const heading = raw.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const title = heading[2]?.trim() ?? '';
      headings.splice(level - 1);
      headings[level - 1] = title;
      if (level <= MAX_HEADING_LEVEL && title) {
        records.push(statementRecord(relative, headings, title, { start: index + 1, end: index + 1 }, 'heading', resolvePaths));
      }
      continue;
    }

    const bullet = raw.match(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(.+?)\s*$/);
    if (bullet) {
      const block = readListBlock(lines, index, bullet[1] ?? '');
      index = block.endIndex;
      const record = qualifyingStatement(relative, headings, block.text, { start: block.startLine, end: block.endLine }, resolvePaths);
      if (record) records.push(record);
      continue;
    }

    if (raw.trim()) {
      // Prose wraps across lines. Reading one line at a time cuts sentences
      // mid-clause and drops the very words that name the target — the same
      // defect the TODO and CHANGELOG converters had.
      const paragraph = readParagraph(lines, index);
      index = paragraph.endIndex;
      const record = qualifyingStatement(
        relative,
        headings,
        paragraph.text,
        { start: paragraph.startLine, end: paragraph.endLine },
        resolvePaths,
      );
      if (record) records.push(record);
    }
  }

  return records;
}

/** Consecutive non-blank prose lines, joined into one statement. */
function readParagraph(lines: string[], index: number): {
  text: string;
  startLine: number;
  endLine: number;
  endIndex: number;
} {
  const parts: string[] = [(lines[index] ?? '').trim()];
  let cursor = index;
  for (let next = index + 1; next < lines.length; next += 1) {
    const line = lines[next] ?? '';
    if (!line.trim()) break;
    if (/^\s{0,3}#{1,6}\s/.test(line)) break;
    if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) break;
    if (/^\s*(?:```|~~~)/.test(line)) break;
    if (/^\s*\|/.test(line)) break;
    parts.push(line.trim());
    cursor = next;
  }
  return {
    text: parts.join(' ').replace(/\s+/g, ' ').trim(),
    startLine: index + 1,
    endLine: cursor + 1,
    endIndex: cursor,
  };
}

/**
 * Keeps a statement only when it names a concrete, checkable artifact.
 *
 * Requiring "any extracted symbol" is far too weak: `extractSymbols` also
 * returns prose acronyms such as `DSL`, `API` or `TypeScript`, which made
 * essentially every sentence in a README qualify — measured at 1 475 statement
 * records for 18 files. A path, a ticket or a backticked identifier is
 * something a reader can go and verify; a capitalised word in a sentence is not.
 */
function qualifyingStatement(
  sourcePath: string,
  headings: string[],
  text: string,
  lines: { start: number; end: number },
  resolvePaths: PathMapper,
): IntentRecord | null {
  if (text.length < MIN_STATEMENT_CHARS) return null;
  const target = targetsOf(text, resolvePaths);
  if (target.paths.length === 0 && target.tickets.length === 0 && !hasCodeSpanIdentifier(text)) return null;
  return statementRecord(sourcePath, headings, text, lines, 'reference', resolvePaths);
}

/** True when the text quotes an identifier in a code span, e.g. `validateContract`. */
function hasCodeSpanIdentifier(text: string): boolean {
  return extractBacktickValues(text).some((value) => /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value));
}

function statementRecord(
  sourcePath: string,
  headings: string[],
  text: string,
  lines: { start: number; end: number },
  origin: 'heading' | 'reference',
  resolvePaths: PathMapper,
): IntentRecord {
  const action = classifyActionHeuristically(text);
  return buildRecord({
    kind: 'documentation_statement',
    action,
    object: inferObject(text, action),
    target: targetsOf(text, resolvePaths),
    modality: detectModality(text),
    polarity: detectPolarity(text),
    text,
    lifecycle: 'proposed',
    sourceKind: 'document',
    sourcePath,
    sourceLines: lines,
    extractor: EXTRACTOR,
    rawExcerpt: text,
    epistemicClass: 'declaration',
    // Structural provenance only. The audited LLM stage is what may claim to
    // have understood the sentence; this converter claims to have read it.
    confidence: origin === 'heading' ? 0.55 : 0.62,
    basis: ['markdown_structure', origin === 'heading' ? 'heading_context' : 'explicit_target_reference'],
    metadata: {
      headingPath: headings.filter(Boolean),
      documentationOrigin: origin,
      llmUsed: false,
    },
  });
}

/** A fenced block states which language the document is talking about. */
function codeBlockRecord(
  sourcePath: string,
  headings: string[],
  language: string,
  line: number,
): IntentRecord | null {
  if (!language) return null;
  const text = `Documented ${language} example`;
  return buildRecord({
    kind: 'documentation_example',
    action: 'document',
    object: `${language} example`,
    target: { paths: [], symbols: [], tickets: [], versions: [] },
    modality: 'unknown',
    polarity: 'positive',
    text,
    lifecycle: 'proposed',
    sourceKind: 'document',
    sourcePath,
    sourceLines: { start: line, end: line },
    extractor: EXTRACTOR,
    rawExcerpt: text,
    epistemicClass: 'declaration',
    confidence: 0.5,
    basis: ['markdown_structure', 'fenced_code_block'],
    metadata: {
      headingPath: headings.filter(Boolean),
      documentationOrigin: 'code_block',
      language,
      llmUsed: false,
    },
  });
}

function targetsOf(
  text: string,
  resolvePaths: PathMapper,
): { paths: string[]; symbols: string[]; tickets: string[]; versions: string[] } {
  return {
    paths: resolvePaths(extractPaths(text)),
    symbols: extractSymbols(text),
    tickets: extractTickets(text),
    versions: extractVersions(text),
  };
}

function requireStandaloneRoot(value: unknown, api: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${api}.options.root must be a non-empty string`);
  }
  return path.resolve(value);
}

function requireStringList(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new TypeError(`${name} must be an array of non-empty strings`);
  }
  return value;
}

function resolveOwnedFiles(root: string, files: string[]): string[] {
  return [...new Set(files.map((file) => {
    const absolute = path.resolve(root, file);
    const relative = path.relative(root, absolute);
    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      if (relative) throw new Error(`docs2dsl.options.files must stay inside root: ${file}`);
    }
    return absolute;
  }))].sort();
}
