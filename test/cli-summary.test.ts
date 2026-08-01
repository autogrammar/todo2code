import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { buildRecord } from '../src/core/record.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';

const exec = promisify(execFile);

test('CLI summarize exposes deterministic, prefer-llm and require-llm modes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cli-summary-'));
  const cli = path.resolve('dist/src/cli.js');
  const record = buildRecord({
    kind: 'declared_intent', action: 'add', object: 'summary.mode', text: 'Add an explicit summary mode.',
    lifecycle: 'proposed', sourceKind: 'nl', sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 },
    extractor: 'test', epistemicClass: 'declaration', confidence: 1, basis: ['test'],
  });
  const graph = linkIntentRecords([record], '2026-07-30T00:00:00.000Z');
  const diagnostics = diagnoseGraph(graph, '2026-07-30T00:00:00.000Z');
  await fs.writeFile(path.join(root, 'graph.json'), `${JSON.stringify(graph)}\n`, 'utf8');
  await fs.writeFile(path.join(root, 'diagnostics.json'), `${JSON.stringify(diagnostics)}\n`, 'utf8');
  const environment = { ...process.env, OPENROUTER_API_KEY: '', T2C_ENV_FILE: 'missing.env' };
  const base = ['summarize', 'graph.json', '--diagnostics', 'diagnostics.json'];

  const deterministic = await exec(process.execPath, [cli, ...base, '--mode', 'deterministic'], {
    cwd: root, env: environment,
  });
  assert.match(deterministic.stdout, /Wygenerowano deterministycznie/);
  assert.equal(deterministic.stderr, '');

  await assert.rejects(
    () => exec(process.execPath, [cli, ...base], { cwd: root, env: environment }),
    (error: unknown) => error instanceof Error && /OPENROUTER_API_KEY is required/.test(String(error)),
  );

  const preferred = await exec(process.execPath, [cli, ...base, '--mode', 'prefer-llm'], { cwd: root, env: environment });
  assert.match(preferred.stdout, /podsumowanie OpenRouter nie było dostępne/);
  assert.match(preferred.stderr, /OPENROUTER_API_KEY is not configured/);

  await assert.rejects(
    () => exec(process.execPath, [cli, ...base, '--mode', 'require-llm'], { cwd: root, env: environment }),
    (error: unknown) => error instanceof Error && /OPENROUTER_API_KEY is required/.test(String(error)),
  );
  await assert.rejects(
    () => exec(process.execPath, [cli, ...base, '--mode', 'automatic'], { cwd: root, env: environment }),
    (error: unknown) => error instanceof Error && /--mode must be deterministic, prefer-llm or require-llm/.test(String(error)),
  );
});
