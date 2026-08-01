import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { T2CConfig } from '../config/env.js';
import { T2C_VERSION } from '../version.js';

export function sendAgentCard(
  request: IncomingMessage,
  response: ServerResponse,
  config: T2CConfig,
): void {
  const card = agentCard(config);
  const serialized = JSON.stringify(card);
  const etag = `"${createHash('sha256').update(serialized).digest('base64url')}"`;
  if (request.headers['if-none-match'] === etag) {
    response.writeHead(304, { ETag: etag, 'Cache-Control': 'public, max-age=300' });
    response.end();
    return;
  }
  const payload = JSON.stringify(card);
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'public, max-age=300',
    ETag: etag,
  });
  response.end(payload);
}

export function agentCard(config: T2CConfig): Record<string, unknown> {
  const card: Record<string, unknown> = {
    name: 'todo2code',
    description: 'Intent extraction, evidence graph, diagnostics and grounded team summaries for software repositories.',
    version: T2C_VERSION,
    supportedInterfaces: [{ url: config.a2a.publicUrl, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }],
    capabilities: { streaming: false, pushNotifications: false, extensions: [] },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['application/json', 'text/markdown', 'text/plain'],
    skills: skills(),
  };
  if (config.a2a.token) {
    card.securitySchemes = {
      bearerAuth: {
        httpAuthSecurityScheme: {
          description: 'Static bearer token configured with T2C_A2A_TOKEN.',
          scheme: 'Bearer',
          bearerFormat: 'opaque',
        },
      },
    };
    card.securityRequirements = [{ schemes: { bearerAuth: { list: [] } } }];
  }
  return card;
}

function skills(): Array<Record<string, unknown>> {
  return [
    skill(
      'governed_intake',
      'Governed trusted intake',
      'Execute role-bound CQRS commands and queries with idempotency, optimistic concurrency and deterministic diagnostics.',
      ['governance', 'cqrs', 'event-sourcing', 'protobuf', 'identity'],
      [
        '{"action":"intake_command","input":{"envelope":{"schemaVersion":"t2c.intake-envelope/v1","payload":{"schemaVersion":"t2c.intake-command/v1","type":"CaptureMessage"}}}}',
        '{"action":"intake_query","input":{"envelope":{"schemaVersion":"t2c.intake-envelope/v1","payload":{"schemaVersion":"t2c.intake-query/v1","type":"GetRole"}}}}',
      ],
      ['application/json', 'application/x-protobuf'],
      ['application/json', 'application/x-protobuf'],
    ),
    skill(
      'analyze_repository',
      'Analyze repository',
      'Run the full t2c pipeline over NL, Git, AST, TODO, CHANGELOG and optional documentation.',
      ['intent', 'git', 'ast', 'todo', 'documentation'],
      ['{"action":"pipeline","input":{"root":".","task":"TASK.md"}}'],
      ['application/json'],
      ['application/json', 'text/markdown'],
    ),
    skill(
      'extract_intent',
      'Extract intent',
      'Run one deterministic or OpenRouter-backed extractor.',
      ['intent-dsl', 'extraction'],
      ['{"action":"extract_git","input":{"count":10}}'],
      ['text/plain', 'application/json'],
      ['application/json'],
    ),
    skill(
      'diagnose_alignment',
      'Diagnose alignment',
      'Detect planned-but-not-implemented, undocumented and conflicting intent.',
      ['diagnostics', 'alignment'],
      ['{"action":"diagnose","input":{"graph":{...}}}'],
      ['application/json'],
      ['application/json'],
    ),
    skill(
      'analyze_team_communication',
      'Analyze team communication',
      'Compare per-ticket human and agent statements with Git and AST evidence.',
      ['communication', 'agents', 'humans', 'intent-vs-reality'],
      ['{"action":"analyze_communication","input":{"root":".","projectDir":"project"}}'],
      ['application/json'],
      ['application/json', 'text/markdown'],
    ),
    skill(
      'summarize_team_state',
      'Summarize team state',
      'Use OpenRouter to generate a grounded Polish report from the canonical graph.',
      ['openrouter', 'summary', 'team'],
      ['{"action":"summarize","input":{"graph":{...},"diagnostics":{...}}}'],
      ['application/json'],
      ['text/markdown'],
    ),
    skill(
      'compare_intent_graphs',
      'Compare intent graphs',
      'Compute deterministic t2c.diff/v1 data and an SVG visualization for two Intent graphs.',
      ['diff', 'intent-dsl', 'svg'],
      ['{"action":"diff","input":{"beforeGraph":{},"afterGraph":{}}}'],
      ['application/json'],
      ['application/json', 'image/svg+xml'],
    ),
    skill(
      'render_file_diff',
      'Render file diff',
      'Diff two files or the Git work tree with the deterministic Myers engine and render SVG or HTML.',
      ['diff', 'git', 'svg'],
      [
        '{"action":"diff_files","input":{"before":"a.ts","after":"b.ts"}}',
        '{"action":"diff_git","input":{"revision":"HEAD"}}',
      ],
      ['application/json'],
      ['application/json', 'image/svg+xml', 'text/html'],
    ),
    skill(
      'compare_intent_reality',
      'Compare intent and reality',
      'Group graph records into topics and report where plan, code and documentation diverge.',
      ['diff', 'alignment', 'svg'],
      ['{"action":"reality","input":{"graph":{}}}'],
      ['application/json'],
      ['application/json', 'image/svg+xml', 'text/markdown'],
    ),
    skill(
      'review_todo_changes',
      'Propose, review and apply TODO changes',
      'Synthesize grounded proposals, render a hash-bound TODO.patch, and apply it only after explicit human approval.',
      ['dsl2todo', 'review', 'approval', 'audit'],
      [
        '{"action":"propose_todo","input":{"graphPath":".intent/runs/<run>/intent.graph.json","diagnosticsPath":".intent/runs/<run>/diagnostics.json","mode":"prefer-llm"}}',
        '{"action":"apply_todo","input":{"patch":"TODO.patch","audit":"TODO.patch.json","receipt":"receipt.json","actor":"reviewer","approvalHash":"<sha256>"}}',
      ],
      ['application/json'],
      ['application/json', 'text/markdown'],
    ),
    skill(
      'review_code_changes',
      'Propose and evaluate grounded code-change plans',
      'Turn open implementation diagnostics into t2c.code-change-plan/v1 proposals and evaluate acceptance after re-analysis. Never auto-applies source edits.',
      ['code-change', 'acceptance', 'intent-vs-reality', 'audit'],
      [
        '{"action":"propose_code_change","input":{"graphPath":".intent/runs/<run>/intent.graph.json","diagnosticsPath":".intent/runs/<run>/diagnostics.json"}}',
        '{"action":"evaluate_code_change","input":{"planPath":"plans.json","beforeGraphPath":"before.graph.json","afterGraphPath":"after.graph.json"}}',
      ],
      ['application/json'],
      ['application/json'],
    ),
  ];
}

function skill(
  id: string,
  name: string,
  description: string,
  tags: string[],
  examples: string[],
  inputModes: string[],
  outputModes: string[],
): Record<string, unknown> {
  return { id, name, description, tags, examples, inputModes, outputModes };
}
