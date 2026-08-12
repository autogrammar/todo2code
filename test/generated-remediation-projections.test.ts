import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractCommunicationIntent } from '../src/extractors/communication.js';
import { makeConfig } from './helpers.js';

test('generated task and TODO projections are evidence unless communication explicitly opts in', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-remediation-projections-'));
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
  assert.ok(ignored.every((filename) => extracted.warnings.every((warning) => !warning.includes(filename))));
});
