// Dependency-free HTTP server for the example backend.
//
// Mirrors the todo2code house style: node: builtins only, explicit body limits
// and no framework, so `t2c extract ast` sees plain TypeScript declarations.

import { createServer, type Server, type ServerResponse } from 'node:http';
import { EventStore } from './store.js';
import { handleRequest } from './request-handlers.js';

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
