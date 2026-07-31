import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { pathExists, readText, relativePosix, resolveGlobs } from '../core/io.js';
import type { IntentRecord, LlmResponseMetadata, PipelineStageAudit } from '../core/types.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import { T2C_VERSION } from '../version.js';
import { chunkMarkdown, mapConcurrent, prioritizeDocumentChunks } from './docs-chunks.js';
import { toDocumentIntentRecord } from './docs-record.js';
import { documentResponseContract } from './docs-schema.js';
import type {
  DocumentChunk,
  DocumentChunkResult,
  DocumentationExtractionOptions,
  DocumentationExtractionResult,
  DocumentationTargetHints,
} from './docs-types.js';

export type {
  DocumentationExtractionOptions,
  DocumentationExtractionResult,
  DocumentationTargetHints,
} from './docs-types.js';

const EMPTY_HINTS: DocumentationTargetHints = {
  paths: [],
  symbols: [],
  tickets: [],
  versions: [],
};

export class DocumentationLlmRequiredError extends Error {
  constructor(message: string, readonly audit: PipelineStageAudit) {
    super(message);
    this.name = 'DocumentationLlmRequiredError';
  }
}

export async function extractDocumentationIntent(
  options: DocumentationExtractionOptions,
  config: T2CConfig,
): Promise<DocumentationExtractionResult> {
  const startedAt = Date.now();
  const client = new OpenRouterClient({ ...config.openRouter, timeoutMs: config.documentTimeoutMs });
  requireConfiguredClient(client, config, startedAt);

  const warnings: string[] = [];
  const chunks = await loadDocumentChunks(options, config, warnings);
  const selectedChunks = selectWithinBudget(chunks, options.targetHints, config.documentMaxChunks, warnings);
  const systemPrompt = await readPrompt('docs-to-intent.system.md');
  const results = await mapConcurrent(
    selectedChunks,
    config.documentConcurrency,
    (chunk) => extractChunk(client, chunk, systemPrompt, options.targetHints, config),
  );

  const records: IntentRecord[] = [];
  const responses: LlmResponseMetadata[] = [];
  for (const result of results) {
    records.push(...result.records);
    warnings.push(...result.warnings);
    responses.push(...result.responses);
  }

  return {
    records,
    warnings,
    responses,
    audit: buildAudit(config, startedAt, records.length, warnings.length, responses),
  };
}

function requireConfiguredClient(client: OpenRouterClient, config: T2CConfig, startedAt: number): void {
  if (client.isConfigured()) return;
  const message = 'OPENROUTER_API_KEY is required for documentation -> Intent DSL';
  throw new DocumentationLlmRequiredError(message, {
    runtimeVersion: T2C_VERSION,
    configuration: openRouterAuditConfiguration(config, config.openRouter.documentModel, config.documentTimeoutMs),
    status: 'failed',
    requestedMode: 'llm',
    effectiveMode: 'none',
    degraded: true,
    recordCount: 0,
    warningCount: 1,
    model: config.openRouter.documentModel,
    durationMs: Date.now() - startedAt,
    reason: { code: 'LLM_NOT_CONFIGURED', message },
    responses: [],
  });
}

async function loadDocumentChunks(
  options: DocumentationExtractionOptions,
  config: T2CConfig,
  warnings: string[],
): Promise<DocumentChunk[]> {
  const files = await resolveGlobs(options.root, options.patterns, options.excludes ?? config.documentExcludes);
  const chunks: DocumentChunk[] = [];
  for (const file of files) {
    try {
      const body = await readText(file, config.maxFileBytes);
      chunks.push(...chunkMarkdown(relativePosix(options.root, file), body, config.documentChunkChars));
    } catch (error) {
      warnings.push(`${relativePosix(options.root, file)}: ${errorMessage(error)}`);
    }
  }
  return chunks;
}

function selectWithinBudget(
  chunks: DocumentChunk[],
  hints: DocumentationTargetHints | undefined,
  maxChunks: number,
  warnings: string[],
): DocumentChunk[] {
  const prioritized = prioritizeDocumentChunks(chunks, hints);
  const selected = prioritized.slice(0, maxChunks);
  if (selected.length < prioritized.length) {
    warnings.push(`DOC_CHUNK_BUDGET: analyzed ${selected.length} of ${prioritized.length} documentation chunks; increase T2C_DOC_MAX_CHUNKS to include more`);
  }
  return selected;
}

async function extractChunk(
  client: OpenRouterClient,
  chunk: DocumentChunk,
  systemPrompt: string,
  targetHints: DocumentationTargetHints | undefined,
  config: T2CConfig,
): Promise<DocumentChunkResult> {
  try {
    const contract = documentResponseContract(config.documentRecordsPerChunk);
    const completion = await client.chatStructuredWithMetadata([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: JSON.stringify({
          sourcePath: chunk.path,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          content: chunk.content,
          targetHints: targetHints ?? EMPTY_HINTS,
          maxRecords: config.documentRecordsPerChunk,
        }),
      },
    ], 't2c_document_intent', contract, config.openRouter.documentModel);
    const response = completion.value;
    const records = response.records
      .map((raw) => toDocumentIntentRecord(raw, chunk, config.openRouter.documentModel, completion.metadata));
    return { records, warnings: [], responses: [completion.metadata] };
  } catch (error) {
    return {
      records: [],
      warnings: [`${chunk.path}:${chunk.startLine}-${chunk.endLine}: ${errorMessage(error)}`],
      responses: [],
    };
  }
}

function buildAudit(
  config: T2CConfig,
  startedAt: number,
  recordCount: number,
  warningCount: number,
  responses: LlmResponseMetadata[],
): PipelineStageAudit {
  const status = warningCount === 0 ? 'succeeded' : recordCount > 0 ? 'partial' : 'failed';
  return {
    runtimeVersion: T2C_VERSION,
    configuration: openRouterAuditConfiguration(config, config.openRouter.documentModel, config.documentTimeoutMs),
    status,
    requestedMode: 'llm',
    effectiveMode: 'llm',
    degraded: warningCount > 0,
    recordCount,
    warningCount,
    model: config.openRouter.documentModel,
    durationMs: Date.now() - startedAt,
    reason: warningCount > 0
      ? { code: 'DOCUMENT_EXTRACTION_PARTIAL', message: `${warningCount} documentation extraction warning(s)` }
      : null,
    responses,
  };
}

async function readPrompt(name: string): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', name);
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
