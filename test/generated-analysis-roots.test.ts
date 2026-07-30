import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const script = path.resolve('scripts/normalize-generated-analysis-roots.mjs');

test('generated analysis replaces its source root with a stable token', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-analysis-roots-'));
  const sourceRoot = path.join(root, 'snapshot', 'todo2code');
  await fs.mkdir(path.join(root, 'docs'));
  await fs.mkdir(path.join(root, 'project'));
  await fs.writeFile(path.join(root, 'docs', 'README.md'), `source: ${sourceRoot}\n`);
  await fs.writeFile(path.join(root, 'project', 'context.md'), `root=${sourceRoot}\nagain=${sourceRoot}\n`);
  await fs.writeFile(path.join(root, 'project', 'flow.mmd'), 'relative only\n');
  await fs.writeFile(path.join(root, 'project', 'flow.png'), Buffer.from([0, 1, 2]));

  const { stdout } = await execFileAsync(process.execPath, [script, root, sourceRoot]);
  assert.deepEqual(JSON.parse(stdout), { filesChecked: 3, filesChanged: 2 });
  assert.equal(await fs.readFile(path.join(root, 'docs', 'README.md'), 'utf8'), 'source: <PROJECT_ROOT>\n');
  assert.equal(
    await fs.readFile(path.join(root, 'project', 'context.md'), 'utf8'),
    'root=<PROJECT_ROOT>\nagain=<PROJECT_ROOT>\n',
  );
});

test('generated analysis root normalization refuses the filesystem root', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [script, process.cwd(), path.parse(process.cwd()).root]),
    /Refusing to normalize a filesystem root/,
  );
});
