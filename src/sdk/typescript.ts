/**
 * In-tree entry point for the TypeScript SDK.
 *
 * The implementation lives in `sdk/typescript/src/index.ts`, alongside the Go,
 * Python, PHP and Rust clients, so all five languages share one surface. This
 * module re-exports it under the repository-local specifier and keeps the
 * `Todo2CodeClient` names stable for existing callers.
 */

import type { IntentGraph, IntentGraphDiff } from '../core/types.js';
import type { IntentRealityView } from '../diff/reality.js';
import type { FileDiff } from '../diff/text.js';
import type { T2CAction } from '../services/actions.js';
import {
  T2CClient,
  type ExtractionResult as SdkExtractionResult,
  type LlmExtractionMode as SdkLlmExtractionMode,
} from '../../sdk/typescript/src/index.js';

export {
  A2A_VERSION,
  T2CClient,
  T2CError,
} from '../../sdk/typescript/src/index.js';
export type {
  A2AMessage,
  A2APart,
  A2ATask,
  ClientOptions,
  ExtractionAudit,
} from '../../sdk/typescript/src/index.js';

export interface Todo2CodeClientOptions {
  baseUrl?: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
}

export interface DiffResult {
  diff: IntentGraphDiff;
  svg?: string;
}

export interface FileDiffResult {
  diffs: FileDiff[];
  unified: string;
  svg?: string;
  html?: string;
}

export interface GitDiffResponse extends FileDiffResult {
  revision: string;
  staged: boolean;
  warnings: string[];
}

export interface RealityResult {
  view: IntentRealityView;
  markdown: string;
  svg?: string;
}

/**
 * Diff-focused facade over {@link T2CClient}.
 *
 * Graph comparisons go through the REST fast path (`POST /api/diff`), which is
 * one round-trip instead of an A2A task cycle; everything else uses A2A.
 */
export class Todo2CodeClient {
  private readonly client: T2CClient;

  constructor(options: Todo2CodeClientOptions = {}) {
    this.client = new T2CClient({
      baseUrl: options.baseUrl ?? 'http://127.0.0.1:8787',
      token: options.token?.trim() || null,
      ...(options.fetch ? { fetchImpl: options.fetch } : {}),
    });
  }

  /** The underlying full-surface client, for actions this facade does not wrap. */
  get a2a(): T2CClient {
    return this.client;
  }

  async health(): Promise<Record<string, unknown>> {
    return this.client.health();
  }

  async diffGraphs(beforeGraph: IntentGraph, afterGraph: IntentGraph, includeSvg = true): Promise<DiffResult> {
    return await this.client.diffGraphsRest({ beforeGraph, afterGraph, includeSvg }) as DiffResult;
  }

  async diffGraphFiles(before: string, after: string, includeSvg = true): Promise<DiffResult> {
    return await this.client.diffGraphsRest({ before, after, includeSvg }) as DiffResult;
  }

  async diffTextFiles(
    before: string,
    after: string,
    options: { context?: number; includeSvg?: boolean; includeHtml?: boolean; maxRows?: number } = {},
  ): Promise<FileDiffResult> {
    return this.run<FileDiffResult>('diff_files', { before, after, ...options });
  }

  async diffGit(
    options: { revision?: string; staged?: boolean; context?: number; maxFiles?: number; includeSvg?: boolean; includeHtml?: boolean } = {},
  ): Promise<GitDiffResponse> {
    return this.run<GitDiffResponse>('diff_git', { ...options });
  }

  async reality(
    graph: IntentGraph,
    options: { diagnostics?: Record<string, unknown>; gapsOnly?: boolean; maxRows?: number; includeSvg?: boolean } = {},
  ): Promise<RealityResult> {
    return this.run<RealityResult>('reality', { graph, ...options });
  }

  async compareWorkspace(options: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return this.run<Record<string, unknown>>('compare_workspace', options);
  }

  async proposeTodo(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.run<Record<string, unknown>>('propose_todo', input);
  }

  async renderTodo(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.run<Record<string, unknown>>('render_todo', input);
  }

  async applyTodo(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.run<Record<string, unknown>>('apply_todo', input);
  }

  async proposeCodeChange(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.run<Record<string, unknown>>('propose_code_change', input);
  }

  async evaluateCodeChange(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.run<Record<string, unknown>>('evaluate_code_change', input);
  }

  async extractNl(file: string, root = '.', nlMode?: SdkLlmExtractionMode): Promise<SdkExtractionResult> {
    return this.client.extractNl(file, root, nlMode);
  }

  async extractDocs(
    root = '.',
    options: { patterns?: string[]; excludes?: string[] } = {},
  ): Promise<SdkExtractionResult> {
    return this.client.extractDocs(root, options);
  }

  async run<T = unknown>(action: T2CAction, input: Record<string, unknown> = {}): Promise<T> {
    return this.client.call<T>(action, input);
  }
}
