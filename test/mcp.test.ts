import assert from 'node:assert/strict';
import test from 'node:test';
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
  const toolNames = (tools.tools as Array<{ name?: string }>).map((tool) => tool.name);
  assert.equal(toolNames.length, 20);
  assert.ok(toolNames.includes('extract_config'));
  assert.ok([
    'extract_communication', 'analyze_communication', 'diff', 'diff_files', 'diff_git', 'reality',
    'compare_workspace', 'propose_todo', 'render_todo', 'apply_todo',
  ].every((name) => toolNames.includes(name)));
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
  assert.equal((tools.tools as unknown[]).length, 20);
  assert.equal('resultType' in tools, false);
});
