import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const EVENT_LOG_GENESIS_DIGEST = `sha256:${'0'.repeat(64)}`;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_EVENTS = 10_000;

export const EVENT_LOG_TYPES = [
  'ticket.created', 'ticket.transitioned', 'git.commit.created', 'git.push.received',
  'pull_request.opened', 'pull_request.synchronized', 'pull_request.reviewed',
  'pull_request.merged', 'pull_request.closed', 'check.completed', 'test.completed',
  'analysis.completed', 'diagnostic.raised', 'diagnostic.resolved', 'evaluation.generated',
  'approval.attested', 'branch.deleted', 'governance.completed',
] as const;
export type EventLogType = typeof EVENT_LOG_TYPES[number];

export const EVENT_LOG_TRUST_CLASSES = [
  'SYSTEM_FACT', 'HUMAN_DECISION', 'TRUSTED_ATTESTATION', 'ADVISORY_INFERENCE',
] as const;
export type EventLogTrustClass = typeof EVENT_LOG_TRUST_CLASSES[number];

export const EVENT_LOG_OUTCOMES = [
  'CREATED', 'UPDATED', 'PASSED', 'FAILED', 'DEGRADED', 'SKIPPED', 'APPROVED',
  'CHANGES_REQUESTED', 'MERGED', 'CLOSED', 'DELETED', 'BLOCKED', 'ALLOWED',
] as const;
export type EventLogOutcome = typeof EVENT_LOG_OUTCOMES[number];

export interface EventLogEventInput {
  eventId: string;
  type: EventLogType;
  trustClass: EventLogTrustClass;
  occurredAt: string;
  recordedAt: string;
  actorId: string;
  subjectId: string;
  source: string;
  outcome: EventLogOutcome;
  repository: string;
  ticketId: string | null;
  correlationId: string;
  baseSha: string | null;
  headSha: string | null;
  evidenceKind: string;
  evidenceRef: string;
  evidence: string | Uint8Array;
}

export interface EventLogEvent extends Omit<EventLogEventInput, 'evidence'> {
  sequence: number;
  evidenceDigest: string;
  previousDigest: string;
  eventDigest: string;
}

export interface EventLogDocument {
  schema: 't2c.event-log/v1';
  streamId: string;
  generatedAt: string;
  genesisDigest: string;
  streamDigest: string;
  events: EventLogEvent[];
}

const EVENT_FIELDS = [
  'SEQUENCE', 'EVENT_ID', 'TYPE', 'TRUST_CLASS', 'OCCURRED_AT', 'RECORDED_AT',
  'ACTOR_ID', 'SUBJECT_ID', 'SOURCE', 'OUTCOME', 'REPOSITORY', 'TICKET_ID',
  'CORRELATION_ID', 'BASE_SHA', 'HEAD_SHA', 'EVIDENCE_KIND', 'EVIDENCE_REF',
  'EVIDENCE_DIGEST', 'PREVIOUS_DIGEST', 'EVENT_DIGEST',
] as const;

export function createEventLog(input: {
  streamId: string;
  generatedAt: string;
  events: EventLogEventInput[];
}): EventLogDocument {
  validateText(input.streamId, 'STREAM_ID');
  validateTimestamp(input.generatedAt, 'GENERATED_AT');
  if (!Array.isArray(input.events) || input.events.length > MAX_EVENTS) {
    fail('LOG-VALUE-002', `EVENT_COUNT must be between 0 and ${MAX_EVENTS}`);
  }
  const sorted = [...input.events].sort(compareInputs);
  let previousDigest = EVENT_LOG_GENESIS_DIGEST;
  const events = sorted.map((item, index): EventLogEvent => {
    const event: EventLogEvent = {
      ...withoutEvidence(item),
      sequence: index + 1,
      evidenceDigest: hash(item.evidence),
      previousDigest,
      eventDigest: '',
    };
    event.eventDigest = hash(canonicalEventPayload(event));
    previousDigest = event.eventDigest;
    return event;
  });
  const document: EventLogDocument = {
    schema: 't2c.event-log/v1',
    streamId: input.streamId,
    generatedAt: input.generatedAt,
    genesisDigest: EVENT_LOG_GENESIS_DIGEST,
    streamDigest: events.at(-1)?.eventDigest ?? EVENT_LOG_GENESIS_DIGEST,
    events,
  };
  assertEventLog(document);
  return document;
}

export function renderEventLog(document: EventLogDocument): string {
  assertEventLog(document);
  const lines = [
    'DOCUMENT "T2C_EVENT_LOG"',
    'VERSION 1',
    'SCHEMA "t2c.event-log/v1"',
    `STREAM_ID ${json(document.streamId)}`,
    `GENERATED_AT ${json(document.generatedAt)}`,
    `EVENT_COUNT ${document.events.length}`,
    `GENESIS_DIGEST ${json(document.genesisDigest)}`,
    `STREAM_DIGEST ${json(document.streamDigest)}`,
  ];
  for (const event of document.events) {
    lines.push('EVENT', ...eventLines(event), 'END_EVENT');
  }
  return `${lines.join('\n')}\n`;
}

export function parseEventLog(value: string): EventLogDocument {
  if (typeof value !== 'string' || value.startsWith('\uFEFF') || value.includes('\r')
    || !value.endsWith('\n') || value.includes('\n\n')) {
    fail('LOG-STRUCTURE-001', 'Event log must be BOM-free UTF-8 text with canonical LF lines');
  }
  const lines = value.slice(0, -1).split('\n');
  let cursor = 0;
  const exact = (expected: string): void => {
    if (lines[cursor++] !== expected) fail('LOG-STRUCTURE-001', `Expected ${expected}`);
  };
  const field = (name: string): string => {
    const line = lines[cursor++] ?? '';
    if (!line.startsWith(`${name} `)) fail('LOG-STRUCTURE-001', `Expected field ${name}`);
    return line.slice(name.length + 1);
  };
  exact('DOCUMENT "T2C_EVENT_LOG"');
  exact('VERSION 1');
  exact('SCHEMA "t2c.event-log/v1"');
  const streamId = stringValue(field('STREAM_ID'), 'STREAM_ID');
  const generatedAt = stringValue(field('GENERATED_AT'), 'GENERATED_AT');
  const count = integerValue(field('EVENT_COUNT'), 'EVENT_COUNT');
  const genesisDigest = stringValue(field('GENESIS_DIGEST'), 'GENESIS_DIGEST');
  const streamDigest = stringValue(field('STREAM_DIGEST'), 'STREAM_DIGEST');
  if (count > MAX_EVENTS) fail('LOG-VALUE-002', `EVENT_COUNT exceeds ${MAX_EVENTS}`);
  const events: EventLogEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    exact('EVENT');
    const values = new Map<string, string>();
    for (const name of EVENT_FIELDS) values.set(name, field(name));
    exact('END_EVENT');
    events.push({
      sequence: integerValue(required(values, 'SEQUENCE'), 'SEQUENCE'),
      eventId: stringValue(required(values, 'EVENT_ID'), 'EVENT_ID'),
      type: stringValue(required(values, 'TYPE'), 'TYPE') as EventLogType,
      trustClass: stringValue(required(values, 'TRUST_CLASS'), 'TRUST_CLASS') as EventLogTrustClass,
      occurredAt: stringValue(required(values, 'OCCURRED_AT'), 'OCCURRED_AT'),
      recordedAt: stringValue(required(values, 'RECORDED_AT'), 'RECORDED_AT'),
      actorId: stringValue(required(values, 'ACTOR_ID'), 'ACTOR_ID'),
      subjectId: stringValue(required(values, 'SUBJECT_ID'), 'SUBJECT_ID'),
      source: stringValue(required(values, 'SOURCE'), 'SOURCE'),
      outcome: stringValue(required(values, 'OUTCOME'), 'OUTCOME') as EventLogOutcome,
      repository: stringValue(required(values, 'REPOSITORY'), 'REPOSITORY'),
      ticketId: nullableStringValue(required(values, 'TICKET_ID'), 'TICKET_ID'),
      correlationId: stringValue(required(values, 'CORRELATION_ID'), 'CORRELATION_ID'),
      baseSha: nullableStringValue(required(values, 'BASE_SHA'), 'BASE_SHA'),
      headSha: nullableStringValue(required(values, 'HEAD_SHA'), 'HEAD_SHA'),
      evidenceKind: stringValue(required(values, 'EVIDENCE_KIND'), 'EVIDENCE_KIND'),
      evidenceRef: stringValue(required(values, 'EVIDENCE_REF'), 'EVIDENCE_REF'),
      evidenceDigest: stringValue(required(values, 'EVIDENCE_DIGEST'), 'EVIDENCE_DIGEST'),
      previousDigest: stringValue(required(values, 'PREVIOUS_DIGEST'), 'PREVIOUS_DIGEST'),
      eventDigest: stringValue(required(values, 'EVENT_DIGEST'), 'EVENT_DIGEST'),
    });
  }
  if (cursor !== lines.length) fail('LOG-STRUCTURE-001', 'Trailing event-log content is forbidden');
  const document: EventLogDocument = {
    schema: 't2c.event-log/v1', streamId, generatedAt, genesisDigest, streamDigest, events,
  };
  assertEventLog(document);
  if (renderEventLog(document) !== value) {
    fail('LOG-STRUCTURE-001', 'Event log is valid JSON but not canonically encoded');
  }
  return document;
}

export function assertEventLog(document: EventLogDocument): void {
  if (!document || document.schema !== 't2c.event-log/v1' || !Array.isArray(document.events)) {
    fail('LOG-STRUCTURE-001', 'Document schema or events are invalid');
  }
  validateText(document.streamId, 'STREAM_ID');
  validateTimestamp(document.generatedAt, 'GENERATED_AT');
  if (document.genesisDigest !== EVENT_LOG_GENESIS_DIGEST) {
    fail('LOG-DIGEST-004', 'GENESIS_DIGEST is invalid');
  }
  if (document.events.length > MAX_EVENTS) fail('LOG-VALUE-002', `EVENT_COUNT exceeds ${MAX_EVENTS}`);
  const eventIds = new Set<string>();
  let previousDigest = document.genesisDigest;
  for (let index = 0; index < document.events.length; index += 1) {
    const event = document.events[index];
    if (!event) fail('LOG-STRUCTURE-001', `Missing event ${index + 1}`);
    validateEvent(event);
    if (event.sequence !== index + 1) fail('LOG-SEQUENCE-003', `Event ${event.eventId} has a non-contiguous sequence`);
    if (eventIds.has(event.eventId)) fail('LOG-SEQUENCE-003', `Duplicate EVENT_ID ${event.eventId}`);
    eventIds.add(event.eventId);
    if (event.previousDigest !== previousDigest) fail('LOG-DIGEST-004', `Event ${event.eventId} breaks the digest chain`);
    const calculated = hash(canonicalEventPayload(event));
    if (event.eventDigest !== calculated) fail('LOG-DIGEST-004', `Event ${event.eventId} digest is invalid`);
    previousDigest = event.eventDigest;
    if (index > 0 && compareEvents(document.events[index - 1]!, event) > 0) {
      fail('LOG-SEQUENCE-003', 'Events are not in canonical recording order');
    }
  }
  if (document.streamDigest !== previousDigest) fail('LOG-DIGEST-004', 'STREAM_DIGEST does not match the final event');
}

export async function writeEventLogAtomic(
  filePath: string,
  document: EventLogDocument,
  options: { replaceUnfinished?: boolean } = {},
): Promise<void> {
  const content = renderEventLog(document);
  parseEventLog(content);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (!options.replaceUnfinished) {
    try {
      await fs.access(filePath);
      fail('LOG-STRUCTURE-001', `Refusing to overwrite immutable event log ${path.basename(filePath)}`);
    } catch (error) {
      if (error instanceof EventLogError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporary, filePath);
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

export class EventLogError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'EventLogError';
  }
}

function validateEvent(event: EventLogEvent): void {
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) fail('LOG-SEQUENCE-003', 'SEQUENCE is invalid');
  for (const [name, value] of [
    ['EVENT_ID', event.eventId], ['ACTOR_ID', event.actorId], ['SUBJECT_ID', event.subjectId],
    ['SOURCE', event.source], ['REPOSITORY', event.repository], ['CORRELATION_ID', event.correlationId],
    ['EVIDENCE_KIND', event.evidenceKind],
  ] as const) validateText(value, name);
  validateOptionalText(event.ticketId, 'TICKET_ID');
  validateTimestamp(event.occurredAt, 'OCCURRED_AT');
  validateTimestamp(event.recordedAt, 'RECORDED_AT');
  if (!EVENT_LOG_TYPES.includes(event.type)) fail('LOG-VALUE-002', `TYPE ${event.type} is invalid`);
  if (!EVENT_LOG_TRUST_CLASSES.includes(event.trustClass)) fail('LOG-VALUE-002', `TRUST_CLASS ${event.trustClass} is invalid`);
  if (!EVENT_LOG_OUTCOMES.includes(event.outcome)) fail('LOG-VALUE-002', `OUTCOME ${event.outcome} is invalid`);
  if (event.type === 'approval.attested' && event.trustClass === 'ADVISORY_INFERENCE') {
    fail('LOG-VALUE-002', 'Advisory inference cannot attest approval');
  }
  if (!REPOSITORY.test(event.repository) || event.repository.includes('..')) {
    fail('LOG-VALUE-002', 'REPOSITORY must be owner/name or local/derived-id');
  }
  validateSha(event.baseSha, 'BASE_SHA');
  validateSha(event.headSha, 'HEAD_SHA');
  validateEvidenceRef(event.evidenceRef);
  for (const [name, digest] of [
    ['EVIDENCE_DIGEST', event.evidenceDigest], ['PREVIOUS_DIGEST', event.previousDigest],
    ['EVENT_DIGEST', event.eventDigest],
  ] as const) {
    if (!DIGEST.test(digest)) fail('LOG-DIGEST-004', `${name} is invalid`);
  }
}

function canonicalEventPayload(event: EventLogEvent): string {
  return `${eventLines(event).slice(0, -1).join('\n')}\n`;
}

function eventLines(event: EventLogEvent): string[] {
  return [
    `SEQUENCE ${event.sequence}`,
    `EVENT_ID ${json(event.eventId)}`,
    `TYPE ${json(event.type)}`,
    `TRUST_CLASS ${json(event.trustClass)}`,
    `OCCURRED_AT ${json(event.occurredAt)}`,
    `RECORDED_AT ${json(event.recordedAt)}`,
    `ACTOR_ID ${json(event.actorId)}`,
    `SUBJECT_ID ${json(event.subjectId)}`,
    `SOURCE ${json(event.source)}`,
    `OUTCOME ${json(event.outcome)}`,
    `REPOSITORY ${json(event.repository)}`,
    `TICKET_ID ${json(event.ticketId)}`,
    `CORRELATION_ID ${json(event.correlationId)}`,
    `BASE_SHA ${json(event.baseSha)}`,
    `HEAD_SHA ${json(event.headSha)}`,
    `EVIDENCE_KIND ${json(event.evidenceKind)}`,
    `EVIDENCE_REF ${json(event.evidenceRef)}`,
    `EVIDENCE_DIGEST ${json(event.evidenceDigest)}`,
    `PREVIOUS_DIGEST ${json(event.previousDigest)}`,
    `EVENT_DIGEST ${json(event.eventDigest)}`,
  ];
}

function withoutEvidence(input: EventLogEventInput): Omit<EventLogEventInput, 'evidence'> {
  const { evidence: _evidence, ...event } = input;
  return event;
}

function compareInputs(left: EventLogEventInput, right: EventLogEventInput): number {
  return left.recordedAt.localeCompare(right.recordedAt)
    || left.source.localeCompare(right.source)
    || left.eventId.localeCompare(right.eventId);
}

function compareEvents(left: EventLogEvent, right: EventLogEvent): number {
  return left.recordedAt.localeCompare(right.recordedAt)
    || left.source.localeCompare(right.source)
    || left.eventId.localeCompare(right.eventId);
}

function hash(value: string | Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function json(value: string | null): string {
  return JSON.stringify(value);
}

function validateText(value: string, name: string, limit = 256): void {
  if (typeof value !== 'string' || value.length === 0 || [...value].length > limit || /[\u0000-\u001f\u007f]/.test(value)) {
    fail('LOG-VALUE-002', `${name} is empty, contains control data or exceeds ${limit} characters`);
  }
  if (secretShaped(value)) fail('LOG-SECRET-005', `${name} contains secret-shaped data`);
}

function validateOptionalText(value: string | null, name: string): void {
  if (value !== null) validateText(value, name);
}

function validateTimestamp(value: string, name: string): void {
  if (!RFC3339.test(value) || !Number.isFinite(Date.parse(value))) fail('LOG-VALUE-002', `${name} is not RFC3339`);
}

function validateSha(value: string | null, name: string): void {
  if (value !== null && !SHA.test(value)) fail('LOG-VALUE-002', `${name} must be a full lowercase Git SHA or null`);
}

function validateEvidenceRef(value: string): void {
  validateText(value, 'EVIDENCE_REF', 2048);
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('file:')
    || value.includes('?') || /(^|[\\/])\.\.([\\/]|$)/.test(value)) {
    fail('LOG-SECRET-005', 'EVIDENCE_REF is an unsafe host path, traversal or query-bearing reference');
  }
}

function secretShaped(value: string): boolean {
  return /\bBearer\s+[A-Za-z0-9._~-]{8,}/i.test(value)
    || /\b(?:sk|ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{16,}\b/.test(value)
    || /\b(?:api[_-]?key|access[_-]?token|password)\s*[=:]\s*\S+/i.test(value);
}

function stringValue(raw: string, name: string): string {
  const parsed = jsonValue(raw, name);
  if (typeof parsed !== 'string') fail('LOG-VALUE-002', `${name} must be a JSON string`);
  return parsed;
}

function nullableStringValue(raw: string, name: string): string | null {
  const parsed = jsonValue(raw, name);
  if (parsed !== null && typeof parsed !== 'string') fail('LOG-VALUE-002', `${name} must be a JSON string or null`);
  return parsed;
}

function jsonValue(raw: string, name: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    fail('LOG-STRUCTURE-001', `${name} is not valid JSON`);
  }
}

function integerValue(raw: string, name: string): number {
  if (!/^(?:0|[1-9]\d*)$/.test(raw)) fail('LOG-VALUE-002', `${name} must be a non-negative integer`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) fail('LOG-VALUE-002', `${name} exceeds the safe integer range`);
  return parsed;
}

function required(values: Map<string, string>, name: string): string {
  const value = values.get(name);
  if (value === undefined) fail('LOG-STRUCTURE-001', `Missing ${name}`);
  return value;
}

function fail(code: string, message: string): never {
  throw new EventLogError(code, message);
}
