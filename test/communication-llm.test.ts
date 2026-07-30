import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CommunicationLlmRequiredError,
  extractCommunicationIntentAudited,
} from '../src/communication/llm.js';
import { extractCommunicationIntent } from '../src/extractors/communication.js';
import { makeConfig } from './helpers.js';

async function fixture(): Promise<{ root: string; config: ReturnType<typeof makeConfig> }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-communication-llm-'));
  const ticket = path.join(root, 'project', 'COM-77');
  await fs.mkdir(ticket, { recursive: true });
  await fs.writeFile(path.join(ticket, 'human.alice.request.md'), [
    '---', 'participant: Alice', 'role: human', 'type: request', 'ticket: COM-77', '---',
    'System must inspect checkout for COM-77.', '',
  ].join('\n'));
  await fs.writeFile(path.join(ticket, 'agent.codex.claim.md'), [
    '---', 'participant: Codex', 'role: agent', 'type: claim', 'ticket: COM-77', '---',
    'Checkout inspection is implemented for COM-77.', '',
  ].join('\n'));
  return { root, config: makeConfig(root) };
}

test('communication enrichment preserves runtime identity, source, ticket and epistemic class', async () => {
  const { root, config } = await fixture();
  const deterministic = await extractCommunicationIntent({ root }, config);
  config.openRouter.apiKey = 'test-secret';
  config.openRouter.communicationModel = 'qwen/test-communication';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
    const payload = JSON.parse(request.messages[1]?.content ?? '{}') as {
      records: Array<{ recordId: string }>;
      participants: Array<{ participantKey: string; recordIds: string[] }>;
    };
    return new Response(JSON.stringify({
      id: 'comm-response-1', model: 'qwen/resolved-communication', provider: 'TestProvider',
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      choices: [{ message: { content: JSON.stringify({
        enrichments: payload.records.map((record) => ({
          recordId: record.recordId, action: 'validate', object: 'checkout contract', polarity: 'positive',
          confidence: 0.82, basis: ['explicit checkout statement'],
          target: { paths: ['src/checkout.ts'], symbols: ['validateCheckout'], versions: [] },
          topics: ['checkout', 'validation'],
        })),
        participantSyntheses: payload.participants.map((participant) => ({
          participantKey: participant.participantKey,
          summary: 'Participant discusses checkout validation.',
          commitments: ['Validate checkout.'], risks: [], recordIds: participant.recordIds, confidence: 0.8,
        })),
      }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await extractCommunicationIntentAudited({ root }, config, 'require-llm');
    assert.equal(result.audit.status, 'succeeded');
    assert.equal(result.audit.effectiveMode, 'llm');
    assert.equal(result.audit.responses[0]?.responseId, 'comm-response-1');
    assert.equal(result.participants.length, 2);
    assert.deepEqual(result.participants.map((item) => item.participant).sort(), ['Alice', 'Codex']);
    for (const before of deterministic.records) {
      const after = result.records.find((record) => record.statement.text === before.statement.text);
      assert.ok(after);
      assert.equal(after.statement.actor, before.statement.actor);
      assert.equal(after.metadata.participant, before.metadata.participant);
      assert.equal(after.metadata.participantRole, before.metadata.participantRole);
      assert.equal(after.metadata.ticket, before.metadata.ticket);
      assert.deepEqual(after.source.lines, before.source.lines);
      assert.equal(after.source.path, before.source.path);
      assert.equal(after.epistemic.class, before.epistemic.class);
      assert.ok(after.statement.target.tickets.includes('COM-77'));
      assert.ok(after.statement.target.paths.includes('src/checkout.ts'));
      assert.equal(after.metadata.llmUsed, true);
      assert.notEqual(after.epistemic.class, 'fact');
    }
    const enrichedIds = new Set(result.records.map((record) => record.id));
    assert.ok(result.participants.every((item) => item.recordIds.every((id) => enrichedIds.has(id))));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('communication prefer-llm fallback is explicit and require-llm rejects', async () => {
  const { root, config } = await fixture();
  const fallback = await extractCommunicationIntentAudited({ root }, config, 'prefer-llm');
  assert.equal(fallback.audit.status, 'fallback');
  assert.equal(fallback.audit.reason?.code, 'LLM_NOT_CONFIGURED');
  assert.equal(fallback.participants.length, 2);
  assert.ok(fallback.records.every((record) => record.metadata.llmUsed === false));
  await assert.rejects(
    () => extractCommunicationIntentAudited({ root }, config, 'require-llm'),
    (error: unknown) => error instanceof CommunicationLlmRequiredError
      && error.audit.reason?.code === 'LLM_NOT_CONFIGURED',
  );
});
