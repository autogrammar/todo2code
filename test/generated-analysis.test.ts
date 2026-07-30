import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const script = path.resolve('scripts/verify-generated-analysis.mjs');

test('generated analysis rejects references to untracked input', async () => {
  const root = await fixtureRoot();
  await fs.writeFile(path.join(root, 'private-plan.yaml'), 'secret: local\n');
  await fs.writeFile(path.join(root, 'project', 'context.md'), 'input: private-plan.yaml\n');

  await assert.rejects(
    execFileAsync(process.execPath, [script, root]),
    /project\/context\.md references untracked input private-plan\.yaml/,
  );
});

test('generated analysis accepts outputs independent of untracked input', async () => {
  const root = await fixtureRoot();
  await fs.writeFile(path.join(root, 'private-plan.yaml'), 'secret: local\n');
  await fs.writeFile(path.join(root, 'project', 'context.md'), 'tracked sources only\n');

  const { stdout } = await execFileAsync(process.execPath, [script, root]);
  assert.deepEqual(JSON.parse(stdout), {
    filesChecked: 2,
    untrackedInputsChecked: 1,
    status: 'ok',
  });
});

test('generated analysis rejects temporary paths and unavailable validators', async () => {
  const root = await fixtureRoot();
  await fs.writeFile(path.join(root, 'project', 'context.md'), '/tmp/t2c-analysis.ABC123/todo2code/src/a.ts\n');
  await fs.writeFile(path.join(root, 'project', 'validation.toon.yaml'), [
    'rule: syntax.unsupported',
    "message: Language 'typescript' not available for download",
    '',
  ].join('\n'));

  await assert.rejects(
    execFileAsync(process.execPath, [script, root]),
    (error: Error & { stderr?: string }) => {
      const output = error.stderr ?? error.message;
      assert.match(output, /contains a temporary analysis path/);
      assert.match(output, /contains a validator parser-download failure/);
      return true;
    },
  );
});

async function fixtureRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-generated-analysis-'));
  await fs.mkdir(path.join(root, 'docs'));
  await fs.mkdir(path.join(root, 'project'));
  await fs.writeFile(path.join(root, 'docs', 'README.md'), '# generated\n');
  await fs.writeFile(path.join(root, 'project', 'context.md'), 'generated\n');
  await execFileAsync('git', ['init', '--quiet'], { cwd: root });
  await execFileAsync('git', ['add', 'docs/README.md', 'project/context.md'], { cwd: root });
  await execFileAsync('git', [
    '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
    'commit', '--quiet', '-m', 'fixture',
  ], { cwd: root });
  return root;
}
