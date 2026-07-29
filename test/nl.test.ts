import assert from 'node:assert/strict';
import test from 'node:test';
import { extractNlIntent } from '../src/extractors/nl.js';
import { makeConfig } from './helpers.js';

test('NL extractor produces deterministic non-LLM records', async () => {
  const config = makeConfig(process.cwd());
  const text = 'System musi dodać walidację kontraktu przed `executeContract` i zwrócić błąd dla T2C-14.';
  const first = await extractNlIntent({ root: process.cwd(), sourcePath: 'TASK.md', text }, config);
  const second = await extractNlIntent({ root: process.cwd(), sourcePath: 'TASK.md', text }, config);
  assert.equal(first.records.length, 1);
  assert.equal(first.records[0]?.id, second.records[0]?.id);
  assert.equal(first.records[0]?.statement.action, 'add');
  assert.equal(first.records[0]?.source.kind, 'nl');
  assert.equal(first.records[0]?.metadata.llmUsed, false);
  assert.ok(first.records[0]?.statement.target.symbols.includes('executeContract'));
  assert.ok(first.records[0]?.statement.target.tickets.includes('T2C-14'));
});
