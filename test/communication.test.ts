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
