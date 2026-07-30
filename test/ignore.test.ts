import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  compileIgnorePattern,
  createIgnoreMatcher,
  loadIgnoreMatcher,
  parseIgnoreFile,
} from '../src/core/ignore.js';

function matcher(...patterns: string[]) {
  return createIgnoreMatcher(parseIgnoreFile(patterns.join('\n')));
}

test('Blank lines and comments produce no rules', () => {
  assert.equal(compileIgnorePattern(''), null);
  assert.equal(compileIgnorePattern('   '), null);
  assert.equal(compileIgnorePattern('# comment'), null);
  assert.equal(parseIgnoreFile('# a\n\n  \nnode_modules/\n').length, 1);
});

test('A pattern without a slash matches at any depth', () => {
  const ignore = matcher('node_modules');
  assert.equal(ignore.ignores('node_modules', true), true);
  assert.equal(ignore.ignores('packages/app/node_modules', true), true);
  assert.equal(ignore.ignores('packages/node_modules/left-pad/index.js'), true);
  assert.equal(ignore.ignores('src/node_modules_helper.ts'), false);
});

test('A leading slash anchors the pattern to the root', () => {
  const ignore = matcher('/dist');
  assert.equal(ignore.ignores('dist', true), true);
  assert.equal(ignore.ignores('packages/app/dist', true), false);
});

test('A trailing slash restricts the rule to directories', () => {
  const ignore = matcher('build/');
  assert.equal(ignore.ignores('build', true), true);
  // A regular file named `build` is not the build directory.
  assert.equal(ignore.ignores('build', false), false);
});

test('Wildcards respect path separators', () => {
  const ignore = matcher('*.log');
  assert.equal(ignore.ignores('server.log'), true);
  assert.equal(ignore.ignores('logs/server.log'), true);
  assert.equal(ignore.ignores('server.log.txt'), false);

  const nested = matcher('docs/*.md');
  assert.equal(nested.ignores('docs/guide.md'), true);
  // `*` must not cross a separator.
  assert.equal(nested.ignores('docs/api/guide.md'), false);

  const deep = matcher('docs/**/*.md');
  assert.equal(deep.ignores('docs/api/guide.md'), true);
  assert.equal(deep.ignores('docs/guide.md'), true, '**/ spans zero directories');
});

test('Every dot-directory is excluded by `.*/`', () => {
  const ignore = matcher('.*/');
  for (const directory of ['.git', '.idea', '.venv', '.github', '.cache']) {
    assert.equal(ignore.ignores(directory, true), true, directory);
    assert.equal(ignore.ignores(`${directory}/config`), true, `${directory}/config`);
  }
  assert.equal(ignore.ignores('src', true), false);
  // A dot-file is not a dot-directory.
  assert.equal(ignore.ignores('.env', false), false);
});

test('Negation re-includes a previously excluded path', () => {
  const ignore = matcher('.env', '.env.*', '!.env.example');
  assert.equal(ignore.ignores('.env'), true);
  assert.equal(ignore.ignores('.env.local'), true);
  assert.equal(ignore.ignores('.env.example'), false);
});

test('Negation cannot resurrect a file inside an excluded directory', () => {
  // Matches git: once the parent is gone, the leaf cannot be re-included.
  const ignore = matcher('build/', '!build/keep.txt');
  assert.equal(ignore.ignores('build/keep.txt'), true);
});

test('Last matching rule wins', () => {
  assert.equal(matcher('*.md', '!README.md').ignores('README.md'), false);
  assert.equal(matcher('!README.md', '*.md').ignores('README.md'), true);
});

test('Character classes are supported', () => {
  const ignore = matcher('report-[0-9].txt');
  assert.equal(ignore.ignores('report-3.txt'), true);
  assert.equal(ignore.ignores('report-x.txt'), false);
});

test('Paths are normalised before matching', () => {
  const ignore = matcher('dist/');
  assert.equal(ignore.ignores('./dist/index.js'), true);
  assert.equal(ignore.ignores('dist/index.js'), true);
  assert.equal(ignore.ignores(''), false);
});

test('loadIgnoreMatcher merges the three ignore files and skips missing ones', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-ignore-'));
  await fs.writeFile(path.join(root, '.gitignore'), 'node_modules/\n*.log\n', 'utf8');
  await fs.writeFile(path.join(root, '.dockerignore'), 'coverage\n', 'utf8');
  await fs.writeFile(path.join(root, '.intentignore'), '.*/\n!keep.log\n', 'utf8');

  const ignore = await loadIgnoreMatcher(root);
  assert.deepEqual(ignore.sources, ['.gitignore', '.dockerignore', '.intentignore']);
  assert.equal(ignore.ignores('node_modules', true), true);
  assert.equal(ignore.ignores('coverage', true), true);
  assert.equal(ignore.ignores('.git', true), true);
  assert.equal(ignore.ignores('server.log'), true);
  // `.intentignore` is read last, so its negation overrides `.gitignore`.
  assert.equal(ignore.ignores('keep.log'), false);
  assert.equal(ignore.ignores('src/index.ts'), false);
});

test('A repository without ignore files excludes nothing', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-ignore-empty-'));
  const ignore = await loadIgnoreMatcher(root);
  assert.deepEqual(ignore.sources, []);
  assert.equal(ignore.ignores('anything/at/all.ts'), false);
});

test('The shipped .intentignore excludes build output but keeps sources', async () => {
  const ignore = await loadIgnoreMatcher(process.cwd(), { files: ['.intentignore'] });
  for (const excluded of ['.git', '.idea', '.intent', 'node_modules', 'dist', 'target', '__pycache__']) {
    assert.equal(ignore.ignores(excluded, true), true, excluded);
  }
  assert.equal(ignore.ignores('package-lock.json'), true);
  assert.equal(ignore.ignores('.github/workflows', true), false, 'workflow directory stays visible');
  assert.equal(ignore.ignores('.github/workflows/ci.yml'), false, 'workflow configuration stays visible');
  assert.equal(ignore.ignores('.github/actions', true), true, 'unrelated hidden GitHub state stays ignored');
  assert.equal(ignore.ignores('src/cli.ts'), false);
  assert.equal(ignore.ignores('README.md'), false);
  assert.equal(ignore.ignores('.env.example'), false, '.env.example stays visible');
});
