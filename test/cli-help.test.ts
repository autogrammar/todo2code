import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);

test('CLI command help is successful and non-mutating', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cli-help-'));
  const cli = path.resolve('dist/src/cli.js');
  const environment = { ...process.env, OPENROUTER_API_KEY: '', T2C_ENV_FILE: 'missing.env' };

  for (const args of [['pipeline', '--help'], ['pipeline', '-h'], ['extract', '--help']]) {
    const result = await exec(process.execPath, [cli, ...args], { cwd: root, env: environment });
    assert.match(result.stdout, /todo2code \(t2c\)[\s\S]*Usage:/);
    assert.equal(result.stderr, '');
    assert.deepEqual(await fs.readdir(root), []);
  }
});
