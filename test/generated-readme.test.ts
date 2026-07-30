import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const script = path.resolve('scripts/sync-generated-readme-metadata.mjs');

test('generated README metadata is synchronized from package.json and stays idempotent', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-generated-readme-'));
  const docs = path.join(root, 'docs');
  const readme = path.join(docs, 'README.md');
  await fs.mkdir(docs, { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
    version: '2.4.6',
    license: 'Apache-2.0',
    engines: { node: '>=20' },
  }));
  await fs.writeFile(path.join(root, 'LICENSE'), 'Apache License\n');
  await fs.writeFile(readme, [
    '# fixture',
    '![version](https://img.shields.io/badge/version-0.1.0-blue) ![typescript](https://img.shields.io/badge/typescript-any-3178C6)',
    '**License:** MIT[(LICENSE)](./LICENSE)  ',
    '',
  ].join('\n'));

  const first = await execFileAsync(process.execPath, [script, root, readme]);
  const firstAudit = JSON.parse(first.stdout);
  assert.equal(firstAudit.changed, true);
  assert.equal(firstAudit.version, '2.4.6');
  assert.equal(firstAudit.license, 'Apache-2.0');
  assert.equal(await fs.readFile(readme, 'utf8'), [
    '# fixture',
    '![version](https://img.shields.io/badge/version-2.4.6-blue) ![node](https://img.shields.io/badge/node-%3E%3D20-339933)',
    '**License:** [Apache-2.0](../LICENSE)',
    '',
  ].join('\n'));

  const second = await execFileAsync(process.execPath, [script, root, readme]);
  assert.equal(JSON.parse(second.stdout).changed, false);
});

test('generated README synchronization fails closed when the template drifts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-generated-readme-invalid-'));
  const docs = path.join(root, 'docs');
  const readme = path.join(docs, 'README.md');
  await fs.mkdir(docs, { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
    version: '1.0.0', license: 'Apache-2.0', engines: { node: '>=20' },
  }));
  await fs.writeFile(readme, '# generator changed its template\n');

  await assert.rejects(
    execFileAsync(process.execPath, [script, root, readme]),
    /Generated README is missing its version badge/,
  );
  assert.equal(await fs.readFile(readme, 'utf8'), '# generator changed its template\n');
});

test('generated README synchronization rejects output outside the project root', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-generated-readme-root-'));
  const outside = path.join(os.tmpdir(), `t2c-generated-readme-outside-${process.pid}.md`);
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
    version: '1.0.0', license: 'Apache-2.0', engines: { node: '>=20' },
  }));
  await fs.writeFile(outside, '# keep me\n');

  await assert.rejects(
    execFileAsync(process.execPath, [script, root, outside]),
    /Generated README must be a file inside the project root/,
  );
  assert.equal(await fs.readFile(outside, 'utf8'), '# keep me\n');
});
