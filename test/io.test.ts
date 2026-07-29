import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveGlobs } from '../src/core/io.js';

test('resolveGlobs permits one explicit .intent report without recursively scanning generated runs', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-explicit-intent-doc-'));
  const report = path.join(root, '.intent', 'runs', 'run-1', 'team-summary.md');
  await fs.mkdir(path.dirname(report), { recursive: true });
  await fs.writeFile(report, '# Team summary\n', 'utf8');

  assert.deepEqual(await resolveGlobs(root, ['.intent/runs/run-1/team-summary.md'], []), [report]);
  assert.deepEqual(await resolveGlobs(root, ['.intent/runs/run-1/team-summary.md'], ['.intent/**']), [report]);
  assert.deepEqual(await resolveGlobs(root, ['.intent/**/*.md'], []), []);
});
