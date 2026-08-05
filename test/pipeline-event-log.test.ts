import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createEventLog,
  EventLogError,
  parseEventLog,
  renderEventLog,
  writeEventLogAtomic,
  type EventLogEventInput,
} from '../src/pipeline/event-log.js';

const timestamp = '2026-08-05T12:00:00Z';

function event(overrides: Partial<EventLogEventInput> = {}): EventLogEventInput {
  return {
    eventId: 'event-1',
    type: 'analysis.completed',
    trustClass: 'SYSTEM_FACT',
    occurredAt: timestamp,
    recordedAt: timestamp,
    actorId: 'todo2code:test',
    subjectId: 'run:test-run',
    source: 'todo2code:pipeline',
    outcome: 'PASSED',
    repository: 'example/project',
    ticketId: 'ticket-046',
    correlationId: 'test-run',
    baseSha: null,
    headSha: 'a'.repeat(40),
    evidenceKind: 'test_report',
    evidenceRef: 'artifact:test-report.json',
    evidence: '{"passed":true}\n',
    ...overrides,
  };
}

test('canonical ticket-045 fixture parses and renders byte-for-byte', async () => {
  const fixture = await fs.readFile('test/fixtures/event-log/v1/logs.dsl.txt', 'utf8');
  const parsed = parseEventLog(fixture);
  assert.equal(parsed.events.length, 17);
  assert.equal(parsed.events[10]?.trustClass, 'ADVISORY_INFERENCE');
  assert.equal(parsed.events[13]?.trustClass, 'TRUSTED_ATTESTATION');
  assert.equal(renderEventLog(parsed), fixture);
});

test('identical semantic inputs render identically and sort by canonical recording order', () => {
  const input = {
    streamId: 'deterministic-run',
    generatedAt: timestamp,
    events: [
      event({ eventId: 'z-event', evidence: 'z' }),
      event({ eventId: 'a-event', evidence: 'a' }),
    ],
  };
  const first = renderEventLog(createEventLog(input));
  const second = renderEventLog(createEventLog({ ...input, events: [...input.events].reverse() }));
  assert.equal(first, second);
  assert.match(first, /SEQUENCE 1\nEVENT_ID "a-event"/);
});

test('parser fails closed on tampered chains and non-canonical encoding', () => {
  const rendered = renderEventLog(createEventLog({
    streamId: 'tamper-run', generatedAt: timestamp, events: [event()],
  }));
  const tampered = rendered.replace(/EVENT_DIGEST "sha256:[a-f0-9]{64}"/, `EVENT_DIGEST "sha256:${'f'.repeat(64)}"`);
  assert.throws(() => parseEventLog(tampered), (error: unknown) =>
    error instanceof EventLogError && error.code === 'LOG-DIGEST-004');
  assert.throws(() => parseEventLog(rendered.replace('EVENT_COUNT 1', 'EVENT_COUNT 01')), (error: unknown) =>
    error instanceof EventLogError && error.code === 'LOG-VALUE-002');
});

test('unsafe evidence, secrets and advisory approval are rejected before rendering', () => {
  for (const invalid of [
    event({ evidenceRef: '/home/user/report.json' }),
    event({ evidenceRef: 'artifact:report.json?token=secret' }),
    event({ actorId: 'Bearer abcdefghijklmnop' }),
    event({ type: 'approval.attested', trustClass: 'ADVISORY_INFERENCE' }),
  ]) {
    assert.throws(() => createEventLog({
      streamId: 'unsafe-run', generatedAt: timestamp, events: [invalid],
    }), EventLogError);
  }
});

test('writer publishes one validated file atomically and refuses an immutable overwrite', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-event-log-'));
  try {
    const output = path.join(directory, 'logs.dsl.txt');
    const document = createEventLog({
      streamId: 'atomic-run', generatedAt: timestamp, events: [event()],
    });
    await writeEventLogAtomic(output, document);
    const written = await fs.readFile(output, 'utf8');
    assert.equal(renderEventLog(parseEventLog(written)), written);
    await assert.rejects(() => writeEventLogAtomic(output, document), (error: unknown) =>
      error instanceof EventLogError && /Refusing to overwrite/.test(error.message));
    assert.deepEqual((await fs.readdir(directory)).sort(), ['logs.dsl.txt']);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
