import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getConfig, type T2CConfig } from '../config/env.js';
import { assertPathWithinRoot } from '../core/security.js';
import type { IntentRecord } from '../core/types.js';
import { extractDocumentationIntent } from '../extractors/docs-llm.js';
import { extractMarkdownIntent } from '../extractors/markdown.js';
import { extractNlIntent } from '../extractors/nl.js';
import type { GoldExtractionCase, GoldRecordProjection } from './gold-types.js';

export async function runExtractionCase(fixture: GoldExtractionCase): Promise<IntentRecord[]> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `t2c-gold-${fixture.channel}-`));
  try {
    await writeFixtureFiles(root, fixture.files ?? {});
    const config = benchmarkConfig(root);
    if (fixture.channel === 'nl') return await extractNlCase(fixture, config);
    if (fixture.channel === 'markdown') return await extractMarkdownCase(fixture, config);
    return await extractDocumentationCase(fixture, config);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function writeFixtureFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, content] of Object.entries(files)) {
    const destination = await assertPathWithinRoot(root, path.resolve(root, relative));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content, 'utf8');
  }
}

async function extractNlCase(fixture: GoldExtractionCase, config: T2CConfig): Promise<IntentRecord[]> {
  return (await extractNlIntent({
    root: config.root,
    sourcePath: fixture.sourcePath ?? 'TASK.md',
    text: fixture.text ?? '',
  }, config)).records;
}

async function extractMarkdownCase(fixture: GoldExtractionCase, config: T2CConfig): Promise<IntentRecord[]> {
  return (await extractMarkdownIntent({
    root: config.root,
    todoPath: fixture.todoPath ?? null,
    changelogPath: fixture.changelogPath ?? null,
  }, config)).records;
}

async function extractDocumentationCase(
  fixture: GoldExtractionCase,
  config: T2CConfig,
): Promise<IntentRecord[]> {
  if (!fixture.documentResponse) throw new Error(`Gold case ${fixture.id} requires documentResponse`);
  config.openRouter.apiKey = 'offline-gold-fixture';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: `gold-${fixture.id}`,
    model: 'gold/document-snapshot',
    provider: 'offline-fixture',
    choices: [{ message: { content: JSON.stringify(fixture.documentResponse) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    return (await extractDocumentationIntent({
      root: config.root,
      patterns: Object.keys(fixture.files ?? {}),
      excludes: [],
    }, config)).records;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function benchmarkConfig(root: string): T2CConfig {
  const config = getConfig(root);
  config.root = root;
  config.maxFileBytes = 1_048_576;
  config.documentConcurrency = 1;
  config.documentChunkChars = 100_000;
  config.documentMaxChunks = 20;
  config.documentRecordsPerChunk = 50;
  config.documentTimeoutMs = 5000;
  config.enableTensorFlow = false;
  config.openRouter.apiKey = null;
  config.openRouter.model = 'gold/document-snapshot';
  config.openRouter.documentModel = 'gold/document-snapshot';
  config.openRouter.responseHealing = false;
  return config;
}

export function projectRecord(record: IntentRecord): GoldRecordProjection {
  return {
    sourceKind: record.source.kind,
    action: record.statement.action,
    text: record.statement.text,
    lifecycle: record.lifecycle.status,
    modality: record.statement.modality,
    polarity: record.statement.polarity,
    paths: record.statement.target.paths,
    symbols: record.statement.target.symbols,
    tickets: record.statement.target.tickets,
    versions: record.statement.target.versions,
    lines: record.source.lines,
  };
}
