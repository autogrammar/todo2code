import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { readJsonl } from '../core/io.js';
import { assertPathWithinRoot } from '../core/security.js';
import type { DiagnosticReport, IntentGraph, IntentRecord, PipelineOptions } from '../core/types.js';
import { extractAstIntent } from '../extractors/ast.js';
import { extractDocumentationIntent } from '../extractors/docs-llm.js';
import { extractGitIntent } from '../extractors/git.js';
import { extractMarkdownIntent } from '../extractors/markdown.js';
import { extractNlIntent } from '../extractors/nl.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { linkIntentRecords } from '../graph/linker.js';
import { runPipeline } from '../pipeline/run.js';
import { summarizeGraph } from '../summary/summarizer.js';

export type T2CAction =
  | 'extract_nl'
  | 'extract_git'
  | 'extract_ast'
  | 'extract_markdown'
  | 'extract_docs'
  | 'link'
  | 'diagnose'
  | 'summarize'
  | 'pipeline';

export async function executeAction(action: T2CAction, input: Record<string, unknown>, config: T2CConfig): Promise<unknown> {
  const root = await resolveRoot(input.root, config);
  switch (action) {
    case 'extract_nl': {
      const file = await scopedPath(input.file, 'TASK.md', root, config);
      const text = typeof input.text === 'string' ? input.text : undefined;
      return extractNlIntent({ root, sourcePath: file, ...(text !== undefined ? { text } : {}) }, config);
    }
    case 'extract_git':
      return extractGitIntent({ root, count: numberValue(input.count, config.gitCommitCount, 1, 100) }, config);
    case 'extract_ast':
      return extractAstIntent({ root }, config);
    case 'extract_markdown':
      return extractMarkdownIntent({
        root,
        todoPath: await nullableScopedPath(input.todo, 'TODO.md', root, config),
        changelogPath: await nullableScopedPath(input.changelog, 'CHANGELOG.md', root, config),
      }, config);
    case 'extract_docs':
      return extractDocumentationIntent({
        root,
        patterns: stringList(input.patterns, config.documentPatterns),
        excludes: stringList(input.excludes, config.documentExcludes),
      }, config);
    case 'link': {
      const records = await readRecords(input, root, config);
      return linkIntentRecords(records);
    }
    case 'diagnose': {
      const graph = objectValue<IntentGraph>(input.graph, 'graph');
      return diagnoseGraph(graph);
    }
    case 'summarize': {
      const graph = objectValue<IntentGraph>(input.graph, 'graph');
      const diagnostics = input.diagnostics
        ? objectValue<DiagnosticReport>(input.diagnostics, 'diagnostics')
        : diagnoseGraph(graph);
      return summarizeGraph(graph, diagnostics, config, {
        allowDeterministicFallback: booleanValue(input.fallback, false),
      });
    }
    case 'pipeline': {
      const options: PipelineOptions = {
        root,
        taskFile: await nullableScopedPath(input.task, null, root, config),
        todoFile: await nullableScopedPath(input.todo, 'TODO.md', root, config),
        changelogFile: await nullableScopedPath(input.changelog, 'CHANGELOG.md', root, config),
        documentPatterns: stringList(input.docs, config.documentPatterns),
        includeDocumentationLlm: booleanValue(input.includeDocsLlm, true),
        outputDir: await scopedPath(input.output, config.outputDir, root, config),
        gitCommitCount: numberValue(input.gitCount, config.gitCommitCount, 1, 100),
        allowSummaryFallback: booleanValue(input.summaryFallback, true),
      };
      return runPipeline(options, config);
    }
  }
}

async function resolveRoot(value: unknown, config: T2CConfig): Promise<string> {
  const requested = path.resolve(config.root, typeof value === 'string' && value.trim() ? value : '.');
  return assertPathWithinRoot(config.root, requested, config.allowOutsideRoot);
}

async function scopedPath(
  value: unknown,
  fallback: string,
  root: string,
  config: T2CConfig,
): Promise<string> {
  const selected = stringValue(value, fallback);
  return assertPathWithinRoot(root, path.resolve(root, selected), config.allowOutsideRoot);
}

async function nullableScopedPath(
  value: unknown,
  fallback: string | null,
  root: string,
  config: T2CConfig,
): Promise<string | null> {
  const selected = nullableString(value, fallback);
  if (selected === null) return null;
  return assertPathWithinRoot(root, path.resolve(root, selected), config.allowOutsideRoot);
}

async function readRecords(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<IntentRecord[]> {
  if (Array.isArray(input.records)) return input.records as IntentRecord[];
  const files = stringList(input.files, []);
  if (files.length === 0) throw new Error('link requires records[] or files[]');
  const output: IntentRecord[] = [];
  for (const file of files) {
    const safeFile = await assertPathWithinRoot(root, path.resolve(root, file), config.allowOutsideRoot);
    output.push(...await readJsonl(safeFile));
  }
  return output;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown, fallback: string | null): string | null {
  if (value === null || value === false) return null;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim());
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : fallback;
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`Expected number between ${min} and ${max}`);
  return Math.trunc(number);
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return fallback;
}

function objectValue<T>(value: unknown, name: string): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as T;
}
