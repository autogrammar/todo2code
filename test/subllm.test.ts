import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openRouterAuditConfiguration } from '../src/llm/audit.js';
import { OpenRouterClient } from '../src/llm/openrouter.js';
import { resolveSubllmRoute, shouldUseSubllm } from '../src/llm/subllm.js';
import { makeConfig } from './helpers.js';

interface Fixture {
  root: string;
  envFile: string;
  cleanup: () => Promise<void>;
}

const FIXTURE_CREDENTIAL = ['id', 'fixture-value'].join('.');

async function subllmFixture(): Promise<Fixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-subllm-'));
  const packageRoot = path.join(root, 'subllm');
  const envFile = path.join(root, 'shared.env');
  await fs.mkdir(packageRoot);
  await fs.writeFile(path.join(packageRoot, '__init__.py'), '', 'utf8');
  await fs.writeFile(path.join(packageRoot, 'cli.py'), `
import json
import os
import sys

args = sys.argv[1:]
if os.environ.get("T2C_UNRELATED_SECRET"):
    raise SystemExit("unrelated process secret crossed the SubLLM boundary")
if args[:3] == ["resolve", "todo2code", "semantic"]:
    print(json.dumps({
        "application": "todo2code",
        "application_name": "todo2code",
        "application_url": "https://github.com/autogrammar/todo2code",
        "function": "semantic",
        "provider": "zai",
        "model": "glm-5.3",
        "priority": 0,
        "api_base": "https://api.z.ai/api/coding/paas/v4",
        "api_key_env": "ZAI_API_KEY",
        "litellm_model": "zai/glm-5.3",
        "wire_model": "glm-5.3",
        "extra_headers": {},
    }))
elif args == ["env", "path"]:
    print(os.environ["SUBLLM_ENV_FILE"])
else:
    raise SystemExit(2)
`, 'utf8');
  await fs.writeFile(
    envFile,
    [
      ['ZAI_API_KEY', FIXTURE_CREDENTIAL].join('='),
      ['OPENROUTER_API_KEY', ''].join('='),
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  await fs.chmod(envFile, 0o600);

  const names = [
    'T2C_USE_SUBLLM', 'SUBLLM_PYTHONPATH', 'SUBLLM_ENV_FILE', 'T2C_UNRELATED_SECRET',
    'ZAI_API_KEY', 'OPENROUTER_API_KEY',
  ] as const;
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  process.env.T2C_USE_SUBLLM = 'true';
  process.env.SUBLLM_PYTHONPATH = root;
  process.env.SUBLLM_ENV_FILE = envFile;
  process.env.T2C_UNRELATED_SECRET = 'placeholder-not-forwarded';
  delete process.env.ZAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  return {
    root,
    envFile,
    cleanup: async () => {
      for (const name of names) {
        const value = previous.get(name);
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

test('SubLLM bridge resolves the selected central route without command-shell interpolation', async () => {
  const fixture = await subllmFixture();
  try {
    assert.equal(shouldUseSubllm(), true);
    const resolved = await resolveSubllmRoute();
    assert.equal(resolved.route.provider, 'zai');
    assert.equal(resolved.route.wire_model, 'glm-5.3');
    assert.equal(resolved.route.application, 'todo2code');
    assert.equal(resolved.credential, FIXTURE_CREDENTIAL);
    assert.equal(JSON.stringify(resolved.route).includes('fixture-value'), false);
  } finally {
    await fixture.cleanup();
  }
});

test('todo2code sends structured semantic requests through direct Z.AI resolved by SubLLM', async () => {
  const fixture = await subllmFixture();
  const config = makeConfig(fixture.root);
  const originalFetch = globalThis.fetch;
  let url = '';
  let headers: Record<string, string> = {};
  let body: Record<string, unknown> = {};
  let responseContent = '{"ok":true}';
  globalThis.fetch = async (input, init) => {
    url = String(input);
    headers = init?.headers as Record<string, string>;
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      id: 'zai-fixture-response',
      request_id: body.request_id,
      model: 'glm-5.3',
      usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
      choices: [{ message: { content: responseContent } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const client = new OpenRouterClient(config.openRouter);
    assert.equal(client.isConfigured(), true);
    const result = await client.chatJsonWithMetadata<{ ok: boolean }>(
      [{ role: 'user', content: 'Return the requested object.' }],
      'todo2code_subllm_test',
      { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    );

    assert.deepEqual(result.value, { ok: true });
    assert.equal(result.metadata.model, 'glm-5.3');
    assert.equal(result.metadata.provider, 'zai');
    assert.equal(url, 'https://api.z.ai/api/coding/paas/v4/chat/completions');
    assert.equal(headers.Authorization, `Bearer ${FIXTURE_CREDENTIAL}`);
    assert.equal(headers['X-OpenRouter-Title'], undefined);
    assert.equal(headers['HTTP-Referer'], undefined);
    assert.equal(body.model, 'glm-5.3');
    assert.equal(body.user_id, 'todo2code');
    assert.match(String(body.request_id), /^todo2code-semantic-[0-9a-f]{32}$/u);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.equal(body.provider, undefined);
    assert.equal(body.plugins, undefined);
    const messages = body.messages as Array<{ role: string; content: string }>;
    assert.match(messages[0]?.content ?? '', /"required":\["ok"\]/u);
    assert.equal(JSON.stringify(body).includes('fixture-value'), false);

    const audit = openRouterAuditConfiguration(config, config.openRouter.model);
    assert.deepEqual(audit.effectiveRouting, {
      source: 'subllm',
      status: 'resolved',
      application: 'todo2code',
      function: 'semantic',
      provider: 'zai',
      model: 'glm-5.3',
      wireModel: 'glm-5.3',
      priority: 0,
      apiBase: 'https://api.z.ai/api/coding/paas/v4',
    });
    assert.equal(JSON.stringify(audit).includes('fixture-value'), false);

    responseContent = '{"ok":';
    await assert.rejects(
      () => client.chatJson([{ role: 'user', content: 'Return the requested object.' }], 'invalid_json', {}),
      (error: unknown) => error instanceof Error
        && /Z\.AI JSON parsing failed/u.test(error.message)
        && !error.message.includes('OpenRouter JSON parsing failed'),
    );
  } finally {
    globalThis.fetch = originalFetch;
    await fixture.cleanup();
  }
});

test('SubLLM is the default semantic route and legacy OpenRouter requires an explicit opt-out', () => {
  assert.equal(shouldUseSubllm({}), true);
  assert.equal(shouldUseSubllm({ T2C_USE_SUBLLM: 'true' }), true);
  assert.equal(shouldUseSubllm({ T2C_USE_SUBLLM: 'false' }), false);
});

test('explicitly requested SubLLM fails closed when its package is unavailable', async () => {
  const previousUse = process.env.T2C_USE_SUBLLM;
  const previousPath = process.env.SUBLLM_PYTHONPATH;
  const previousPython = process.env.SUBLLM_PYTHON;
  try {
    process.env.T2C_USE_SUBLLM = 'true';
    process.env.SUBLLM_PYTHONPATH = path.join(os.tmpdir(), 'missing-subllm-package');
    process.env.SUBLLM_PYTHON = path.join(os.tmpdir(), 'missing-python-executable');
    const config = makeConfig(process.cwd());
    config.openRouter.apiKey = 'test-policy-bypass-credential';

    await assert.rejects(
      () => new OpenRouterClient(config.openRouter).chatText([{ role: 'user', content: 'test' }]),
      (error: unknown) => error instanceof Error
        && /SubLLM route resolution failed/u.test(error.message)
        && !error.message.includes('test-policy-bypass-credential'),
    );
  } finally {
    if (previousUse === undefined) delete process.env.T2C_USE_SUBLLM;
    else process.env.T2C_USE_SUBLLM = previousUse;
    if (previousPath === undefined) delete process.env.SUBLLM_PYTHONPATH;
    else process.env.SUBLLM_PYTHONPATH = previousPath;
    if (previousPython === undefined) delete process.env.SUBLLM_PYTHON;
    else process.env.SUBLLM_PYTHON = previousPython;
  }
});
