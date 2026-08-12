import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractCommunicationIntent } from '../src/extractors/communication.js';
import { makeConfig } from './helpers.js';

test('generated task and TODO projections are evidence unless communication explicitly opts in', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-remediation-projections-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const ticket = path.join(root, 'project', 'ticket-075');
  await fs.mkdir(ticket, { recursive: true });

  const ignored = [
    'TASK.md',
    'REMEDIATION.task.md',
    'todo2code-task.md',
    'TODO.md',
    'REMEDIATION.todo.md',
    'todo2code-TODO.md',
  ];
  await Promise.all(ignored.map((filename) => fs.writeFile(
    path.join(ticket, filename),
    '# Generated projection\n\n- [ ] Implement bounded work in `src/runtime.ts`.\n',
  )));
  await fs.writeFile(path.join(ticket, 'explicit.task.md'), [
    '---',
    'participant: remediation-producer',
    'role: agent',
    'type: plan',
    'ticket: ticket-075',
    'timestamp: 2026-08-12T16:00:00Z',
    'paths: ["src/a,b.ts", "src/runtime.ts"]',
    '---',
    'Implement explicitly attributed work in `src/runtime.ts`.',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(ticket, 'ai-codex.md'), [
    '# Participant: codex (AI agent)',
    '',
    '## Execution plan',
    '',
    '- Preserve typed participant extraction in `src/extractors/communication.ts`.',
    '',
  ].join('\n'));

  const extracted = await extractCommunicationIntent({ root }, makeConfig(root));
  const sourcePaths = [...new Set(extracted.records.map((record) => record.source.path))].sort();

  assert.deepEqual(sourcePaths, [
    'project/ticket-075/ai-codex.md',
    'project/ticket-075/explicit.task.md',
  ]);
  assert.ok(extracted.records.some((record) => record.metadata.participant === 'remediation-producer'
    && record.metadata.participantRole === 'agent'
    && record.metadata.messageType === 'plan'));
  assert.ok(extracted.records.some((record) => record.metadata.participant === 'codex'
    && record.metadata.participantRole === 'agent'));
  const explicit = extracted.records.find((record) => record.metadata.participant === 'remediation-producer');
  assert.deepEqual(explicit?.statement.target.paths, ['src/a,b.ts', 'src/runtime.ts']);
  assert.equal(explicit?.observedAt, '2026-08-12T16:00:00.000Z');
  for (const warning of extracted.warnings) {
    assert.equal(typeof warning, 'string');
    assert.ok(!ignored.some((filename) => warning.includes(filename)));
  }
});

test('malformed front matter is rejected and non-ISO timestamps are reported', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-remediation-envelope-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const ticket = path.join(root, 'project', 'ticket-075');
  await fs.mkdir(ticket, { recursive: true });
  await fs.writeFile(path.join(ticket, 'broken.plan.md'), [
    '---',
    'participant: broken',
    'role: agent',
    'This line must not be ingested without a closing envelope.',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(ticket, 'invalid-time.plan.md'), [
    '---',
    'participant: clock-agent',
    'role: agent',
    'type: plan',
    'timestamp: March 1, 2024',
    '---',
    'Implement the clock contract in `src/clock.ts`.',
    '',
  ].join('\n'));

  const extracted = await extractCommunicationIntent({ root }, makeConfig(root));

  assert.deepEqual([...new Set(extracted.records.map((record) => record.source.path))], [
    'project/ticket-075/invalid-time.plan.md',
  ]);
  assert.equal(extracted.records[0]?.observedAt, null);
  assert.ok(extracted.warnings.includes(
    'ticket-075/broken.plan.md: malformed communication front matter; closing --- is missing',
  ));
  assert.ok(extracted.warnings.includes('ticket-075/invalid-time.plan.md: invalid timestamp'));
});
