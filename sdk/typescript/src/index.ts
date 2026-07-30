/**
 * todo2code TypeScript SDK.
 *
 * A dependency-free client for the todo2code A2A v1.0 endpoint. Every call goes
 * through `SendMessage`, which returns an A2A task; helper methods unwrap the
 * first JSON artifact so callers work with plain results.
 */

export const A2A_VERSION = '1.0';

export type SourceKind = 'nl' | 'git' | 'ast' | 'todo' | 'changelog' | 'document' | 'agent_log' | 'test' | 'system';
export type EpistemicClass = 'declaration' | 'plan' | 'claim' | 'fact' | 'inference' | 'llm_inference';
export type LifecycleStatus =
  | 'proposed' | 'planned' | 'in_progress' | 'implemented'
  | 'verified' | 'released' | 'completed' | 'blocked' | 'unknown';
export type DiagnosticSeverity = 'info' | 'warning' | 'review_required' | 'blocking';
export type LlmExtractionMode = 'deterministic' | 'prefer-llm' | 'require-llm';

export interface IntentTarget {
  paths: string[];
  symbols: string[];
  tickets: string[];
  versions: string[];
}

export interface IntentStatement {
  kind: string;
  actor: string | null;
  action: string;
  subject: string | null;
  object: string;
  target: IntentTarget;
  modality: string;
  polarity: 'positive' | 'negative';
  text: string;
}

export interface IntentGenerationMetadata {
  generator: string;
  generatorVersion: string;
  runtimeVersion: string;
  requested: 'deterministic' | 'llm';
  used: 'deterministic' | 'llm';
  degraded: boolean;
  fallbackReason: string | null;
  provider: string | null;
  model: string | null;
  responseId: string | null;
}

export interface IntentRecord {
  schemaVersion: 't2c.intent/v1';
  id: string;
  statement: IntentStatement;
  lifecycle: { status: LifecycleStatus };
  source: {
    kind: SourceKind;
    path: string | null;
    lines: { start: number; end: number } | null;
    revision: string | null;
    symbol: string | null;
    commitIndex: number | null;
    extractor: string;
    contentHash: string;
    rawExcerpt: string | null;
  };
  epistemic: { class: EpistemicClass; confidence: number; basis: string[] };
  observedAt: string | null;
  metadata: Record<string, unknown> & { generation: IntentGenerationMetadata };
}

export interface IntentGraph {
  schemaVersion: 't2c.graph/v1';
  generatedAt: string;
  fingerprint: string;
  records: IntentRecord[];
  relations: Array<{ id: string; from: string; to: string; type: string; confidence: number; basis: string[] }>;
  stats: {
    bySource: Record<string, number>;
    byAction: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

export interface DiagnosticReport {
  schemaVersion: 't2c.diagnostics/v1';
  generatedAt: string;
  graphFingerprint: string;
  diagnostics: Array<{
    id: string;
    code: string;
    severity: DiagnosticSeverity;
    title: string;
    detail: string;
    recordIds: string[];
    suggestedAction: string;
  }>;
  counts: Record<DiagnosticSeverity, number>;
}

export interface ExtractionAudit {
  runtimeVersion: string;
  configuration: Record<string, unknown>;
  status: 'succeeded' | 'partial' | 'fallback' | 'failed' | 'skipped';
  requestedMode: 'deterministic' | 'llm' | 'disabled';
  effectiveMode: 'deterministic' | 'llm' | 'none';
  degraded: boolean;
  recordCount: number;
  warningCount: number;
  model: string | null;
  durationMs: number;
  reason: { code: string; message: string } | null;
  responses: Array<Record<string, unknown>>;
}

export interface ExtractionResult {
  records: IntentRecord[];
  warnings: string[];
  audit?: ExtractionAudit;
  responses?: Array<Record<string, unknown>>;
}

export type T2CAction =
  | 'extract_nl' | 'extract_git' | 'extract_ast' | 'extract_markdown' | 'extract_docs'
  | 'extract_communication' | 'analyze_communication'
  | 'link' | 'diagnose' | 'summarize'
  | 'diff' | 'diff_files' | 'diff_git' | 'reality'
  | 'compare_workspace' | 'pipeline'
  | 'propose_todo' | 'render_todo' | 'apply_todo';

export interface A2APart {
  text?: string;
  data?: unknown;
  mediaType?: string;
}

export interface A2AMessage {
  messageId: string;
  role: 'ROLE_USER' | 'ROLE_AGENT';
  parts: A2APart[];
  contextId?: string;
  taskId?: string;
}

export interface A2ATask {
  id: string;
  contextId: string;
  status: { state: string; message?: A2AMessage; timestamp: string };
  artifacts: Array<{ artifactId: string; name?: string; description?: string; parts: A2APart[] }>;
  history: A2AMessage[];
  metadata: Record<string, unknown>;
}

/**
 * `SendMessage` wraps the task as `{ task: … }`, while `GetTask` and
 * `CancelTask` return it bare. Accept both shapes.
 */
function unwrapTask(result: unknown): A2ATask {
  if (result && typeof result === 'object' && 'task' in result) {
    return (result as { task: A2ATask }).task;
  }
  return result as A2ATask;
}

export class T2CError extends Error {
  constructor(message: string, readonly code: number, readonly data?: unknown) {
    super(message);
    this.name = 'T2CError';
  }
}

export interface ClientOptions {
  baseUrl?: string;
  token?: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class T2CClient {
  private readonly baseUrl: string;

  private readonly token: string | null;

  private readonly timeoutMs: number;

  private readonly fetchImpl: typeof fetch;

  private counter = 0;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://localhost:8787').replace(/\/$/, '');
    this.token = options.token ?? null;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (!this.fetchImpl) throw new Error('No fetch implementation available; pass options.fetchImpl');
  }

  async health(): Promise<Record<string, unknown>> {
    return this.getJson('/healthz');
  }

  async agentCard(): Promise<Record<string, unknown>> {
    return this.getJson('/.well-known/agent-card.json');
  }

  /** Sends one action and returns the raw A2A task. */
  async send(action: T2CAction, input: Record<string, unknown> = {}): Promise<A2ATask> {
    this.counter += 1;
    const result = await this.rpc('SendMessage', {
      message: {
        messageId: `msg-${Date.now()}-${this.counter}`,
        role: 'ROLE_USER',
        parts: [{ data: { action, input }, mediaType: 'application/json' }],
      },
    });
    return unwrapTask(result);
  }

  /** Sends one action and unwraps the first JSON artifact. */
  async call<T = unknown>(action: T2CAction, input: Record<string, unknown> = {}): Promise<T> {
    const task = await this.send(action, input);
    if (task.status.state !== 'TASK_STATE_COMPLETED') {
      const detail = task.status.message?.parts?.map((part) => part.text).filter(Boolean).join(' ') ?? '';
      throw new T2CError(`Task ${task.id} ended in ${task.status.state}${detail ? `: ${detail}` : ''}`, -32000, task);
    }
    const part = task.artifacts[0]?.parts.find((candidate) => candidate.data !== undefined);
    if (!part) throw new T2CError(`Task ${task.id} returned no JSON artifact`, -32001, task);
    return part.data as T;
  }

  async getTask(taskId: string, options: { historyLength?: number; includeArtifacts?: boolean } = {}): Promise<A2ATask> {
    return unwrapTask(await this.rpc('GetTask', { taskId, ...options }));
  }

  async cancelTask(taskId: string): Promise<A2ATask> {
    return unwrapTask(await this.rpc('CancelTask', { taskId }));
  }

  async listTasks(params: Record<string, unknown> = {}): Promise<{ tasks: A2ATask[]; nextCursor?: string }> {
    return await this.rpc('ListTasks', params) as { tasks: A2ATask[]; nextCursor?: string };
  }

  // ---- Convenience wrappers -------------------------------------------------

  extractNl(file: string, root = '.', nlMode?: LlmExtractionMode): Promise<ExtractionResult> {
    return this.call('extract_nl', { file, root, ...(nlMode ? { nlMode } : {}) });
  }

  extractGit(count = 10, root = '.'): Promise<{ records: IntentRecord[]; warnings: string[] }> {
    return this.call('extract_git', { count, root });
  }

  extractAst(root = '.'): Promise<{ records: IntentRecord[]; warnings: string[] }> {
    return this.call('extract_ast', { root });
  }

  extractMarkdown(
    root = '.',
    options: { todo?: string | null; changelog?: string | null; markdownMode?: LlmExtractionMode } = {},
  ): Promise<ExtractionResult> {
    return this.call('extract_markdown', { root, ...options });
  }

  extractDocs(
    root = '.',
    options: { patterns?: string[]; excludes?: string[] } = {},
  ): Promise<ExtractionResult> {
    return this.call('extract_docs', { root, ...options });
  }

  link(records: IntentRecord[]): Promise<IntentGraph> {
    return this.call('link', { records });
  }

  diagnose(graph: IntentGraph): Promise<DiagnosticReport> {
    return this.call('diagnose', { graph });
  }

  summarize(graph: IntentGraph, diagnostics?: DiagnosticReport, fallback = false): Promise<{ markdown: string; llmUsed: boolean; warnings: string[] }> {
    return this.call('summarize', { graph, ...(diagnostics ? { diagnostics } : {}), fallback });
  }

  compareWorkspace(options: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return this.call('compare_workspace', options);
  }

  /** Compares two intent graphs and returns t2c.diff/v1 plus an SVG. */
  diffGraphs(beforeGraph: IntentGraph, afterGraph: IntentGraph, includeSvg = true): Promise<{ diff: unknown; svg?: string }> {
    return this.call('diff', { beforeGraph, afterGraph, includeSvg });
  }

  /**
   * Graph diff over the REST fast path (`POST /api/diff`).
   *
   * Skips the A2A task envelope, so it is one round-trip instead of a task
   * create/complete cycle. Accepts inline graphs or repository-relative paths.
   */
  async diffGraphsRest(
    payload: { beforeGraph?: IntentGraph; afterGraph?: IntentGraph; before?: string; after?: string; includeSvg?: boolean; maxItems?: number },
  ): Promise<{ diff: unknown; svg?: string }> {
    const response = await this.request('/api/diff', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json() as { diff?: unknown; svg?: string; error?: string | { message?: string } };
    if (!response.ok) {
      const message = typeof body.error === 'string' ? body.error : body.error?.message ?? `HTTP ${response.status}`;
      throw new T2CError(message, response.status);
    }
    return body as { diff: unknown; svg?: string };
  }

  diffFiles(before: string, after: string, options: Record<string, unknown> = {}): Promise<{ diffs: unknown[]; unified: string; svg?: string; html?: string }> {
    return this.call('diff_files', { before, after, ...options });
  }

  diffGit(options: Record<string, unknown> = {}): Promise<{ diffs: unknown[]; unified: string; svg?: string; revision: string }> {
    return this.call('diff_git', options);
  }

  /** Compares declared intent against observed code for a single graph. */
  reality(graph: IntentGraph, diagnostics?: DiagnosticReport, options: Record<string, unknown> = {}): Promise<{ view: unknown; markdown: string; svg?: string }> {
    return this.call('reality', { graph, ...(diagnostics ? { diagnostics } : {}), ...options });
  }

  pipeline(options: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return this.call('pipeline', options);
  }

  proposeTodo(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.call('propose_todo', input);
  }

  renderTodo(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.call('render_todo', input);
  }

  applyTodo(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.call('apply_todo', input);
  }

  // ---- Transport ------------------------------------------------------------

  private async rpc(method: string, params: Record<string, unknown>): Promise<unknown> {
    this.counter += 1;
    const body = JSON.stringify({ jsonrpc: '2.0', id: `req-${this.counter}`, method, params });
    const response = await this.request('/a2a', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'A2A-Version': A2A_VERSION,
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body,
    });
    const payload = await response.json() as { result?: unknown; error?: { code: number; message: string; data?: unknown } };
    if (payload.error) throw new T2CError(payload.error.message, payload.error.code, payload.error.data);
    if (!response.ok) throw new T2CError(`HTTP ${response.status}`, response.status);
    return payload.result;
  }

  private async getJson(pathname: string): Promise<Record<string, unknown>> {
    const response = await this.request(pathname, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'A2A-Version': A2A_VERSION,
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
    });
    if (!response.ok) throw new T2CError(`HTTP ${response.status} for ${pathname}`, response.status);
    return await response.json() as Record<string, unknown>;
  }

  private async request(pathname: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${pathname}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

export default T2CClient;
