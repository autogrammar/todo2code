import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { pathExists, readText, relativePosix, resolveGlobs } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import type { ExtractionResult, IntentAction, IntentRecord, LifecycleStatus, Modality, Polarity } from '../core/types.js';
import { OpenRouterClient } from '../llm/openrouter.js';

interface RawDocumentRecord {
  kind: string;
  actor: string | null;
  action: IntentAction;
  subject: string | null;
  object: string;
  modality: Modality;
  polarity: Polarity;
  lifecycle: LifecycleStatus;
  confidence: number;
  basis: string[];
  target: {
    paths: string[];
    symbols: string[];
    tickets: string[];
    versions: string[];
  };
  sourceLines: { start: number; end: number };
  text: string;
}

interface DocumentResponse {
  records: RawDocumentRecord[];
}

interface DocumentChunk {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
}

export interface DocumentationExtractionOptions {
  root: string;
  patterns: string[];
  excludes?: string[];
}

export async function extractDocumentationIntent(options: DocumentationExtractionOptions, config: T2CConfig): Promise<ExtractionResult> {
  const client = new OpenRouterClient(config.openRouter);
  if (!client.isConfigured()) throw new Error('OPENROUTER_API_KEY is required for documentation -> Intent DSL');
  const files = await resolveGlobs(options.root, options.patterns, options.excludes ?? config.documentExcludes);
  const systemPrompt = await readPrompt('docs-to-intent.system.md');
  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  const documentChunks: DocumentChunk[] = [];

  for (const file of files) {
    let body: string;
    try {
      body = await readText(file, config.maxFileBytes);
    } catch (error) {
      warnings.push(`${relativePosix(options.root, file)}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const relative = relativePosix(options.root, file);
    documentChunks.push(...chunkMarkdown(relative, body, 16_000));
  }

  const results = await mapConcurrent(documentChunks, config.documentConcurrency, async (chunk) => {
    const chunkRecords: IntentRecord[] = [];
    const chunkWarnings: string[] = [];
    try {
      const response = await client.chatJson<DocumentResponse>([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            sourcePath: chunk.path,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            content: chunk.content,
          }),
        },
      ], 't2c_document_intent', documentResponseSchema(), config.openRouter.documentModel);
      for (const raw of response.records ?? []) chunkRecords.push(toIntentRecord(raw, chunk, config.openRouter.documentModel));
    } catch (error) {
      chunkWarnings.push(`${chunk.path}:${chunk.startLine}-${chunk.endLine}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { records: chunkRecords, warnings: chunkWarnings };
  });

  for (const result of results) {
    records.push(...result.records);
    warnings.push(...result.warnings);
  }
  return { records, warnings };
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) results[index] = await mapper(item, index);
    }
  };
  const workerCount = Math.min(items.length, Math.max(1, Math.trunc(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function toIntentRecord(raw: RawDocumentRecord, chunk: DocumentChunk, model: string): IntentRecord {
  const start = clampLine(raw.sourceLines?.start ?? chunk.startLine, chunk.startLine, chunk.endLine);
  const end = clampLine(raw.sourceLines?.end ?? start, start, chunk.endLine);
  const action = allowedAction(raw.action) ? raw.action : 'unknown';
  return buildRecord({
    kind: raw.kind || 'documented_intent',
    actor: raw.actor ?? null,
    action,
    subject: raw.subject ?? null,
    object: raw.object || raw.text || 'unspecified',
    target: {
      paths: [...new Set([...(raw.target?.paths ?? []), chunk.path])],
      symbols: raw.target?.symbols ?? [],
      tickets: raw.target?.tickets ?? [],
      versions: raw.target?.versions ?? [],
    },
    modality: allowedModality(raw.modality) ? raw.modality : 'unknown',
    polarity: raw.polarity === 'negative' ? 'negative' : 'positive',
    text: raw.text || raw.object,
    lifecycle: allowedLifecycle(raw.lifecycle) ? raw.lifecycle : 'proposed',
    sourceKind: 'document',
    sourcePath: chunk.path,
    sourceLines: { start, end },
    extractor: 't2c/document-openrouter@1',
    rawExcerpt: linesFromChunk(chunk, start, end),
    epistemicClass: 'llm_inference',
    confidence: Math.min(0.85, Math.max(0.05, Number(raw.confidence) || 0.5)),
    basis: [...new Set(['openrouter_structured_extraction', ...(raw.basis ?? [])])],
    metadata: {
      model,
      llmUsed: true,
      chunkStartLine: chunk.startLine,
      chunkEndLine: chunk.endLine,
    },
  });
}

function chunkMarkdown(relativePath: string, body: string, maxChars: number): DocumentChunk[] {
  const lines = body.split(/\r?\n/);
  const sections: Array<{ start: number; end: number }> = [];
  let sectionStart = 1;
  for (let index = 1; index < lines.length; index += 1) {
    if (/^\s{0,3}#{1,6}\s+/.test(lines[index] ?? '')) {
      sections.push({ start: sectionStart, end: index });
      sectionStart = index + 1;
    }
  }
  sections.push({ start: sectionStart, end: lines.length });

  const chunks: DocumentChunk[] = [];
  let currentStart = 1;
  let currentEnd = 0;
  let current: string[] = [];
  const flush = (): void => {
    if (!current.length) return;
    chunks.push({ path: relativePath, startLine: currentStart, endLine: currentEnd, content: current.join('\n') });
    current = [];
  };

  for (const section of sections) {
    const sectionLines = lines.slice(section.start - 1, section.end);
    const sectionText = sectionLines.join('\n');
    if (sectionText.length > maxChars) {
      flush();
      for (let offset = 0; offset < sectionLines.length; ) {
        const batch: string[] = [];
        let size = 0;
        const batchStart = section.start + offset;
        while (offset < sectionLines.length && size + (sectionLines[offset]?.length ?? 0) + 1 <= maxChars) {
          const line = sectionLines[offset] ?? '';
          batch.push(line);
          size += line.length + 1;
          offset += 1;
        }
        if (!batch.length) {
          batch.push((sectionLines[offset] ?? '').slice(0, maxChars));
          offset += 1;
        }
        chunks.push({ path: relativePath, startLine: batchStart, endLine: batchStart + batch.length - 1, content: batch.join('\n') });
      }
      continue;
    }
    const candidateSize = current.join('\n').length + sectionText.length + 1;
    if (current.length && candidateSize > maxChars) flush();
    if (!current.length) currentStart = section.start;
    current.push(...sectionLines);
    currentEnd = section.end;
  }
  flush();
  return chunks.filter((chunk) => chunk.content.trim());
}

function linesFromChunk(chunk: DocumentChunk, start: number, end: number): string {
  const lines = chunk.content.split(/\r?\n/);
  const relativeStart = Math.max(0, start - chunk.startLine);
  const relativeEnd = Math.min(lines.length, end - chunk.startLine + 1);
  return lines.slice(relativeStart, relativeEnd).join('\n').slice(0, 2000);
}

async function readPrompt(name: string): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', name);
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}

function clampLine(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function allowedAction(value: string): value is IntentAction {
  return ['add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate', 'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown'].includes(value);
}

function allowedModality(value: string): value is Modality {
  return ['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown'].includes(value);
}

function allowedLifecycle(value: string): value is LifecycleStatus {
  return ['proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown'].includes(value);
}

function documentResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['records'],
    properties: {
      records: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'actor', 'action', 'subject', 'object', 'modality', 'polarity', 'lifecycle', 'confidence', 'basis', 'target', 'sourceLines', 'text'],
          properties: {
            kind: { type: 'string' },
            actor: { type: ['string', 'null'] },
            action: { type: 'string', enum: ['add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate', 'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown'] },
            subject: { type: ['string', 'null'] },
            object: { type: 'string' },
            modality: { type: 'string', enum: ['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown'] },
            polarity: { type: 'string', enum: ['positive', 'negative'] },
            lifecycle: { type: 'string', enum: ['proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown'] },
            confidence: { type: 'number', minimum: 0, maximum: 0.85 },
            basis: { type: 'array', items: { type: 'string' } },
            target: {
              type: 'object',
              additionalProperties: false,
              required: ['paths', 'symbols', 'tickets', 'versions'],
              properties: {
                paths: { type: 'array', items: { type: 'string' } },
                symbols: { type: 'array', items: { type: 'string' } },
                tickets: { type: 'array', items: { type: 'string' } },
                versions: { type: 'array', items: { type: 'string' } },
              },
            },
            sourceLines: {
              type: 'object',
              additionalProperties: false,
              required: ['start', 'end'],
              properties: { start: { type: 'integer', minimum: 1 }, end: { type: 'integer', minimum: 1 } },
            },
            text: { type: 'string' },
          },
        },
      },
    },
  };
}
