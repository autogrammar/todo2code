// Dependency-free HTTP server for the example backend.
//
// Mirrors the todo2code house style: node: builtins only, explicit body limits
// and no framework, so `t2c extract ast` sees plain TypeScript declarations.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { EventStore } from './store.js';
import { validateEventPayload } from './validation.js';

const MAX_BODY_BYTES = 64 * 1024;

export interface BackendOptions {
  host?: string;
  port?: number;
  store?: EventStore;
}

export function createBackend(options: BackendOptions = {}): { server: Server; store: EventStore } {
  const store = options.store ?? new EventStore();
  const server = createServer((request, response) => {
    handleRequest(request, response, store).catch((error: unknown) => {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    });
  });
  return { server, store };
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, store: EventStore): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok', events: store.size() });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/events') {
    await handlePostEvent(request, response, store);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/events') {
    handleListEvents(url, response, store);
    return;
  }

  sendJson(response, 404, { error: 'not found' });
}

async function handlePostEvent(
  request: IncomingMessage,
  response: ServerResponse,
  store: EventStore,
): Promise<void> {
  const payload = await parseJsonBody(request);
  if (payload === undefined) {
    sendJson(response, 400, { error: 'invalid JSON body' });
    return;
  }
  const validation = validateEventPayload(payload);
  if (!validation.valid) {
    // Every rejection is logged with its reason, per the acceptance criteria.
    process.stderr.write(`rejected event: ${validation.reason}\n`);
    sendJson(response, 400, { error: validation.reason });
    return;
  }
  const event = store.enqueueEvent(validation.agent, validation.action, validation.object);
  sendJson(response, 202, { id: event.id });
}

function handleListEvents(url: URL, response: ServerResponse, store: EventStore): void {
  const offset = finiteQueryNumber(url, 'offset', 0);
  const limit = finiteQueryNumber(url, 'limit', 50);
  sendJson(response, 200, store.listEvents(offset, limit));
}

function finiteQueryNumber(url: URL, name: string, fallback: number): number {
  const value = Number(url.searchParams.get(name) ?? String(fallback));
  return Number.isFinite(value) ? value : fallback;
}

async function parseJsonBody(request: IncomingMessage): Promise<unknown | undefined> {
  const body = await readBody(request);
  try {
    return JSON.parse(body || '{}');
  } catch {
    return undefined;
  }
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Buffer);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) throw new Error('request body too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

export function startBackend(options: BackendOptions = {}): Server {
  const { server } = createBackend(options);
  const port = options.port ?? 8080;
  const host = options.host ?? '127.0.0.1';
  server.listen(port, host, () => {
    process.stdout.write(`example backend listening on http://${host}:${port}\n`);
  });
  return server;
}
