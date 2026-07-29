import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractMarkdownIntent } from '../src/extractors/markdown.js';
import { makeConfig } from './helpers.js';

test('Markdown extractor separates TODO plans and changelog claims', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-md-'));
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n\n- [ ] Dodać `validateContract` dla T2C-1.\n- [x] Naprawić raport.\n');
  await fs.writeFile(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## [1.2.0] - 2026-07-29\n\n### Added\n\n- Dodano `validateContract` dla T2C-1.\n');
  const result = await extractMarkdownIntent({ root, todoPath: 'TODO.md', changelogPath: 'CHANGELOG.md' }, makeConfig(root));
  const todo = result.records.filter((record) => record.source.kind === 'todo');
  const changelog = result.records.filter((record) => record.source.kind === 'changelog');
  assert.equal(todo.length, 2);
  assert.equal(todo[0]?.lifecycle.status, 'planned');
  assert.equal(todo[1]?.lifecycle.status, 'completed');
  assert.equal(changelog.length, 1);
  assert.equal(changelog[0]?.lifecycle.status, 'released');
  assert.equal(changelog[0]?.metadata.version, '1.2.0');
});
