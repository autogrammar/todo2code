import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { payloadHash, type IntakeCommand } from '../src/communication/intake-contract.js';
import {
  MCP_MODERN_PROTOCOL,
  createMcpConnectionState,
  handleMcpRequest,
  type JsonRpcRequest,
} from '../src/interfaces/mcp.js';
import { makeConfig } from './helpers.js';

function modernRequest(id: string, method: string, params: Record<string, unknown> = {}): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params: {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': MCP_MODERN_PROTOCOL,
        'io.modelcontextprotocol/clientInfo': { name: 'test-client', version: '1.0.0' },
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    },
  };
}

test('MCP 2026 profile is stateless and exposes discovery plus complete results', async () => {
  const config = makeConfig(process.cwd());
  const discover = await handleMcpRequest(modernRequest('1', 'server/discover'), config) as Record<string, unknown>;
  assert.equal(discover.resultType, 'complete');
  assert.deepEqual((discover.supportedVersions as string[])[0], MCP_MODERN_PROTOCOL);
  assert.ok(discover._meta);

  const tools = await handleMcpRequest(modernRequest('2', 'tools/list'), config) as Record<string, unknown>;
  assert.equal(tools.resultType, 'complete');
  const listedTools = tools.tools as Array<{ name?: string; annotations?: { destructiveHint?: boolean } }>;
  const toolNames = listedTools.map((tool) => tool.name);
  assert.equal(toolNames.length, 28);
  assert.ok(toolNames.includes('extract_config'));
  assert.ok([
    'extract_communication', 'analyze_communication', 'diff', 'diff_files', 'diff_git', 'reality',
    'compare_workspace', 'propose_todo', 'render_todo', 'apply_todo',
    'propose_code_change', 'render_code_change', 'propose_source_patch', 'apply_source_patch',
    'evaluate_code_change', 'close_code_change',
    'intake_command', 'intake_query',
  ].every((name) => toolNames.includes(name)));
  assert.equal(listedTools.find((tool) => tool.name === 'apply_source_patch')?.annotations?.destructiveHint, true);
  assert.equal(tools.cacheScope, 'public');
  assert.ok(tools._meta);
});

test('MCP 2026 rejects missing metadata and unsupported versions with protocol errors', async () => {
  const config = makeConfig(process.cwd());
  await assert.rejects(
    () => handleMcpRequest({ jsonrpc: '2.0', id: '1', method: 'server/discover', params: {} }, config),
    (error: unknown) => error instanceof Error && error.message.includes('Missing required params._meta'),
  );

  const request = modernRequest('2', 'tools/list');
  const meta = request.params?._meta as Record<string, unknown>;
  meta['io.modelcontextprotocol/protocolVersion'] = '1900-01-01';
  await assert.rejects(
    () => handleMcpRequest(request, config),
    (error: unknown) => {
      const typed = error as Error & { code?: number; data?: { requested?: string } };
      return typed.code === -32022 && typed.data?.requested === '1900-01-01';
    },
  );
});

test('MCP legacy profile negotiates 2025-11-25 and requires initialize', async () => {
  const config = makeConfig(process.cwd());
  const state = createMcpConnectionState();
  await assert.rejects(
    () => handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, config, state),
    /requires initialize/,
  );

  const initialized = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy', version: '1' } },
  }, config, state) as Record<string, unknown>;
  assert.equal(initialized.protocolVersion, '2025-11-25');

  const tools = await handleMcpRequest({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }, config, state) as Record<string, unknown>;
  assert.equal((tools.tools as unknown[]).length, 28);
  assert.equal('resultType' in tools, false);
});

test('MCP exposes annotated intake command/query tools backed by the domain handler', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-mcp-intake-'));
  await fs.mkdir(path.join(root, 'project'), { recursive: true });
  const config = makeConfig(root);
  const payload: IntakeCommand = {
    schemaVersion: 't2c.intake-command/v1',
    type: 'RegisterParticipant',
    participant: {
      id: 'human:manager', kind: 'human', displayName: 'Manager', governanceRole: 'manager',
      capabilities: ['assign_participant', 'assign_role', 'capture_own_message', 'rebuild_projection', 'verify_event_stream'],
      principals: [{ provider: 'ide', subject: 'manager', verifiedAt: '2026-08-01T12:00:00.000Z' }],
      ticketIds: ['ticket-020'],
    },
  };
  const envelope = {
    schemaVersion: 't2c.intake-envelope/v1', messageId: 'mcp-register', correlationId: 'mcp-correlation',
    causationId: null, idempotencyKey: 'mcp-register', authenticatedPrincipal: 'trusted:mcp',
    expectedVersion: 0, timestamp: '2026-08-01T12:00:00.000Z', payloadHash: payloadHash(payload), payload,
  };
  const response = await handleMcpRequest(modernRequest('intake', 'tools/call', {
    name: 'intake_command', arguments: { envelope },
  }), config) as { structuredContent: { accepted: boolean; actualVersion: number } };
  assert.equal(response.structuredContent.accepted, true);
  assert.equal(response.structuredContent.actualVersion, 1);

  const listed = await handleMcpRequest(modernRequest('list-intake', 'tools/list'), config) as {
    tools: Array<{ name: string; annotations: { readOnlyHint: boolean; destructiveHint: boolean } }>;
  };
  assert.equal(listed.tools.find((tool) => tool.name === 'intake_command')?.annotations.readOnlyHint, false);
  assert.equal(listed.tools.find((tool) => tool.name === 'intake_query')?.annotations.readOnlyHint, true);
});
