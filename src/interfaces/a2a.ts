import { createHash, timingSafeEqual } from 'node:crypto';
import http, { type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getConfig, loadEnvFile, type T2CConfig } from '../config/env.js';
import { executeAction } from '../services/actions.js';
import { diffUiHtml } from '../web/diff-ui.js';
import { sendAgentCard } from './a2a-card.js';
import { listIntentRuns } from './a2a-history.js';
import { clearA2aTaskStoreForTests, handleA2aRpc } from './a2a-task-store.js';
import {
  A2ARequestError,
  BodyTooLargeError,
  type JsonRpcRequest,
} from './a2a-types.js';

export { clearA2aTaskStoreForTests } from './a2a-task-store.js';

export async function startA2aServer(config?: T2CConfig): Promise<http.Server> {
  await loadEnvFile();
  const resolvedConfig = config ?? getConfig();
  const server = http.createServer((request, response) => {
    handleHttp(request, response, resolvedConfig).catch((error) => handleUnexpectedError(response, error));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(resolvedConfig.a2a.port, resolvedConfig.a2a.host, () => resolve());
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : resolvedConfig.a2a.port;
  process.stderr.write(`[t2c:a2a] listening on ${resolvedConfig.a2a.host}:${port}\n`);
  return server;
}

async function handleHttp(
  request: IncomingMessage,
  response: ServerResponse,
  config: T2CConfig,
): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (await handlePublicGet(request, response, url, config)) return;
  if (await handleAuthenticatedApi(request, response, url, config)) return;
  if (request.method !== 'POST' || !['/a2a', '/'].includes(url.pathname)) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }
  if (!requireAuthorization(request, response, config)) return;
  if (!requireProtocolVersion(request, response, url)) return;
  await handleJsonRpc(request, response, config);
}

async function handlePublicGet(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  config: T2CConfig,
): Promise<boolean> {
  if (request.method !== 'GET') return false;
  switch (url.pathname) {
    case '/healthz':
      sendJson(response, 200, { status: 'ok', service: 'todo2code', protocol: 'A2A', version: '1.0' });
      return true;
    case '/.well-known/agent-card.json':
      sendAgentCard(request, response, config);
      return true;
    case '/ui':
      sendText(response, 200, diffUiHtml(), 'text/html; charset=utf-8', {
        'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
      });
      return true;
    case '/':
      sendJson(response, 200, {
        name: 'todo2code A2A server',
        agentCard: '/.well-known/agent-card.json',
        endpoint: '/a2a',
        diffApi: '/api/diff',
        runsApi: '/api/runs',
        ui: '/ui',
      });
      return true;
    default:
      return false;
  }
}

async function handleAuthenticatedApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  config: T2CConfig,
): Promise<boolean> {
  if (request.method === 'GET' && url.pathname === '/api/runs') {
    if (!requireAuthorization(request, response, config)) return true;
    const filters = {
      participant: url.searchParams.get('participant'),
      role: url.searchParams.get('role'),
      ticket: url.searchParams.get('ticket'),
      severity: url.searchParams.get('severity'),
    };
    sendJson(response, 200, { runs: await listIntentRuns(config, filters) });
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/diff') {
    if (!requireAuthorization(request, response, config)) return true;
    await handleDiffApi(request, response, config);
    return true;
  }
  return false;
}

async function handleDiffApi(
  request: IncomingMessage,
  response: ServerResponse,
  config: T2CConfig,
): Promise<void> {
  try {
    const input = JSON.parse(await readBody(request, config.a2a.maxBodyBytes)) as Record<string, unknown>;
    sendJson(response, 200, await executeAction('diff', input, config));
  } catch (error) {
    sendJson(response, error instanceof BodyTooLargeError ? 413 : 400, { error: errorMessage(error) });
  }
}

async function handleJsonRpc(
  request: IncomingMessage,
  response: ServerResponse,
  config: T2CConfig,
): Promise<void> {
  const rpc = await parseRpcRequest(request, response, config.a2a.maxBodyBytes);
  if (!rpc) return;
  const isNotification = rpc.id === undefined;
  try {
    const result = await handleA2aRpc(rpc, config, principalForRequest(request, config));
    if (isNotification) sendNoContent(response);
    else sendJson(response, 200, { jsonrpc: '2.0', id: rpc.id ?? null, result });
  } catch (error) {
    if (isNotification) {
      sendNoContent(response);
      return;
    }
    sendRpcFailure(response, rpc.id ?? null, error);
  }
}

async function parseRpcRequest(
  request: IncomingMessage,
  response: ServerResponse,
  maxBytes: number,
): Promise<JsonRpcRequest | null> {
  let rpc: JsonRpcRequest;
  try {
    rpc = JSON.parse(await readBody(request, maxBytes)) as JsonRpcRequest;
  } catch (error) {
    const status = error instanceof BodyTooLargeError ? 413 : 400;
    sendJson(response, status, rpcError(null, -32700, errorMessage(error)));
    return null;
  }
  if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    sendJson(response, 400, rpcError(rpc.id ?? null, -32600, 'Invalid JSON-RPC request'));
    return null;
  }
  return rpc;
}

function sendRpcFailure(
  response: ServerResponse,
  id: string | number | null,
  error: unknown,
): void {
  const code = error instanceof A2ARequestError ? error.code : -32603;
  const metadata = error instanceof A2ARequestError ? error.metadata : undefined;
  const status = code === -32602 || code === -32005 ? 400 : 200;
  sendJson(response, status, rpcError(id, code, errorMessage(error), metadata));
}

function requireAuthorization(
  request: IncomingMessage,
  response: ServerResponse,
  config: T2CConfig,
): boolean {
  if (authorized(request, config)) return true;
  response.setHeader('WWW-Authenticate', 'Bearer realm="todo2code"');
  sendJson(response, 401, { error: 'Unauthorized' });
  return false;
}

function requireProtocolVersion(request: IncomingMessage, response: ServerResponse, url: URL): boolean {
  const requestedVersion = a2aVersion(request.headers, url);
  if (requestedVersion === '1.0') return true;
  sendJson(response, 400, rpcError(
    null,
    -32009,
    `A2A version not supported: ${requestedVersion}`,
    { requestedVersion },
  ));
  return false;
}

function a2aVersion(headers: IncomingHttpHeaders, url: URL): string {
  const raw = headers['a2a-version'];
  const headerVersion = Array.isArray(raw) ? raw[0] : raw;
  return (headerVersion ?? url.searchParams.get('A2A-Version') ?? '0.3').trim() || '0.3';
}

function authorized(request: IncomingMessage, config: T2CConfig): boolean {
  if (!config.a2a.token) return true;
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return false;
  const received = Buffer.from(header.slice(7));
  const expected = Buffer.from(config.a2a.token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function principalForRequest(request: IncomingMessage, config: T2CConfig): string {
  if (!config.a2a.token) return 'public';
  return `bearer:${createHash('sha256').update(request.headers.authorization ?? '').digest('hex')}`;
}

async function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunkValue of request) {
    const chunk = Buffer.isBuffer(chunkValue) ? chunkValue : Buffer.from(chunkValue);
    length += chunk.length;
    if (length > maxBytes) throw new BodyTooLargeError(`Request body exceeds ${maxBytes} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(payload);
}

function sendText(
  response: ServerResponse,
  status: number,
  body: string,
  contentType: string,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(body);
}

function sendNoContent(response: ServerResponse): void {
  response.writeHead(204, { 'Cache-Control': 'no-store' });
  response.end();
}

const A2A_ERROR_REASONS: Readonly<Record<number, string>> = {
  [-32001]: 'TASK_NOT_FOUND',
  [-32002]: 'TASK_NOT_CANCELABLE',
  [-32003]: 'PUSH_NOTIFICATION_NOT_SUPPORTED',
  [-32004]: 'UNSUPPORTED_OPERATION',
  [-32005]: 'CONTENT_TYPE_NOT_SUPPORTED',
  [-32006]: 'INVALID_AGENT_RESPONSE',
  [-32007]: 'EXTENDED_AGENT_CARD_NOT_CONFIGURED',
  [-32008]: 'EXTENSION_SUPPORT_REQUIRED',
  [-32009]: 'VERSION_NOT_SUPPORTED',
};

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  metadata?: Record<string, unknown>,
): Record<string, unknown> {
  const reason = A2A_ERROR_REASONS[code];
  const error: Record<string, unknown> = { code, message };
  if (reason) error.data = [errorInfo(reason, metadata)];
  return { jsonrpc: '2.0', id, error };
}

function errorInfo(reason: string, metadata?: Record<string, unknown>): Record<string, unknown> {
  const stringMetadata = Object.fromEntries(
    Object.entries({ ...(metadata ?? {}), timestamp: new Date().toISOString() })
      .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]),
  );
  return {
    '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
    reason,
    domain: 'a2a-protocol.org',
    metadata: stringMetadata,
  };
}

function handleUnexpectedError(response: ServerResponse, error: unknown): void {
  if (!response.headersSent) sendJson(response, 500, { error: errorMessage(error) });
  else response.end();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  startA2aServer().catch((error) => {
    process.stderr.write(`[t2c:a2a] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
