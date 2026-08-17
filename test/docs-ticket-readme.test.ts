import assert from 'node:assert/strict';
import test from 'node:test';
import { extractNlIntent } from '../src/extractors/nl.js';
import { makeConfig } from './helpers.js';

test('governed ticket README keeps wrapped goals and drops lifecycle metadata', async () => {
  const config = makeConfig(process.cwd());
  const text = [
    '# Ticket 079: Organization identity and management',
    '',
    '- **ID**: ticket-079',
    '- **Owner**: unresolved:human',
    '- **Status**: DONE',
    '- **Workflow state**: DONE',
    '- **Created**: 2026-03-20',
    '',
    '## Goal and scope',
    '',
    'Add clickable organization management in the account panel so operators can',
    'list, switch, and create organizations without leaving the portal.',
    '',
    '## Acceptance criteria',
    '',
    '- [ ] AC-01: Organizacje rail opens the organization tab and shows the',
    '      membership list from the session.',
    '- [ ] AC-02: Creating an organization rotates the session cookie.',
    '',
    '## Participants',
    '',
    '- Human participant: unresolved.',
    '',
  ].join('\n');

  const result = await extractNlIntent({
    root: process.cwd(),
    sourcePath: 'project/ticket-079/README.md',
    text,
  }, config);

  assert.equal(result.records.length, 3);
  assert.ok(!result.records.some((record) => /\bStatus\b|\bOwner\b|\bWorkflow state\b/i.test(record.statement.text)));
  assert.equal(result.records[0]?.statement.action, 'add');
  assert.match(result.records[0]?.statement.text ?? '', /list, switch, and create organizations/);
  assert.deepEqual(result.records[0]?.source.lines, { start: 11, end: 12 });
  assert.equal(result.records[1]?.statement.action, 'validate');
  assert.match(result.records[1]?.statement.text ?? '', /^AC-01:/);
  assert.match(result.records[1]?.statement.text ?? '', /membership list from the session/);
  assert.deepEqual(result.records[1]?.source.lines, { start: 16, end: 17 });
  assert.equal(result.records[2]?.statement.action, 'validate');
  assert.deepEqual(
    (result.records[1]?.metadata.missingFields as string[] | undefined) ?? [],
    [],
  );
  assert.equal(result.records[0]?.source.extractor, 't2c/nl-ticket-readme@1');
});

test('generic TASK.md line segmentation stays unchanged for headings', async () => {
  const config = makeConfig(process.cwd());
  const result = await extractNlIntent({
    root: process.cwd(),
    sourcePath: 'docs/TASK.md',
    text: '# Status\n\n- Owner must approve the patch before merge.\n',
  }, config);
  assert.equal(result.records.length, 1);
  assert.match(result.records[0]?.statement.text ?? '', /Owner must approve/);
  assert.equal(result.records[0]?.source.extractor, 't2c/nl-heuristic@1');
});
