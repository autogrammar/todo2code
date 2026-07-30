import { promises as fs } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { getConfig, loadEnvFile } from '../config/env.js';
import { pathExists, readJson } from '../core/io.js';
import type { T2CConfig } from '../config/env.js';
import { executeAction, type T2CAction } from '../services/actions.js';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface McpTool {
  name: T2CAction;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface McpConnectionState {
  legacyInitialized: boolean;
  legacyProtocolVersion: string | null;
}

export const MCP_MODERN_PROTOCOL = '2026-07-28';
export const MCP_LEGACY_PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const;
export const MCP_SUPPORTED_PROTOCOLS = [MCP_MODERN_PROTOCOL, ...MCP_LEGACY_PROTOCOLS] as const;

const DISCOVERY_TTL_MS = 3_600_000;
const LIST_TTL_MS = 300_000;
const RESOURCE_TTL_MS = 60_000;

const TOOLS: McpTool[] = [
  tool('extract_nl', 'Extract NL/task text to canonical Intent DSL through audited LLM generation with a deterministic fallback.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    file: stringProp('Source file path. Defaults to TASK.md.'),
    text: stringProp('Optional inline text. When present, file is used only as source identity.'),
    nlMode: stringProp('deterministic, prefer-llm (default) or require-llm.'),
  }),
  tool('extract_git', 'Extract the last N Git commits to Intent DSL without an LLM.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    count: numberProp('Number of commits, default 10.', 1, 100),
  }),
  tool('extract_ast', 'Extract TypeScript/JavaScript, Python, Go, Java and Rust AST facts to Intent DSL without an LLM.', {
    root: stringProp('Repository root under T2C_ROOT.'),
  }),
  tool('extract_markdown', 'Extract TODO.md and CHANGELOG.md structurally, with audited LLM semantic enrichment and deterministic fallback.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    todo: nullableStringProp('TODO path or null.'),
    changelog: nullableStringProp('CHANGELOG path or null.'),
    markdownMode: stringProp('deterministic, prefer-llm (default) or require-llm.'),
  }),
  tool('extract_docs', 'Extract documentation to Intent DSL through OpenRouter structured outputs.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    patterns: stringArrayProp('Documentation glob patterns.'),
    excludes: stringArrayProp('Exclusion glob patterns.'),
  }),
  tool('extract_communication', 'Extract per-ticket human and agent communication under project/<ticket>/ to canonical Intent DSL.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    projectDir: stringProp('Communication root, default project.'),
    ticket: nullableStringProp('Optional ticket filter.'),
    communicationMode: stringProp('deterministic (default), prefer-llm or require-llm.'),
  }),
  tool('analyze_communication', 'Analyze every human/agent separately and detect communication-to-work divergences.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    projectDir: stringProp('Communication root, default project.'),
    ticket: nullableStringProp('Optional ticket filter.'),
    communicationMode: stringProp('deterministic (default), prefer-llm or require-llm.'),
    graph: { type: 'object', description: 'Optional existing t2c.graph/v1 object.' },
    gitCount: numberProp('Commit evidence count, default 10.', 1, 100),
    includeAst: { type: 'boolean', description: 'Include AST evidence, default true.' },
    includeGraph: { type: 'boolean', description: 'Include the constructed graph in the result.' },
  }),
  tool('link', 'Link Intent DSL records into a deterministic evidence graph.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    records: { type: 'array', items: { type: 'object' } },
    files: stringArrayProp('Alternative list of JSONL paths.'),
  }),
  tool('diagnose', 'Run deterministic alignment diagnostics on an Intent graph.', {
    graph: { type: 'object', description: 't2c.graph/v1 object.' },
  }, ['graph']),
  tool('summarize', 'Generate grounded Polish NL summary from graph and diagnostics through OpenRouter.', {
    graph: { type: 'object' },
    diagnostics: { type: 'object' },
    mode: stringProp('deterministic, prefer-llm (default) or require-llm.'),
    fallback: { type: 'boolean', description: 'Deprecated alias: true selects prefer-llm, false selects require-llm.' },
  }, ['graph']),
  tool('diff', 'Compare two Intent graphs and return canonical t2c.diff/v1 JSON plus an SVG view.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    beforeGraph: { type: 'object', description: 'Earlier t2c.graph/v1 object.' },
    afterGraph: { type: 'object', description: 'Later t2c.graph/v1 object.' },
    before: stringProp('Alternative earlier graph path under root.'),
    after: stringProp('Alternative later graph path under root.'),
    includeSvg: { type: 'boolean', description: 'Include SVG visualization, default true.' },
    maxItems: numberProp('Maximum rows per SVG section, default 18.', 1, 100),
    communicationOnly: { type: 'boolean', description: 'Compare only versioned agent_log communication records.' },
    participant: stringProp('Optional exact communication participant filter.'),
    role: stringProp('Optional human, agent or unknown communication role filter.'),
    ticket: stringProp('Optional ticket filter applied to both graphs.'),
  }),
  tool('diff_files', 'Diff two files with the deterministic Myers engine and return unified text plus an SVG view.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    before: stringProp('Earlier file path under root.'),
    after: stringProp('Later file path under root.'),
    path: stringProp('Display path for the rendered diff.'),
    context: numberProp('Unchanged context lines per hunk, default 3.', 0, 100),
    includeSvg: { type: 'boolean', description: 'Include SVG visualization, default true.' },
    includeHtml: { type: 'boolean', description: 'Include HTML visualization, default false.' },
    maxRows: numberProp('Maximum rendered SVG rows, default 400.', 1, 4000),
  }, ['before', 'after']),
  tool('diff_git', 'Diff the Git work tree or index against a revision and render it.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    revision: stringProp('Base revision, default HEAD.'),
    staged: { type: 'boolean', description: 'Compare the index instead of the work tree.' },
    context: numberProp('Unchanged context lines per hunk, default 3.', 0, 100),
    maxFiles: numberProp('Maximum files inspected, default 50.', 1, 500),
    includeSvg: { type: 'boolean', description: 'Include SVG visualization, default true.' },
    includeHtml: { type: 'boolean', description: 'Include HTML visualization, default false.' },
  }),
  tool('reality', 'Compare declared intent against observed code and return the t2c.reality/v1 view.', {
    graph: { type: 'object', description: 't2c.graph/v1 object.' },
    diagnostics: { type: 'object', description: 'Optional t2c.diagnostics/v1 report; recomputed when absent.' },
    gapsOnly: { type: 'boolean', description: 'Render only divergent topics.' },
    maxRows: numberProp('Maximum rendered rows, default 30.', 1, 500),
    includeSvg: { type: 'boolean', description: 'Include SVG visualization, default true.' },
  }, ['graph']),
  tool('compare_workspace', 'Compare intent at a Git base ref (default origin/main) with committed and uncommitted workspace state.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    base: stringProp('Git base ref, default origin/main.'),
    task: nullableStringProp('NL task file included on each side when present.'),
    todo: nullableStringProp('TODO file.'),
    changelog: nullableStringProp('CHANGELOG file.'),
    docs: stringArrayProp('Documentation patterns.'),
    docExcludes: stringArrayProp('Documentation exclusion patterns.'),
    markdownMode: stringProp('deterministic, prefer-llm (default) or require-llm.'),
    communicationMode: stringProp('deterministic (default), prefer-llm or require-llm.'),
    includeDocsLlm: { type: 'boolean', description: 'Run the same LLM documentation extraction on both sides.' },
    output: stringProp('Comparison artifact root, default .intent.'),
    gitCount: numberProp('Number of commit claims included per side.', 1, 100),
  }),
  tool('propose_todo', 'Synthesize grounded TODO proposals from a graph and diagnostics with an audited LLM mode.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    graph: { type: 'object', description: 'Inline t2c.graph/v1 object.' },
    graphPath: stringProp('Alternative graph JSON path under root.'),
    diagnostics: { type: 'object', description: 'Inline t2c.diagnostics/v1 report; derived when omitted.' },
    diagnosticsPath: stringProp('Alternative diagnostics JSON path under root.'),
    mode: stringProp('prefer-llm (default) or require-llm.'),
    output: stringProp('Optional synthesis JSON output path under root.'),
  }),
  tool('render_todo', 'Render validated new proposals to a reviewable TODO.patch and adjacent JSON audit without changing TODO.md.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    graph: { type: 'object', description: 'Inline t2c.graph/v1 object.' },
    graphPath: stringProp('Alternative graph JSON path under root.'),
    diagnostics: { type: 'object', description: 'Inline t2c.diagnostics/v1 report.' },
    diagnosticsPath: stringProp('Alternative diagnostics JSON path under root.'),
    synthesis: { type: 'object', description: 'Inline t2c.task-synthesis/v1 result.' },
    synthesisPath: stringProp('Alternative synthesis JSON path under root.'),
    todo: stringProp('Source TODO path, default TODO.md.'),
    patch: stringProp('Review Markdown output path, default TODO.patch.'),
    audit: stringProp('Patch audit JSON output path, default TODO.patch.json.'),
  }),
  tool('apply_todo', 'Apply one explicitly approved, unchanged TODO patch atomically and write an idempotency receipt.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    todo: stringProp('Source TODO path, default TODO.md.'),
    patch: stringProp('Reviewed TODO.patch path.'),
    audit: stringProp('TODO patch audit JSON path.'),
    receipt: stringProp('Apply receipt output path.'),
    actor: stringProp('Human approving actor identity.'),
    approvalHash: stringProp('Exact renderedPatchHash approved by the actor.'),
  }, ['patch', 'audit', 'receipt', 'actor', 'approvalHash']),
  tool('pipeline', 'Run the complete todo2code pipeline and write a versioned .intent run.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    task: nullableStringProp('NL task/ticket file.'),
    todo: nullableStringProp('TODO file.'),
    changelog: nullableStringProp('CHANGELOG file.'),
    docs: stringArrayProp('Documentation glob patterns.'),
    docExcludes: stringArrayProp('Documentation exclusion patterns; override to include one historical .intent report.'),
    nlMode: stringProp('deterministic, prefer-llm (default) or require-llm.'),
    markdownMode: stringProp('deterministic, prefer-llm (default) or require-llm.'),
    includeDocsLlm: { type: 'boolean' },
    output: stringProp('Output directory, default .intent.'),
    gitCount: numberProp('Number of commits, default 10.', 1, 100),
    summaryFallback: { type: 'boolean' },
    includeSummaryLlm: { type: 'boolean', description: 'Use the configured LLM for the final summary; false is fully deterministic.' },
    taskMode: stringProp('disabled (default), prefer-llm or require-llm task synthesis and TODO.patch rendering.'),
    includeCommunication: { type: 'boolean', description: 'Analyze project/<ticket> communication in the main run; default true.' },
    projectDir: stringProp('Communication directory under root, default project.'),
    communicationTicket: nullableStringProp('Optional ticket filter for communication input.'),
    communicationMode: stringProp('deterministic (default), prefer-llm or require-llm.'),
  }),
];

export function createMcpConnectionState(): McpConnectionState {
  return { legacyInitialized: false, legacyProtocolVersion: null };
}

export async function startMcpServer(config?: T2CConfig): Promise<void> {
  await loadEnvFile();
  const resolvedConfig = config ?? getConfig();
  const state = createMcpConnectionState();
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
  process.stderr.write(`[t2c:mcp] ${resolvedConfig.mcp.serverName} ${resolvedConfig.mcp.serverVersion} stdio ready\n`);

  for await (const line of input) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      continue;
    }

    if (!isJsonRpcRequest(parsed)) {
      send({ jsonrpc: '2.0', id: requestId(parsed), error: { code: -32600, message: 'Invalid Request' } });
      continue;
    }
    const request = parsed;

    // JSON-RPC notifications never receive a response. The implementation has
    // no server-side operation that needs to be run for the supported ones.
    if (request.id === undefined) continue;

    try {
      const result = await handleMcpRequest(request, resolvedConfig, state);
      send({ jsonrpc: '2.0', id: request.id, result });
    } catch (error) {
      const normalized = normalizeMcpError(error);
      send({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: normalized.code,
          message: normalized.message,
          ...(normalized.data === undefined ? {} : { data: normalized.data }),
        },
      });
    }
  }
}

/**
 * Pure request handler used by the stdio loop and tests. `state` is consulted
 * only by the legacy initialize era; modern requests remain fully stateless.
 */
export async function handleMcpRequest(
  request: JsonRpcRequest,
  config: T2CConfig,
  state: McpConnectionState = createMcpConnectionState(),
): Promise<unknown> {
  if (request.method === 'initialize') return initializeLegacy(request, config, state);

  const modern = hasModernMetadata(request.params) || request.method === 'server/discover';
  if (modern) {
    validateModernRequest(request);
    return handleModernRequest(request, config);
  }

  if (!state.legacyInitialized) {
    throw new McpRequestError(-32600, 'Legacy MCP request requires initialize first');
  }
  return handleLegacyRequest(request, config);
}

function initializeLegacy(request: JsonRpcRequest, config: T2CConfig, state: McpConnectionState): unknown {
  const params = request.params ?? {};
  const requested = typeof params.protocolVersion === 'string'
    ? params.protocolVersion
    : MCP_LEGACY_PROTOCOLS[0];
  const protocolVersion = isLegacyProtocol(requested) ? requested : MCP_LEGACY_PROTOCOLS[0];
  state.legacyInitialized = true;
  state.legacyProtocolVersion = protocolVersion;
  return {
    protocolVersion,
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
    },
    serverInfo: serverInfo(config),
    instructions: serverInstructions(),
  };
}

async function handleModernRequest(request: JsonRpcRequest, config: T2CConfig): Promise<unknown> {
  const params = request.params ?? {};
  const responseMeta = serverMeta(config);
  switch (request.method) {
    case 'server/discover':
      return {
        resultType: 'complete',
        supportedVersions: [...MCP_SUPPORTED_PROTOCOLS],
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false },
        },
        _meta: responseMeta,
        instructions: serverInstructions(),
        ttlMs: DISCOVERY_TTL_MS,
        cacheScope: 'public',
      };
    case 'tools/list':
      return {
        resultType: 'complete',
        tools: TOOLS,
        ttlMs: LIST_TTL_MS,
        cacheScope: 'public',
        _meta: responseMeta,
      };
    case 'tools/call':
      return { ...(await callTool(params, config)), resultType: 'complete', _meta: responseMeta };
    case 'resources/list':
      return {
        resultType: 'complete',
        resources: await listResources(config),
        ttlMs: LIST_TTL_MS,
        cacheScope: 'public',
        _meta: responseMeta,
      };
    case 'resources/read':
      return {
        resultType: 'complete',
        contents: [await readRequestedResource(params, config)],
        ttlMs: RESOURCE_TTL_MS,
        cacheScope: 'private',
        _meta: responseMeta,
      };
    default:
      throw new McpRequestError(-32601, `Method not found: ${request.method}`);
  }
}

async function handleLegacyRequest(request: JsonRpcRequest, config: T2CConfig): Promise<unknown> {
  const params = request.params ?? {};
  switch (request.method) {
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: TOOLS };
    case 'tools/call':
      return callTool(params, config);
    case 'resources/list':
      return { resources: await listResources(config) };
    case 'resources/read':
      return { contents: [await readRequestedResource(params, config)] };
    default:
      throw new McpRequestError(-32601, `Method not found: ${request.method}`);
  }
}

async function callTool(params: Record<string, unknown>, config: T2CConfig): Promise<Record<string, unknown>> {
  const name = params.name;
  if (typeof name !== 'string' || !TOOLS.some((item) => item.name === name)) {
    throw new McpRequestError(-32602, `Unknown tool: ${String(name)}`);
  }
  const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
    ? params.arguments as Record<string, unknown>
    : {};
  try {
    const result = await executeAction(name as T2CAction, args, config);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
      isError: false,
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
}

function validateModernRequest(request: JsonRpcRequest): void {
  if (request.id === null || request.id === undefined) {
    throw new McpRequestError(-32600, 'Modern MCP requests require a string or number id');
  }
  const params = request.params;
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new McpRequestError(-32602, 'Modern MCP request params must contain _meta');
  }
  const meta = params._meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw new McpRequestError(-32602, 'Missing required params._meta');
  }
  const typedMeta = meta as Record<string, unknown>;
  const requested = typedMeta['io.modelcontextprotocol/protocolVersion'];
  const capabilities = typedMeta['io.modelcontextprotocol/clientCapabilities'];
  if (typeof requested !== 'string') {
    throw new McpRequestError(-32602, 'Missing io.modelcontextprotocol/protocolVersion');
  }
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    throw new McpRequestError(-32602, 'Missing io.modelcontextprotocol/clientCapabilities');
  }
  if (requested !== MCP_MODERN_PROTOCOL) {
    throw new McpRequestError(-32022, 'Unsupported protocol version', {
      supported: [...MCP_SUPPORTED_PROTOCOLS],
      requested,
    });
  }
}

function hasModernMetadata(params: Record<string, unknown> | undefined): boolean {
  if (!params) return false;
  const meta = params._meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  return 'io.modelcontextprotocol/protocolVersion' in meta;
}

async function readRequestedResource(params: Record<string, unknown>, config: T2CConfig): Promise<Record<string, unknown>> {
  const uri = params.uri;
  if (typeof uri !== 'string' || !uri) throw new McpRequestError(-32602, 'resources/read requires uri');
  try {
    return await readResource(uri, config);
  } catch (error) {
    if (error instanceof McpRequestError) throw error;
    if (error instanceof Error && (error.message.startsWith('Unknown resource URI:') || error.message.startsWith('No latest t2c run'))) {
      throw new McpRequestError(-32602, error.message, { uri });
    }
    throw error;
  }
}

async function listResources(config: T2CConfig): Promise<Array<Record<string, unknown>>> {
  const latestPath = path.resolve(config.root, config.outputDir, 'latest.json');
  if (!(await pathExists(latestPath))) return [];
  return [
    { uri: 't2c://latest/pointer', name: 'Latest run pointer', mimeType: 'application/json' },
    { uri: 't2c://latest/manifest', name: 'Latest run manifest', mimeType: 'application/json' },
    { uri: 't2c://latest/graph', name: 'Latest Intent graph', mimeType: 'application/json' },
    { uri: 't2c://latest/diagnostics', name: 'Latest diagnostics', mimeType: 'application/json' },
    { uri: 't2c://latest/summary', name: 'Latest team summary', mimeType: 'text/markdown' },
    { uri: 't2c://latest/task-synthesis', name: 'Latest TODO task synthesis', mimeType: 'application/json' },
    { uri: 't2c://latest/todo-validation', name: 'Latest TODO proposal validation', mimeType: 'application/json' },
    { uri: 't2c://latest/todo-patch', name: 'Latest reviewable TODO patch', mimeType: 'text/markdown' },
    { uri: 't2c://latest/todo-patch-audit', name: 'Latest TODO patch audit', mimeType: 'application/json' },
    { uri: 't2c://latest/todo-apply-receipt', name: 'Latest TODO apply receipt', mimeType: 'application/json' },
    { uri: 't2c://latest/communication-analysis', name: 'Latest participant communication analysis', mimeType: 'application/json' },
    { uri: 't2c://latest/communication-report', name: 'Latest participant communication report', mimeType: 'text/markdown' },
  ];
}

async function readResource(uri: string, config: T2CConfig): Promise<Record<string, unknown>> {
  const latestPath = path.resolve(config.root, config.outputDir, 'latest.json');
  if (!(await pathExists(latestPath))) throw new Error('No latest t2c run exists');
  if (uri === 't2c://latest/pointer') {
    return { uri, mimeType: 'application/json', text: await fs.readFile(latestPath, 'utf8') };
  }
  const latest = await readJson<{ runDirectory: string }>(latestPath);
  const names: Record<string, [string, string]> = {
    't2c://latest/manifest': ['manifest.json', 'application/json'],
    't2c://latest/graph': ['intent.graph.json', 'application/json'],
    't2c://latest/diagnostics': ['diagnostics.json', 'application/json'],
    't2c://latest/summary': ['team-summary.md', 'text/markdown'],
    't2c://latest/task-synthesis': ['task-synthesis.json', 'application/json'],
    't2c://latest/todo-validation': ['todo-validation.json', 'application/json'],
    't2c://latest/todo-patch': ['TODO.patch', 'text/markdown'],
    't2c://latest/todo-patch-audit': ['TODO.patch.json', 'application/json'],
    't2c://latest/todo-apply-receipt': ['TODO.patch.receipt.json', 'application/json'],
    't2c://latest/communication-analysis': ['communication-analysis.json', 'application/json'],
    't2c://latest/communication-report': ['communication-analysis.md', 'text/markdown'],
  };
  const selected = names[uri];
  if (!selected) throw new Error(`Unknown resource URI: ${uri}`);
  const filePath = path.resolve(config.root, latest.runDirectory, selected[0]);
  const relative = path.relative(config.root, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Resource escaped T2C_ROOT');
  return { uri, mimeType: selected[1], text: await fs.readFile(filePath, 'utf8') };
}

function tool(name: T2CAction, description: string, properties: Record<string, unknown>, required: string[] = []): McpTool {
  const writes = new Set<T2CAction>(['pipeline', 'propose_todo', 'render_todo', 'apply_todo']);
  return {
    name,
    description,
    inputSchema: { type: 'object', additionalProperties: false, properties, required },
    annotations: {
      readOnlyHint: !writes.has(name),
      destructiveHint: name === 'apply_todo',
      idempotentHint: name !== 'pipeline' && name !== 'propose_todo',
    },
  };
}

function stringProp(description: string): Record<string, unknown> {
  return { type: 'string', description };
}

function nullableStringProp(description: string): Record<string, unknown> {
  return { type: ['string', 'null'], description };
}

function stringArrayProp(description: string): Record<string, unknown> {
  return { type: 'array', items: { type: 'string' }, description };
}

function numberProp(description: string, minimum: number, maximum: number): Record<string, unknown> {
  return { type: 'integer', minimum, maximum, description };
}

function serverInfo(config: T2CConfig): Record<string, string> {
  return { name: config.mcp.serverName, version: config.mcp.serverVersion };
}

function serverMeta(config: T2CConfig): Record<string, unknown> {
  return { 'io.modelcontextprotocol/serverInfo': serverInfo(config) };
}

function serverInstructions(): string {
  return 'NL and TODO/CHANGELOG semantic extraction are audited and default to prefer-llm; deterministic extraction remains available. OpenRouter is limited to extract_nl, extract_markdown, extract_docs and summarize.';
}

function isLegacyProtocol(value: string): value is typeof MCP_LEGACY_PROTOCOLS[number] {
  return (MCP_LEGACY_PROTOCOLS as readonly string[]).includes(value);
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<JsonRpcRequest>;
  return candidate.jsonrpc === '2.0'
    && typeof candidate.method === 'string'
    && (candidate.params === undefined || (typeof candidate.params === 'object' && candidate.params !== null && !Array.isArray(candidate.params)));
}

function requestId(value: unknown): string | number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' || typeof id === 'number' || id === null ? id : null;
}

class McpRequestError extends Error {
  constructor(readonly code: number, message: string, readonly data?: unknown) {
    super(message);
  }
}

function normalizeMcpError(error: unknown): McpRequestError {
  if (error instanceof McpRequestError) return error;
  return new McpRequestError(-32603, error instanceof Error ? error.message : String(error));
}

function send(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  startMcpServer().catch((error) => {
    process.stderr.write(`[t2c:mcp] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
