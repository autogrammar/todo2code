import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { executeAction } from '../src/services/actions.js';
import { makeConfig } from './helpers.js';

test('MCP/A2A action boundary rejects traversal and symlink escapes', async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-security-'));
  const root = path.join(parent, 'workspace');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'TASK.md'), 'Dodać testy.\n', 'utf8');
  await fs.writeFile(path.join(parent, 'secret.md'), 'sekret\n', 'utf8');
  const config = makeConfig(root);

  await assert.rejects(
    executeAction('extract_nl', { file: '../secret.md' }, config),
    /outside configured T2C_ROOT/,
  );

  const link = path.join(root, 'linked-secret.md');
  try {
    await fs.symlink(path.join(parent, 'secret.md'), link);
    await assert.rejects(
      executeAction('extract_nl', { file: 'linked-secret.md' }, config),
      /outside configured T2C_ROOT/,
    );
    const outsidePython = path.join(parent, 'secret.py');
    await fs.writeFile(outsidePython, 'def leaked_symbol():\n    pass\n', 'utf8');
    await fs.symlink(outsidePython, path.join(root, 'linked-secret.py'));
    const astResult = await executeAction('extract_ast', {}, config) as { records: Array<{ source: { path: string | null } }> };
    assert.ok(!astResult.records.some((record) => record.source.path === 'linked-secret.py'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
  }

  const result = await executeAction('extract_nl', { file: 'TASK.md' }, config) as { records: unknown[] };
  assert.equal(result.records.length, 1);
});
