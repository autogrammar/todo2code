import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const verifier = path.resolve('scripts/verify-workflow-yaml.mjs');

test('workflow verifier rejects duplicate top-level YAML keys', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-workflow-yaml-'));
  const valid = path.join(root, 'valid.yml');
  const duplicate = path.join(root, 'duplicate.yml');
  await fs.writeFile(valid, 'name: ci\non:\n  push:\njobs:\n  test:\n    runs-on: ubuntu-latest\n');
  await fs.writeFile(duplicate, 'name: ci\non:\n  push:\non:\n  schedule:\n');

  await assert.doesNotReject(() => exec(process.execPath, [verifier, valid]));
  await assert.rejects(
    () => exec(process.execPath, [verifier, duplicate]),
    (error: unknown) => error instanceof Error && /duplicate top-level key "on"/.test(error.message),
  );
});
