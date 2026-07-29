import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { clearA2aTaskStoreForTests, startA2aServer } from '../src/interfaces/a2a.js';
import { Todo2CodeClient } from '../src/sdk/typescript.js';
import { makeConfig } from './helpers.js';

const execFileAsync = promisify(execFile);

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function graph(text: string) {
  return linkIntentRecords([buildRecord({
    kind: 'declared_intent',
    action: 'add',
    object: text,
    text,
    lifecycle: 'proposed',
    sourceKind: 'nl',
    sourcePath: 'TASK.md',
    sourceLines: { start: 1, end: 1 },
    extractor: 'test',
    epistemicClass: 'declaration',
    confidence: 1,
    basis: ['test'],
  })], '2026-07-29T00:00:00.000Z');
}

test('diff UI and TypeScript/Python SDKs use the live backend runtime', async () => {
  clearA2aTaskStoreForTests();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-sdk-'));
  const before = graph('before');
  const after = graph('after');
  await Promise.all([
    fs.writeFile(path.join(root, 'before.json'), JSON.stringify(before), 'utf8'),
    fs.writeFile(path.join(root, 'after.json'), JSON.stringify(after), 'utf8'),
    fs.writeFile(path.join(root, 'before.ts'), 'const value = 1;\n', 'utf8'),
    fs.writeFile(path.join(root, 'after.ts'), 'const value = 2;\n', 'utf8'),
  ]);
  const config = makeConfig(root);
  config.a2a.port = 0;
  const server = await startA2aServer(config);
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const ui = await fetch(`${baseUrl}/ui`);
    assert.equal(ui.status, 200);
    assert.match(ui.headers.get('content-type') ?? '', /^text\/html/);
    assert.match(await ui.text(), /Graph diff, made visible/);

    const client = new Todo2CodeClient({ baseUrl });
    assert.equal((await client.health()).status, 'ok');
    const diff = await client.diffGraphs(before, after);
    assert.equal(diff.diff.summary.recordsChanged, 1);
    assert.match(diff.svg ?? '', /^<svg /);
    const fileDiff = await client.diffGraphFiles('before.json', 'after.json', false);
    assert.equal(fileDiff.diff.summary.recordsChanged, 1);
    assert.equal(fileDiff.svg, undefined);
    const textDiff = await client.diffTextFiles('before.ts', 'after.ts', { includeSvg: false });
    assert.equal(textDiff.diffs[0]?.summary.added, 1);
    assert.match(textDiff.unified, /\+const value = 2;/);
    const reality = await client.reality(after, { includeSvg: false });
    assert.equal(reality.view.schemaVersion, 't2c.reality/v1');
    const extraction = await client.run<{ records: unknown[] }>('extract_nl', { text: 'Dodać SDK.', file: 'sdk.md' });
    assert.equal(extraction.records.length, 1);

    const python = await execFileAsync('python3', ['-c', [
      'import os',
      'from sdk.python import Todo2CodeClient',
      'client = Todo2CodeClient(os.environ["T2C_TEST_URL"])',
      'assert client.health()["status"] == "ok"',
      'assert client.diff_graph_files("before.json", "after.json", False)["diff"]["summary"]["recordsChanged"] == 1',
      'assert client.diff_text_files("before.ts", "after.ts", include_svg=False)["diffs"][0]["summary"]["added"] == 1',
      'assert client.reality(__import__("json").loads(os.environ["T2C_AFTER_GRAPH"]), include_svg=False)["view"]["schemaVersion"] == "t2c.reality/v1"',
      'result = client.run("extract_nl", {"text": "Dodać Python SDK.", "file": "python-sdk.md"})',
      'assert len(result["records"]) == 1',
      'print("python-sdk-ok")',
    ].join('\n')], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        T2C_TEST_URL: baseUrl,
        T2C_AFTER_GRAPH: JSON.stringify(after),
        PYTHONPATH: path.resolve(process.cwd()),
      },
      encoding: 'utf8',
    });
    assert.match(python.stdout, /python-sdk-ok/);
  } finally {
    await closeServer(server);
    clearA2aTaskStoreForTests();
  }
});
