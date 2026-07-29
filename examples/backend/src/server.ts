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
    const body = await readBody(request);
    let payload: unknown;
    try {
      payload = JSON.parse(body || '{}');
    } catch {
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
    return;
  }

  if (request.method === 'GET' && url.pathname === '/events') {
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '50');
    sendJson(response, 200, store.listEvents(
      Number.isFinite(offset) ? offset : 0,
      Number.isFinite(limit) ? limit : 50,
    ));
    return;
  }

  sendJson(response, 404, { error: 'not found' });
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
