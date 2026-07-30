import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { pathExists, readJson } from '../core/io.js';
import { McpRequestError } from './mcp-errors.js';

const RESOURCES: Array<Record<string, unknown>> = [
  resource('t2c://latest/pointer', 'Latest run pointer', 'application/json'),
  resource('t2c://latest/manifest', 'Latest run manifest', 'application/json'),
  resource('t2c://latest/graph', 'Latest Intent graph', 'application/json'),
  resource('t2c://latest/diagnostics', 'Latest diagnostics', 'application/json'),
  resource('t2c://latest/summary', 'Latest team summary', 'text/markdown'),
  resource('t2c://latest/task-synthesis', 'Latest TODO task synthesis', 'application/json'),
  resource('t2c://latest/todo-validation', 'Latest TODO proposal validation', 'application/json'),
  resource('t2c://latest/todo-patch', 'Latest reviewable TODO patch', 'text/markdown'),
  resource('t2c://latest/todo-patch-audit', 'Latest TODO patch audit', 'application/json'),
  resource('t2c://latest/todo-apply-receipt', 'Latest TODO apply receipt', 'application/json'),
  resource('t2c://latest/communication-analysis', 'Latest participant communication analysis', 'application/json'),
  resource('t2c://latest/communication-report', 'Latest participant communication report', 'text/markdown'),
];

const RUN_RESOURCES: Record<string, [string, string]> = {
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

export async function listMcpResources(config: T2CConfig): Promise<Array<Record<string, unknown>>> {
  return await pathExists(latestPointer(config)) ? RESOURCES : [];
}

export async function readRequestedMcpResource(
  params: Record<string, unknown>,
  config: T2CConfig,
): Promise<Record<string, unknown>> {
  const uri = params.uri;
  if (typeof uri !== 'string' || !uri) throw new McpRequestError(-32602, 'resources/read requires uri');
  try {
    return await readMcpResource(uri, config);
  } catch (error) {
    if (error instanceof McpRequestError) throw error;
    if (isInvalidResourceError(error)) {
      throw new McpRequestError(-32602, error.message, { uri });
    }
    throw error;
  }
}

async function readMcpResource(uri: string, config: T2CConfig): Promise<Record<string, unknown>> {
  const latestPath = latestPointer(config);
  if (!(await pathExists(latestPath))) throw new Error('No latest t2c run exists');
  if (uri === 't2c://latest/pointer') {
    return { uri, mimeType: 'application/json', text: await fs.readFile(latestPath, 'utf8') };
  }

  const selected = RUN_RESOURCES[uri];
  if (!selected) throw new Error(`Unknown resource URI: ${uri}`);
  const latest = await readJson<{ runDirectory: string }>(latestPath);
  const filePath = path.resolve(config.root, latest.runDirectory, selected[0]);
  assertInsideRoot(filePath, config.root);
  return { uri, mimeType: selected[1], text: await fs.readFile(filePath, 'utf8') };
}

function latestPointer(config: T2CConfig): string {
  return path.resolve(config.root, config.outputDir, 'latest.json');
}

function assertInsideRoot(filePath: string, root: string): void {
  const relative = path.relative(root, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Resource escaped T2C_ROOT');
}

function isInvalidResourceError(error: unknown): error is Error {
  return error instanceof Error
    && (error.message.startsWith('Unknown resource URI:') || error.message.startsWith('No latest t2c run'));
}

function resource(uri: string, name: string, mimeType: string): Record<string, unknown> {
  return { uri, name, mimeType };
}
