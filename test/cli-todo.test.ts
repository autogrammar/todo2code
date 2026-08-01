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

test('CLI propose-todo, render-todo and apply-todo return JSON and preserve a no-op TODO', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cli-todo-'));
  const todoContent = '# TODO\n\n- [ ] Existing CLI task.\n';
  await fs.writeFile(path.join(root, 'TODO.md'), todoContent);
  const record = buildRecord({
    kind: 'todo_item', action: 'add', object: 'existing CLI task', text: 'Existing CLI task.',
    lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md', sourceLines: { start: 3, end: 3 },
    extractor: 'test/cli-todo', epistemicClass: 'plan', confidence: 1, basis: ['fixture'],
  });
  const graph = linkIntentRecords([record], '2026-07-30T08:00:00.000Z');
  const diagnostics = diagnoseGraph(graph, '2026-07-30T08:00:00.000Z');
  await fs.writeFile(path.join(root, 'graph.json'), `${JSON.stringify(graph)}\n`);
  await fs.writeFile(path.join(root, 'diagnostics.json'), `${JSON.stringify(diagnostics)}\n`);
  const environment = { ...process.env, T2C_ROOT: root, OPENROUTER_API_KEY: '' };

  await assert.rejects(
    () => runCli(root, environment, [
      'propose-todo', 'graph.json', '--diagnostics', 'diagnostics.json',
      '--out', 'run/default-synthesis.json', '--root', root,
    ]),
    (error: unknown) => error instanceof Error && /tasks requires LLM/.test(String(error)),
  );

  const proposed = await runCli(root, environment, [
    'propose-todo', 'graph.json', '--diagnostics', 'diagnostics.json', '--mode', 'prefer-llm',
    '--out', 'run/synthesis.json', '--root', root,
  ]);
  assert.equal(proposed.audit.status, 'fallback');
  assert.deepEqual(proposed.validation.newProposalIds, []);

  const rendered = await runCli(root, environment, [
    'render-todo', 'run/synthesis.json', '--graph', 'graph.json', '--diagnostics', 'diagnostics.json',
    '--todo', 'TODO.md', '--patch', 'run/TODO.patch', '--audit', 'run/TODO.patch.json', '--root', root,
  ]);
  const patchHash = String(rendered.artifact.renderedPatchHash);
  assert.match(patchHash, /^[a-f0-9]{64}$/);
  assert.equal(await fs.readFile(path.join(root, 'TODO.md'), 'utf8'), todoContent);

  const applied = await runCli(root, environment, [
    'apply-todo', '--todo', 'TODO.md', '--patch', 'run/TODO.patch', '--audit', 'run/TODO.patch.json',
    '--receipt', 'run/TODO.patch.receipt.json', '--actor', 'cli-reviewer', '--approval-hash', patchHash,
    '--root', root,
  ]);
  assert.equal(applied.applied, false);
  assert.equal(applied.idempotent, true);
  assert.equal(applied.receipt.approvedBy, 'cli-reviewer');
  assert.equal(await fs.readFile(path.join(root, 'TODO.md'), 'utf8'), todoContent);
});

async function runCli(root: string, env: NodeJS.ProcessEnv, args: string[]): Promise<Record<string, any>> {
  const result = await exec(process.execPath, [path.resolve('dist/src/cli.js'), ...args], { cwd: root, env });
  return JSON.parse(result.stdout) as Record<string, any>;
}
