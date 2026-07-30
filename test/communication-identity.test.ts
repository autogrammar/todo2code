import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyzeCommunication } from '../src/communication/analyzer.js';
import { assertParticipantIdentityRegistry } from '../src/communication/identity.js';
import { buildRecord } from '../src/core/record.js';
import { extractCommunicationIntent } from '../src/extractors/communication.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { makeConfig } from './helpers.js';

test('participant registry maps stable IDs to Git/A2A identifiers without display-name guessing', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-participant-registry-'));
  const project = path.join(root, 'project');
  const ticket = path.join(project, 'ID-7');
  await fs.mkdir(ticket, { recursive: true });
  await fs.writeFile(path.join(project, 'participants.json'), JSON.stringify({
    schemaVersion: 't2c.participant-registry/v1',
    participants: [
      {
        id: 'human:alice', role: 'human', displayName: 'Alice A.',
        gitAuthors: ['Alice Git'], a2aAgentIds: [], humanAliases: ['alice@example.test'],
      },
      {
        id: 'agent:codex', role: 'agent', displayName: 'Codex',
        gitAuthors: ['Agent Codex'], a2aAgentIds: ['agent://codex/primary'], humanAliases: [],
      },
    ],
  }, null, 2));
  await fs.writeFile(path.join(ticket, 'alice.request.md'), [
    '---', 'participant-id: human:alice', 'participant: Alice A.', 'role: human', 'type: request',
    'git-authors: Incorrect Author', '---', 'Add checkout validation for ID-7.', '',
  ].join('\n'));
  await fs.writeFile(path.join(ticket, 'codex.plan.md'), [
    '---', 'participant-id: agent:codex', 'participant: Codex', 'role: agent', 'type: plan',
    'a2a-agent-id: agent://codex/primary', '---', 'Plan checkout validation for ID-7.', '',
  ].join('\n'));
  await fs.writeFile(path.join(ticket, 'same-display-name.md'), [
    '---', 'participant: Alice A.', 'role: human', 'type: message', '---',
    'Review checkout validation for ID-7.', '',
  ].join('\n'));

  const extracted = await extractCommunicationIntent({ root }, makeConfig(root));
  const alice = extracted.records.find((record) => record.metadata.participantId === 'human:alice');
  const codex = extracted.records.find((record) => record.metadata.participantId === 'agent:codex');
  const unresolved = extracted.records.find((record) => record.metadata.identitySource === 'unresolved');
  assert.equal(alice?.statement.actor, 'human:alice');
  assert.equal(alice?.metadata.displayName, 'Alice A.');
  assert.deepEqual(alice?.metadata.gitAuthors, ['Alice Git']);
  assert.deepEqual(codex?.metadata.a2aAgentIds, ['agent://codex/primary']);
  assert.equal(unresolved?.metadata.participantId, null);
  assert.equal(unresolved?.metadata.identityResolved, false);
  assert.ok(extracted.warnings.some((warning) => warning.includes('participant-id is required')));
  assert.ok(extracted.warnings.some((warning) => warning.includes('git-authors differ')));

  const git = buildRecord({
    kind: 'git_commit', actor: 'Alice Git', action: 'add', object: 'checkout validation',
    text: 'Add checkout validation for ID-7.', target: { tickets: ['ID-7'] },
    lifecycle: 'implemented', sourceKind: 'git', sourcePath: null, revision: 'a'.repeat(40),
    extractor: 'test/identity-registry', epistemicClass: 'fact', confidence: 1, basis: ['fixture'],
  });
  const analysis = analyzeCommunication(linkIntentRecords([...extracted.records, git]));
  assert.equal(analysis.participants.find((item) => item.participant === 'human:alice')?.matchedGitCommits, 1);
  assert.ok(analysis.issues.some((issue) => issue.code === 'PARTICIPANT_IDENTITY_UNRESOLVED'
    && issue.participantIds.includes('Alice A.')));
});

test('participant registry rejects ambiguous external identifiers', () => {
  assert.throws(() => assertParticipantIdentityRegistry({
    schemaVersion: 't2c.participant-registry/v1',
    participants: [
      { id: 'human:alice', role: 'human', displayName: 'Alice', gitAuthors: ['Shared'], a2aAgentIds: [], humanAliases: [] },
      { id: 'agent:bot', role: 'agent', displayName: 'Bot', gitAuthors: ['shared'], a2aAgentIds: [], humanAliases: [] },
    ],
  }), /assigned to both/);
});
