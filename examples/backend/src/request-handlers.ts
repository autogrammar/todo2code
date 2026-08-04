import { type IncomingMessage, type ServerResponse } from 'node:http';
import { EventStore } from './store.js';
import { validateEventPayload } from './validation.js';

const MAX_BODY_BYTES = 64 * 1024;

export async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  store: EventStore,
): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (url.pathname === '/health' && request.method === 'GET') {
    return handleHealth(response, store);
  }
  if (url.pathname === '/events' && request.method === 'POST') {
    return handleEventPublish(request, response, store);
  }
  if (url.pathname === '/events' && request.method === 'GET') {
    return handleEventList(response, url.searchParams, store);
  }
  sendJson(response, 404, { error: 'not found' });
}

async function handleHealth(response: ServerResponse, store: EventStore): Promise<void> {
  sendJson(response, 200, { status: 'ok', events: store.size() });
}

async function handleEventPublish(request: IncomingMessage, response: ServerResponse, store: EventStore): Promise<void> {
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
    process.stderr.write(`rejected event: ${validation.reason}\n`);
    sendJson(response, 400, { error: validation.reason });
    return;
  }

  const event = store.enqueueEvent(validation.agent, validation.action, validation.object);
  sendJson(response, 202, { id: event.id });
}

async function handleEventList(response: ServerResponse, params: URLSearchParams, store: EventStore): Promise<void> {
  const offset = parseOffset(params.get('offset'));
  const limit = parseLimit(params.get('limit'));
  sendJson(response, 200, store.listEvents(
    offset,
    limit,
  ));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 50;
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
