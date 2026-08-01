import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { getConfig, loadEnvFile, type T2CConfig } from '../config/env.js';
import { McpRequestError, normalizeMcpError } from './mcp-errors.js';
import { listMcpResources, readRequestedMcpResource } from './mcp-resources.js';
import { callMcpTool, MCP_TOOLS } from './mcp-tools.js';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
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
    const parsed = parseRequestLine(line);
    if (!parsed.ok) {
      send(parsed.response);
      continue;
    }
    const request = parsed.request;
    if (request.id === undefined) continue;

    try {
      const result = await handleMcpRequest(request, resolvedConfig, state);
      send({ jsonrpc: '2.0', id: request.id, result });
    } catch (error) {
      sendError(request.id, normalizeMcpError(error));
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
  if (hasModernMetadata(request.params) || request.method === 'server/discover') {
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
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        _meta: responseMeta,
        instructions: serverInstructions(),
        ttlMs: DISCOVERY_TTL_MS,
        cacheScope: 'public',
      };
    case 'tools/list':
      return completePublic({ tools: MCP_TOOLS, ttlMs: LIST_TTL_MS }, responseMeta);
    case 'tools/call':
      return { ...(await callMcpTool(params, config)), resultType: 'complete', _meta: responseMeta };
    case 'resources/list':
      return completePublic({ resources: await listMcpResources(config), ttlMs: LIST_TTL_MS }, responseMeta);
    case 'resources/read':
      return {
        resultType: 'complete',
        contents: [await readRequestedMcpResource(params, config)],
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
    case 'ping': return {};
    case 'tools/list': return { tools: MCP_TOOLS };
    case 'tools/call': return callMcpTool(params, config);
    case 'resources/list': return { resources: await listMcpResources(config) };
    case 'resources/read': return { contents: [await readRequestedMcpResource(params, config)] };
    default: throw new McpRequestError(-32601, `Method not found: ${request.method}`);
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
  validateModernMetadata(meta as Record<string, unknown>);
}

function validateModernMetadata(meta: Record<string, unknown>): void {
  const requested = meta['io.modelcontextprotocol/protocolVersion'];
  const capabilities = meta['io.modelcontextprotocol/clientCapabilities'];
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
  return Boolean(meta && typeof meta === 'object' && !Array.isArray(meta)
    && 'io.modelcontextprotocol/protocolVersion' in meta);
}

function parseRequestLine(line: string):
  | { ok: true; request: JsonRpcRequest }
  | { ok: false; response: Record<string, unknown> } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    return { ok: false, response: rpcError(null, new McpRequestError(-32700, 'Parse error')) };
  }
  if (!isJsonRpcRequest(parsed)) {
    return { ok: false, response: rpcError(requestId(parsed), new McpRequestError(-32600, 'Invalid Request')) };
  }
  return { ok: true, request: parsed };
}

function completePublic(
  value: Record<string, unknown>,
  meta: Record<string, unknown>,
): Record<string, unknown> {
  return { resultType: 'complete', ...value, cacheScope: 'public', _meta: meta };
}

function serverInfo(config: T2CConfig): Record<string, string> {
  return { name: config.mcp.serverName, version: config.mcp.serverVersion };
}

function serverMeta(config: T2CConfig): Record<string, unknown> {
  return { 'io.modelcontextprotocol/serverInfo': serverInfo(config) };
}

function serverInstructions(): string {
  return 'Audited semantic LLM stages default to require-llm and fail closed; deterministic and prefer-llm remain explicit alternatives. OpenRouter access is isolated from deterministic extraction, linking, diagnostics and diff.';
}

function isLegacyProtocol(value: string): value is typeof MCP_LEGACY_PROTOCOLS[number] {
  return (MCP_LEGACY_PROTOCOLS as readonly string[]).includes(value);
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<JsonRpcRequest>;
  return candidate.jsonrpc === '2.0'
    && typeof candidate.method === 'string'
    && (candidate.params === undefined
      || (typeof candidate.params === 'object' && candidate.params !== null && !Array.isArray(candidate.params)));
}

function requestId(value: unknown): string | number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' || typeof id === 'number' || id === null ? id : null;
}

function rpcError(id: string | number | null, error: McpRequestError): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: error.code,
      message: error.message,
      ...(error.data === undefined ? {} : { data: error.data }),
    },
  };
}

function sendError(id: string | number | null, error: McpRequestError): void {
  send(rpcError(id, error));
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
