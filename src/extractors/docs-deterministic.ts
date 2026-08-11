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
import { readText, relativePosix } from '../core/io.js';
import { sha256 } from '../core/id.js';
import { buildRecord } from '../core/record.js';
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
import type { ExtractionResult, IntentRecord, JsonValue } from '../core/types.js';
import { readListBlock } from './markdown-block.js';
import { createMarkdownPathResolver, type MarkdownPathResolver } from './markdown-paths.js';

const EXTRACTOR = 't2c/markdown-documentation@2';
const F2MD_EXTRACTOR = 't2c/f2md-document-structure@1';
const F2MD_STRUCTURE_SCHEMA = 'bioxfoundry.document-structure/v1';

type F2mdBbox = [number, number, number, number];

interface F2mdBlock {
  id: string;
  type: string;
  page: number;
  pages?: number[];
  bbox: F2mdBbox | null;
  semantic: boolean;
  confidence: number | null;
  normalizedText: string;
  artifactUrn?: string;
  artifactId?: string;
  level?: number;
  language?: string;
  reason?: string;
  asset?: string;
  assetSha256?: string;
}

interface F2mdDocumentStructure {
  schema: typeof F2MD_STRUCTURE_SCHEMA;
  source: string;
  sourceSha256: string;
  rawMarkdownSha256: string;
  canonicalMarkdownSha256: string;
  sourceModel?: string;
  documentAstSha256?: string;
  pages: Array<{ number: number; width?: number | null; height?: number | null }>;
  blocks: F2mdBlock[];
}

interface F2mdConversionContext {
  sourcePath: string;
  sidecarPath: string;
  structure: F2mdDocumentStructure;
  resolvePaths: PathMapper;
}

type F2mdSidecarResult =
  | { state: 'missing' }
  | { state: 'invalid'; path: string; reason: string }
  | { state: 'valid'; path: string; structure: F2mdDocumentStructure };

const F2MD_BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'list', 'table', 'figure', 'diagram', 'code',
  'equation', 'chart', 'caption', 'navigation',
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ARTIFACT_URN_PATTERN = /^urn:subactor:artifact:sha256:[a-f0-9]{64}$/;

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
      const sidecar = await readF2mdSidecar(file, body, config.maxFileBytes);
      if (sidecar.state === 'invalid') {
        warnings.push(`${relativePosix(root, sidecar.path)}: ${sidecar.reason}`);
        continue;
      }
      const resolvePaths = await primePathMapper(resolver, body);
      if (sidecar.state === 'valid') {
        records.push(...convertF2mdStructure(root, file, sidecar.path, sidecar.structure, resolvePaths));
      } else {
        records.push(...convertDocument(root, file, body, resolvePaths));
      }
    } catch (error) {
      warnings.push(`${relativePosix(root, file)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { records, warnings };
}

/** A tree conversion writes `report.pdf.md` beside `report.pdf.structure.json`. */
const f2mdSidecarPath = (filePath: string): string | null => (
  filePath.toLowerCase().endsWith('.md') ? `${filePath.slice(0, -3)}.structure.json` : null
);

const readF2mdSidecar = async (
  filePath: string,
  markdown: string,
  maxBytes: number,
): Promise<F2mdSidecarResult> => {
  const sidecarPath = f2mdSidecarPath(filePath);
  if (sidecarPath === null) return { state: 'missing' };
  let raw: string;
  try {
    raw = await readText(sidecarPath, maxBytes);
  } catch (error) {
    if (isMissingFileError(error)) return { state: 'missing' };
    return { state: 'invalid', path: sidecarPath, reason: describeError(error) };
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch (error) {
    return { state: 'invalid', path: sidecarPath, reason: `invalid JSON: ${describeError(error)}` };
  }
  const issue = validateF2mdStructure(candidate);
  if (issue !== null) return { state: 'invalid', path: sidecarPath, reason: issue };
  const structure = candidate as F2mdDocumentStructure;
  const actualHash = sha256(canonicalMarkdownBody(markdown));
  if (actualHash !== structure.canonicalMarkdownSha256) {
    return {
      state: 'invalid',
      path: sidecarPath,
      reason: `canonical Markdown hash mismatch: expected ${structure.canonicalMarkdownSha256}, got ${actualHash}`,
    };
  }
  return { state: 'valid', path: sidecarPath, structure };
};

/** f2md hashes its Markdown projection before the tree writer adds provenance front matter. */
const canonicalMarkdownBody = (markdown: string): string => {
  const envelope = markdown.match(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---\r?\n(?:\r?\n)?/);
  return envelope ? markdown.slice(envelope[0].length) : markdown;
};

const validateF2mdStructure = (value: unknown): string | null => {
  if (!isObject(value)) return 'invalid f2md structure: expected an object';
  if (value.schema !== F2MD_STRUCTURE_SCHEMA) return `unsupported f2md structure schema: ${String(value.schema)}`;
  const headerIssue = validateF2mdHeader(value);
  if (headerIssue !== null) return `invalid f2md structure: ${headerIssue}`;
  if (!Array.isArray(value.pages) || !value.pages.every(validF2mdPage)) {
    return 'invalid f2md structure: pages must contain valid page descriptors';
  }
  return validateF2mdBlocks(value.blocks);
};

const validateF2mdHeader = (value: Record<string, unknown>): string | null => {
  for (const field of ['sourceSha256', 'rawMarkdownSha256', 'canonicalMarkdownSha256'] as const) {
    if (!isSha256(value[field])) return `${field} must be a lowercase SHA-256`;
  }
  if (typeof value.source !== 'string' || value.source.length === 0) {
    return 'source must be a non-empty string';
  }
  if (!validOptionalHash(value.documentAstSha256)) {
    return 'documentAstSha256 must be a lowercase SHA-256 when present';
  }
  if (value.sourceModel !== undefined && typeof value.sourceModel !== 'string') {
    return 'sourceModel must be a string when present';
  }
  return null;
};

const validateF2mdBlocks = (value: unknown): string | null => {
  if (!Array.isArray(value)) return 'invalid f2md structure: blocks must be an array';
  const ids = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const block = value[index];
    const issue = validateF2mdBlock(block);
    if (issue !== null) return `invalid f2md structure: blocks[${index}] ${issue}`;
    const id = (block as Record<string, unknown>).id as string;
    if (ids.has(id)) return `invalid f2md structure: blocks[${index}] duplicates id ${id}`;
    ids.add(id);
  }
  return null;
};

const validF2mdPage = (value: unknown): boolean => {
  if (!isObject(value) || !isPositiveInteger(value.number)) return false;
  return validOptionalDimension(value.width) && validOptionalDimension(value.height);
};

const validateF2mdBlock = (value: unknown): string | null => {
  if (!isObject(value)) return 'must be an object';
  return validateF2mdBlockIdentity(value)
    ?? validateF2mdBlockLocation(value)
    ?? validateF2mdBlockContent(value)
    ?? validateF2mdBlockOptionals(value);
};

const validateF2mdBlockIdentity = (value: Record<string, unknown>): string | null => {
  if (typeof value.id !== 'string' || !/^block-[a-f0-9]{16}$/.test(value.id)) return 'has an invalid id';
  if (typeof value.type !== 'string' || !F2MD_BLOCK_TYPES.has(value.type)) return 'has an unsupported type';
  if (!isPositiveInteger(value.page)) return 'has an invalid page';
  return null;
};

const validateF2mdBlockLocation = (value: Record<string, unknown>): string | null => {
  if (value.pages !== undefined && (!Array.isArray(value.pages) || !value.pages.every(isPositiveInteger))) {
    return 'has invalid pages';
  }
  if (!validBbox(value.bbox)) return 'has an invalid bbox';
  return null;
};

const validateF2mdBlockContent = (value: Record<string, unknown>): string | null => {
  if (typeof value.semantic !== 'boolean') return 'has an invalid semantic flag';
  if (!validConfidence(value.confidence)) return 'has invalid confidence';
  if (typeof value.normalizedText !== 'string') return 'has invalid normalizedText';
  if (value.type === 'heading' && (!Number.isInteger(value.level) || Number(value.level) < 1 || Number(value.level) > 6)) {
    return 'has an invalid heading level';
  }
  return null;
};

const validateF2mdBlockOptionals = (value: Record<string, unknown>): string | null => {
  if (!validOptionalString(value.language) || !validOptionalString(value.reason)
    || !validOptionalString(value.artifactId) || !validOptionalString(value.asset)) {
    return 'has an invalid optional string field';
  }
  if (value.artifactUrn !== undefined
    && (typeof value.artifactUrn !== 'string' || !ARTIFACT_URN_PATTERN.test(value.artifactUrn))) {
    return 'has an invalid artifactUrn';
  }
  if (!validOptionalHash(value.assetSha256)) return 'has an invalid assetSha256';
  return null;
};

const convertF2mdStructure = (
  root: string,
  filePath: string,
  sidecarPath: string,
  structure: F2mdDocumentStructure,
  resolvePaths: PathMapper,
): IntentRecord[] => {
  const sourcePath = relativePosix(root, filePath);
  const context: F2mdConversionContext = {
    sourcePath,
    sidecarPath: relativePosix(root, sidecarPath),
    structure,
    resolvePaths,
  };
  const headings: string[] = [];
  const records: IntentRecord[] = [];
  for (const block of structure.blocks) {
    if (!block.semantic || block.type === 'navigation' || !block.normalizedText.trim()) continue;
    if (block.type === 'heading') {
      const level = block.level ?? 1;
      headings.splice(level - 1);
      headings[level - 1] = block.normalizedText.trim();
    }
    records.push(f2mdBlockRecord(context, headings, block));
  }
  return records;
};

const f2mdBlockRecord = (
  context: F2mdConversionContext,
  headings: string[],
  block: F2mdBlock,
): IntentRecord => {
  const text = block.normalizedText;
  const action = classifyActionHeuristically(text);
  return buildRecord({
    kind: block.type === 'code' ? 'documentation_example' : 'documentation_statement',
    action,
    object: inferObject(text, action),
    target: targetsOf(text, context.resolvePaths),
    modality: detectModality(text),
    polarity: detectPolarity(text),
    text,
    lifecycle: 'proposed',
    sourceKind: 'document',
    sourcePath: context.sourcePath,
    sourceLines: null,
    revision: context.structure.canonicalMarkdownSha256,
    symbol: block.id,
    extractor: F2MD_EXTRACTOR,
    rawExcerpt: text,
    epistemicClass: 'declaration',
    confidence: block.confidence ?? (block.type === 'heading' ? 0.75 : 0.8),
    basis: ['f2md_document_structure', 'semantic_block', 'source_content_hash_match'],
    metadata: {
      headingPath: headings.filter(Boolean),
      documentationOrigin: 'f2md_structure',
      documentAnchor: f2mdDocumentAnchor(context.sidecarPath, block, context.structure),
      llmUsed: false,
    },
  });
};

const f2mdDocumentAnchor = (
  sidecarPath: string,
  block: F2mdBlock,
  structure: F2mdDocumentStructure,
): Record<string, JsonValue> => {
  const anchor: Record<string, JsonValue> = {
    structureSchema: structure.schema,
    sidecarPath,
    source: structure.source,
    sourceSha256: structure.sourceSha256,
    rawMarkdownSha256: structure.rawMarkdownSha256,
    canonicalMarkdownSha256: structure.canonicalMarkdownSha256,
    blockId: block.id,
    blockType: block.type,
    page: block.page,
    pages: block.pages ?? [block.page],
    bbox: block.bbox,
    confidence: block.confidence,
  };
  addAnchorValue(anchor, 'sourceModel', structure.sourceModel);
  addAnchorValue(anchor, 'documentAstSha256', structure.documentAstSha256);
  addAnchorValue(anchor, 'artifactUrn', block.artifactUrn);
  addAnchorValue(anchor, 'artifactId', block.artifactId);
  addAnchorValue(anchor, 'level', block.level);
  addAnchorValue(anchor, 'language', block.language);
  addAnchorValue(anchor, 'reason', block.reason);
  addAnchorValue(anchor, 'asset', block.asset);
  addAnchorValue(anchor, 'assetSha256', block.assetSha256);
  return anchor;
};

const addAnchorValue = (target: Record<string, JsonValue>, key: string, value: JsonValue | undefined): void => {
  if (value !== undefined) target[key] = value;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const isSha256 = (value: unknown): value is string => {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
};

const validOptionalHash = (value: unknown): boolean => {
  return value === undefined || isSha256(value);
};

const validOptionalString = (value: unknown): boolean => {
  return value === undefined || typeof value === 'string';
};

const validOptionalDimension = (value: unknown): boolean => {
  return value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
};

const isPositiveInteger = (value: unknown): value is number => {
  return Number.isInteger(value) && Number(value) >= 1;
};

const validBbox = (value: unknown): value is F2mdBbox | null => {
  return value === null || (Array.isArray(value) && value.length === 4
    && value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)));
};

const validConfidence = (value: unknown): value is number | null => {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
};

const isMissingFileError = (error: unknown): boolean => {
  return isObject(error) && error.code === 'ENOENT';
};

const describeError = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

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
