import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { analyzeCommunication, renderCommunicationMarkdown } from '../src/communication/analyzer.js';
import { extractCommunicationIntent } from '../src/extractors/communication.js';
import { extractGitIntent } from '../src/extractors/git.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { executeAction } from '../src/services/actions.js';
import { makeConfig } from './helpers.js';

const exec = promisify(execFile);

test('project/<ticket> communication is attributed per human and agent and checked against Git evidence', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-communication-'));
  const ticket = path.join(root, 'project', 'WM-101');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.mkdir(ticket, { recursive: true });
  await fs.writeFile(path.join(ticket, 'human.alice.request.001.md'), `---
participant: Alice
role: human
type: request
timestamp: 2026-07-29T08:00:00+02:00
paths: src/runtime.ts
---
Dodać walidację kontraktu w \`src/runtime.ts\` dla WM-101.
`);
  await fs.writeFile(path.join(ticket, 'human.bob.request.001.md'), `---
participant: Bob
role: human
type: request
---
Nie dodawać walidacji kontraktu w \`src/runtime.ts\` dla WM-101.
`);
  await fs.writeFile(path.join(ticket, 'agent.codex.plan.001.md'), `---
participant: Codex
role: agent
type: plan
---
Dodać walidację kontraktu w \`src/runtime.ts\` dla WM-101.
`);
  await fs.writeFile(path.join(ticket, 'agent.codex.report.002.md'), `---
participant: Codex
role: agent
type: report
git-authors: Agent Codex
---
Dodano walidację kontraktu w \`src/runtime.ts\` dla WM-101.
`);
  await fs.writeFile(path.join(ticket, 'agent.rogue.plan.001.md'), `---
participant: Rogue
role: agent
type: plan
---
Zmienić licencję projektu dla WM-101.
`);
  await fs.writeFile(path.join(root, 'src', 'runtime.ts'), 'export function validateContract(): boolean { return true; }\n');
  await exec('git', ['init', '-q'], { cwd: root });
  await exec('git', ['config', 'user.name', 'Agent Codex'], { cwd: root });
  await exec('git', ['config', 'user.email', 'codex@example.test'], { cwd: root });
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-q', '-m', 'feat: add contract validation WM-101'], { cwd: root });

  const config = makeConfig(root);
  const communication = await extractCommunicationIntent({ root }, config);
  const git = await extractGitIntent({ root, count: 10 }, config);
  assert.equal(communication.records.length, 5);
  assert.deepEqual([...new Set(communication.records.map((record) => record.metadata.participant))].sort(), ['Alice', 'Bob', 'Codex', 'Rogue']);
  assert.ok(communication.records.every((record) => record.source.kind === 'agent_log'));
  assert.ok(communication.records.every((record) => record.statement.target.tickets.includes('WM-101')));

  const graph = linkIntentRecords([...communication.records, ...git.records]);
  const analysis = analyzeCommunication(graph);
  assert.equal(analysis.participants.length, 4);
  assert.ok(analysis.issues.some((item) => item.code === 'HUMAN_COMMUNICATION_CONFLICT'));
  assert.ok(analysis.issues.some((item) => item.code === 'HUMAN_AGENT_CONFLICT'));
  assert.ok(analysis.issues.some((item) => item.code === 'AGENT_WORK_OUTSIDE_REQUEST' && item.participantIds.includes('Rogue')));
  assert.ok(!analysis.issues.some((item) => item.code === 'AGENT_CLAIM_WITHOUT_EVIDENCE' && item.participantIds.includes('Codex')));
  assert.ok(analysis.issues
    .filter((item) => item.code === 'HUMAN_COMMUNICATION_CONFLICT')
    .every((item) => item.responseRequiredRole === 'human'
      && item.responseRequiredFrom.includes('Alice')
      && item.responseRequiredFrom.includes('Bob')));
  assert.ok(analysis.issues
    .filter((item) => item.code === 'HUMAN_AGENT_CONFLICT')
    .every((item) => item.responseRequiredRole === 'human'
      && item.responseRequiredFrom.every((participant) => ['Alice', 'Bob'].includes(participant))));
  assert.ok(analysis.issues
    .filter((item) => item.code === 'AGENT_WORK_OUTSIDE_REQUEST' && item.participantIds.includes('Rogue'))
    .every((item) => item.responseRequiredRole === 'human'
      && item.responseRequiredFrom.includes('Alice')
      && item.responseRequiredFrom.includes('Bob')));
  const codex = analysis.participants.find((item) => item.participant === 'Codex');
  assert.equal(codex?.matchedGitCommits, 1);
  assert.equal(analysis.participants.find((item) => item.participant === 'Rogue')?.linkedEvidenceRecords, 0);
  assert.match(renderCommunicationMarkdown(analysis), /Analiza komunikacji ludzi i agentów/);

  const remote = await executeAction('analyze_communication', {
    root: '.', projectDir: 'project', ticket: 'WM-101', includeAst: false,
  }, config) as { analysis: { schemaVersion: string; participants: unknown[] }; markdown: string };
  assert.equal(remote.analysis.schemaVersion, 't2c.communication-analysis/v1');
  assert.equal(remote.analysis.participants.length, 4);
  assert.match(remote.markdown, /WM-101/);
});

test('governance user-* and ai-* files become typed participant intent without ingesting ticket evidence', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-governance-communication-'));
  const ticket = path.join(root, 'project', 'ticket-005');
  await fs.mkdir(ticket, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(ticket, 'README.md'), '# Ticket\n\nImplement unrelated README prose.\n'),
    fs.writeFile(path.join(ticket, 'preprompt.md'), '# Preprompt\n\nChange unrelated policy.\n'),
    fs.writeFile(path.join(ticket, 'changelog.md'), '# Changelog\n\n- Historical evidence only.\n'),
    fs.writeFile(path.join(ticket, 'audit.md'), '# Audit\n\n- Captured evidence only.\n'),
    fs.writeFile(path.join(ticket, 'iteration-01.md'), '# Result\n\n- Measured output only.\n'),
    fs.writeFile(path.join(ticket, 'ai-codex-logs.txt'), 'raw command output must not become a claim\n'),
    fs.writeFile(path.join(ticket, 'user-tom-sapletta-com.md'), [
      '# Participant: tom-sapletta-com',
      '',
      '- **Ticket**: ticket-005',
      '',
      '## Instructions',
      '',
      '##1',
      '',
      '- Add contract validation in `src/runtime.ts`.',
      '- Document public API usage.',
      '',
      '## Decisions',
      '',
      '- Ticket directories must not contain executable source.',
      '',
      '## Ownership boundary',
      '',
      'Agents must not modify this file.',
      '',
    ].join('\n')),
    fs.writeFile(path.join(ticket, 'ai-Codex.md'), [
      '# Participant: Codex (AI agent)',
      '',
      '- **Ticket**: ticket-005',
      '',
      '## Understanding',
      '',
      'Add contract validation in `src/runtime.ts`.',
      '',
      '## Execution plan',
      '',
      '1. Add contract validation in `src/runtime.ts`.',
      '',
      '## Actual changes',
      '',
      '---',
      '',
      '- Changed the project license.',
      '- Owner approved an expanded deployment scope.',
      '',
      '## Blockers',
      '',
      '- None.',
      '',
    ].join('\n')),
  ]);

  const extracted = await extractCommunicationIntent({ root }, makeConfig(root));
  assert.deepEqual([...new Set(extracted.records.map((record) => record.source.path))].sort(), [
    'project/ticket-005/ai-Codex.md',
    'project/ticket-005/user-tom-sapletta-com.md',
  ]);
  assert.deepEqual([...new Set(extracted.records.map((record) => [
    record.metadata.participant,
    record.metadata.participantRole,
  ]).map((value) => JSON.stringify(value)))].sort(), [
    JSON.stringify(['codex', 'agent']),
    JSON.stringify(['tom-sapletta-com', 'human']),
  ]);
  assert.ok(extracted.records.some((record) => record.metadata.participant === 'tom-sapletta-com'
    && record.metadata.messageType === 'request'));
  assert.ok(extracted.records.some((record) => record.metadata.participant === 'tom-sapletta-com'
    && record.metadata.messageType === 'decision'));
  assert.ok(extracted.records.some((record) => record.metadata.participant === 'codex'
    && record.metadata.messageType === 'plan'));
  assert.ok(extracted.records.some((record) => record.metadata.participant === 'codex'
    && record.metadata.messageType === 'report'));
  assert.ok(!extracted.records.some((record) => /Agents must not modify this file/.test(record.statement.text)));
  assert.ok(!extracted.records.some((record) => /^(?:##1|---)$/.test(record.statement.text)));

  const analysis = analyzeCommunication(linkIntentRecords(extracted.records));
  const missingDocumentation = analysis.issues.find((item) =>
    item.code === 'REQUEST_WITHOUT_AGENT_RESPONSE'
    && item.detail.includes('Document public API usage'));
  assert.equal(missingDocumentation?.responseRequiredRole, 'agent');
  assert.deepEqual(missingDocumentation?.responseRequiredFrom, ['codex']);
  const outsideLicense = analysis.issues.find((item) =>
    item.code === 'AGENT_WORK_OUTSIDE_REQUEST'
    && item.detail.includes('Changed the project license'));
  assert.equal(outsideLicense?.responseRequiredRole, 'human');
  assert.deepEqual(outsideLicense?.responseRequiredFrom, ['tom-sapletta-com']);
  const unconfirmedApproval = analysis.issues.find((item) =>
    item.code === 'AGENT_HUMAN_DECISION_CLAIM_UNCONFIRMED');
  assert.equal(unconfirmedApproval?.responseRequiredRole, 'human');
  assert.deepEqual(unconfirmedApproval?.responseRequiredFrom, ['tom-sapletta-com']);
  assert.match(renderCommunicationMarkdown(analysis), /Wymagana odpowiedź: agent — codex/);
});

test('unstructured governance participant content is rejected with an owner-specific migration warning', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-governance-migration-'));
  const ticket = path.join(root, 'project', 'ticket-006');
  await fs.mkdir(ticket, { recursive: true });
  await fs.writeFile(
    path.join(ticket, 'user-Owner.md'),
    '# Legacy prompt\n\nReview CONTRIBUTING.md and report missing workflow steps.\n',
  );

  const extracted = await extractCommunicationIntent({ root }, makeConfig(root));
  assert.deepEqual(extracted.records, []);
  assert.ok(extracted.warnings.some((warning) =>
    warning.includes('no recognized intent sections for human:owner')
    && warning.includes('explicit type front matter')));
});

test('opposite wording about different explicit files is not treated as an intent conflict', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-communication-targets-'));
  const ticket = path.join(root, 'project', 'WM-103');
  await fs.mkdir(ticket, { recursive: true });
  await fs.writeFile(path.join(ticket, 'human.owner.request.001.md'), [
    '---', 'participant: Owner', 'role: human', 'type: request', '---',
    'POLICY.md must use procedural DSL without natural language.', '',
  ].join('\n'));
  await fs.writeFile(path.join(ticket, 'agent.codex.message.001.md'), [
    '---', 'participant: Codex', 'role: agent', 'type: message', '---',
    'Before the DSL migration CONTRIBUTING.md was not clear enough for an AI agent.', '',
  ].join('\n'));

  const extracted = await extractCommunicationIntent({ root }, makeConfig(root));
  const analysis = analyzeCommunication(linkIntentRecords(extracted.records));
  assert.ok(!analysis.issues.some((item) => item.code === 'HUMAN_AGENT_CONFLICT'));
});

test('communication extractor reports unresolved identity instead of inventing an actor', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-communication-unknown-'));
  const ticket = path.join(root, 'project', 'WM-102');
  await fs.mkdir(ticket, { recursive: true });
  await fs.writeFile(path.join(ticket, 'note.md'), 'Sprawdzić kontrakt WM-102.\n');
  const config = makeConfig(root);
  const extracted = await extractCommunicationIntent({ root }, config);
  assert.equal(extracted.records.length, 1);
  assert.equal(extracted.records[0]?.metadata.participantRole, 'unknown');
  assert.ok(extracted.warnings.some((warning) => warning.includes('role must be human or agent')));
  const analysis = analyzeCommunication(linkIntentRecords(extracted.records));
  assert.ok(analysis.issues.some((item) => item.code === 'PARTICIPANT_IDENTITY_UNRESOLVED'));
});

test('communication extractor ignores generic generated analysis under project/', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-communication-analysis-'));
  const generated = path.join(root, 'project', 'batch_1');
  await fs.mkdir(generated, { recursive: true });
  await fs.writeFile(path.join(generated, 'context.md'), '# Generated context\nAnalyze module dependencies.\n');
  await fs.writeFile(path.join(generated, 'prompt.txt'), 'Generate a repository report.\n');
  await fs.writeFile(path.join(root, 'project', 'README.md'), '# Analysis output\n');

  const extracted = await extractCommunicationIntent({ root }, makeConfig(root));
  assert.deepEqual(extracted.records, []);
  assert.deepEqual(extracted.warnings, []);

  const explicit = path.join(root, 'project', 'custom-stream');
  await fs.mkdir(explicit, { recursive: true });
  await fs.writeFile(path.join(explicit, 'note.md'), [
    '---', 'participant: Alice', 'role: human', 'type: request', 'ticket: CUSTOM', '---',
    'Add explicit communication parsing.', '',
  ].join('\n'));
  const withContract = await extractCommunicationIntent({ root }, makeConfig(root));
  assert.equal(withContract.records.length, 1);
  assert.equal(withContract.records[0]?.metadata.participant, 'Alice');
});
