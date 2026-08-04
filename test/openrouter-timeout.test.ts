import assert from 'node:assert/strict';
import test from 'node:test';
import { openRouterAuditConfiguration } from '../src/llm/audit.js';
import { OpenRouterClient } from '../src/llm/openrouter.js';
import {
  calculateOpenRouterTimeout,
  OPENROUTER_TIMEOUT_POLICY,
  openRouterRequestTimeout,
  type OpenRouterTimeoutLoad,
} from '../src/llm/openrouter-timeout.js';
import { makeConfig } from './helpers.js';

const baselineLoad: OpenRouterTimeoutLoad = {
  serializedInputCharacters: OPENROUTER_TIMEOUT_POLICY.inputCharactersBaseline,
  outputTokens: OPENROUTER_TIMEOUT_POLICY.outputTokensBaseline,
  messageCount: OPENROUTER_TIMEOUT_POLICY.complexityPointsBaseline,
  strictJsonSchema: false,
  responseHealing: false,
};

test('adaptive OpenRouter timeout scales at exact power-of-two boundaries', () => {
  assert.equal(calculateOpenRouterTimeout(1_000, baselineLoad).effectiveTimeoutMs, 1_000);
  assert.equal(calculateOpenRouterTimeout(1_000, {
    ...baselineLoad,
    serializedInputCharacters: 8_001,
  }).effectiveTimeoutMs, 2_000);
  assert.equal(calculateOpenRouterTimeout(1_000, {
    ...baselineLoad,
    serializedInputCharacters: 16_001,
  }).effectiveTimeoutMs, 4_000);
  assert.equal(calculateOpenRouterTimeout(1_000, {
    ...baselineLoad,
    serializedInputCharacters: 32_001,
  }).effectiveTimeoutMs, 8_000);
});

test('output budget and structural complexity independently scale timeout', () => {
  const output = calculateOpenRouterTimeout(2_000, {
    ...baselineLoad,
    serializedInputCharacters: 1,
    messageCount: 1,
    outputTokens: 6_001,
  });
  assert.equal(output.multiplier, 2);

  const structured = openRouterRequestTimeout({
    messages: [{ role: 'system', content: 'a' }, { role: 'user', content: 'b' }],
    max_tokens: 1,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'test', strict: true, schema: { type: 'object' } },
    },
    plugins: [{ id: 'response-healing' }],
  }, 2_000);
  assert.equal(structured.complexityPoints, 5);
  assert.equal(structured.multiplier, 2);
  assert.equal(structured.effectiveTimeoutMs, 4_000);
});

test('adaptive OpenRouter timeout caps at ten minutes', () => {
  const decision = calculateOpenRouterTimeout(120_000, {
    ...baselineLoad,
    serializedInputCharacters: 32_001,
  });
  assert.equal(decision.multiplier, 8);
  assert.equal(decision.effectiveTimeoutMs, 600_000);
  assert.equal(decision.capped, true);
});

test('adaptive OpenRouter timeout rejects malformed and unbounded inputs', () => {
  assert.throws(
    () => calculateOpenRouterTimeout(Number.POSITIVE_INFINITY, baselineLoad),
    /positive finite number/,
  );
  assert.throws(
    () => calculateOpenRouterTimeout(600_001, baselineLoad),
    /must not exceed 600000 ms/,
  );
  assert.throws(
    () => openRouterRequestTimeout({ messages: 'invalid', max_tokens: 1 }, 1_000),
    /messages must be an array/,
  );
  assert.throws(
    () => openRouterRequestTimeout({ messages: [], max_tokens: Number.NaN }, 1_000),
    /max_tokens must be a non-negative safe integer/,
  );
});

test('OpenRouter audit records the non-secret adaptive timeout policy', () => {
  const config = makeConfig(process.cwd());
  const audit = openRouterAuditConfiguration(config, 'z-ai/glm-5.2');
  assert.deepEqual(audit.adaptiveTimeout, {
    baseTimeoutMs: config.openRouter.timeoutMs,
    inputCharactersBaseline: 8_000,
    outputTokensBaseline: 6_000,
    complexityPointsBaseline: 4,
    scaleFactor: 2,
    maximumMultiplier: 8,
    maximumTimeoutMs: 600_000,
  });
  assert.equal(JSON.stringify(audit).includes('apiKey'), false);
});

test('external cancellation remains immediate before an OpenRouter fetch', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-openrouter-credential';
  const deadline = new AbortController();
  deadline.abort();
  config.openRouter.signal = deadline.signal;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('fetch should not be called');
  };
  try {
    await assert.rejects(
      () => new OpenRouterClient(config.openRouter).chatText([{ role: 'user', content: 'test' }]),
      /aborted by pipeline deadline/,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retry backoff remains inside one effective OpenRouter deadline', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-openrouter-credential';
  config.openRouter.timeoutMs = 10;
  config.openRouter.maxTokens = 6_001;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: 'retry later' } }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    await assert.rejects(
      () => new OpenRouterClient(config.openRouter).chatText([{ role: 'user', content: 'test' }]),
      /timed out after 20 ms \(base 10 ms, adaptive 2x\)/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
