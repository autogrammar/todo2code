import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { linkIntentRecords } from '../src/graph/linker.js';

const execFileAsync = promisify(execFile);

test('Python package executes the local TypeScript reality runtime without a server', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-python-runtime-'));
  const graph = linkIntentRecords([buildRecord({
    kind: 'declared_intent',
    action: 'add',
    object: 'local Python bridge',
    target: { paths: ['sdk/python/todo2code/runtime.py'] },
    text: 'Add local Python bridge.',
    lifecycle: 'proposed',
    sourceKind: 'todo',
    sourcePath: 'TODO.md',
    sourceLines: { start: 1, end: 1 },
    extractor: 'test',
    epistemicClass: 'declaration',
    confidence: 1,
    basis: ['test'],
  })], '2026-07-29T00:00:00.000Z');
  const graphPath = path.join(root, 'graph.json');
  await fs.writeFile(graphPath, JSON.stringify(graph), 'utf8');

  const script = [
    'import os',
    'from todo2code import TypeScriptRuntime',
    'runtime = TypeScriptRuntime(os.environ["T2C_TEST_ROOT"], cli_path=os.environ["T2C_TEST_CLI"])',
    'assert runtime.version() == "todo2code 0.4.0"',
    'result = runtime.reality(os.environ["T2C_TEST_GRAPH"], include_svg=True)',
    'assert result["view"]["schemaVersion"] == "t2c.reality/v1"',
    'assert result["svg"].startswith("<svg ")',
    'assert result["markdown"].startswith("# Intent vs Reality")',
    'print("python-typescript-runtime-ok")',
  ].join('\n');
  const result = await execFileAsync('python3', ['-c', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PYTHONPATH: path.resolve('sdk/python'),
      T2C_TEST_ROOT: root,
      T2C_TEST_CLI: path.resolve('dist/src/cli.js'),
      T2C_TEST_GRAPH: graphPath,
    },
    encoding: 'utf8',
  });
  assert.match(result.stdout, /python-typescript-runtime-ok/);
});
