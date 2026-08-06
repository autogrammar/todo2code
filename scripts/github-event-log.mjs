#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  createEventLog,
  writeEventLogAtomic,
} from '../dist/src/pipeline/event-log.js';
import { stableStringify } from '../dist/src/core/id.js';

const usage = `Usage: node scripts/github-event-log.mjs --event-name <name> --event-path <path> --output <path>\n\
\n\
Options:\n\
  --event-name <push|pull_request|pull_request_review|workflow_run>\n\
  --event-path <path>                      JSON payload from GitHub Actions\n\
  --output <path>                          output logs.dsl.txt path\n\
  --stream-id <id>                         optional stable stream id\n\
  --correlation-id <id>                    optional stable correlation id\n\
  --recorded-at <RFC3339>                  optional explicit recorded time\n\
  --repository <owner/name>                optional repository override\n\
  --ticket <ticket-id>                     optional bound ticket\n\
  --help\n\
\n\
Exit code 1 for unsupported event/action or unbound evidence.\n`;

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^[a-f0-9]{40}$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const TICKET = /^ticket-[A-Za-z0-9._-]+$/;
const EVENT_NAMES = new Set(['push', 'pull_request', 'pull_request_review', 'workflow_run']);

const parser = (argv) => {
  if (argv.length === 1 && argv[0] === '--help') return { help: true };
  if (argv.includes('--help')) throw new Error('--help cannot be combined with other options');
  if (argv.length % 2 === 1) {
    throw new Error(`missing value for ${argv.at(-1)}`);
  }
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option.startsWith('--')) throw new Error(`unknown option: ${option}`);
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${option}`);
    if (values.has(option)) throw new Error(`duplicate option: ${option}`);
    if (![
      '--event-name',
      '--event-path',
      '--output',
      '--stream-id',
      '--correlation-id',
      '--recorded-at',
      '--repository',
      '--ticket',
    ].includes(option)) {
      throw new Error(`unknown option: ${option}`);
    }
    values.set(option, value);
  }
  return {
    help: false,
    eventName: values.get('--event-name'),
    eventPath: values.get('--event-path') ?? '',
    output: values.get('--output'),
    streamId: values.get('--stream-id'),
    correlationId: values.get('--correlation-id'),
    recordedAt: values.get('--recorded-at'),
    repository: values.get('--repository'),
    ticket: values.get('--ticket'),
  };
};

const asRecord = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);
const asText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return '';
};
const asString = (value, fallback = '') => {
  const text = asText(value);
  return text || fallback;
};

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

function asSha(value, name, allowNull = false) {
  const text = asText(value).toLowerCase();
  if (!text) return allowNull ? null : (() => { throw new Error(`${name} is required`); })();
  if (allowNull && ['0000000000000000000000000000000000000000', 'null', ''].includes(text)) return null;
  if (!SHA.test(text)) throw new Error(`${name} must be a full lowercase SHA`);
  return text;
}

function asTimestamp(value, name, allowNull = false) {
  const text = asString(value);
  if (!text) {
    if (allowNull) return null;
    throw new Error(`missing ${name}`);
  }
  if (!RFC3339.test(text) || !Number.isFinite(Date.parse(text))) {
    throw new Error(`${name} must be RFC3339`);
  }
  return text;
}

function asRepository(value) {
  const text = asString(value);
  if (!text || !REPOSITORY.test(text)) {
    throw new Error('repository must be owner/name');
  }
  return text;
}

function asTicket(value) {
  if (!value) return null;
  const text = asString(value);
  if (!TICKET.test(text)) throw new Error('ticket must look like ticket-***');
  return text;
}

function asActor(value, fallback) {
  const text = asString(value, fallback);
  if (!text) throw new Error('actor login is required');
  if (/[\x00-\x1f\x7f]/.test(text)) throw new Error('actor login contains control characters');
  return `github:${text}`;
}

function pickActor(...candidates) {
  for (const candidate of candidates) {
    const value = asString(candidate);
    if (value) return value;
  }
  return '';
}

function pickTimestamp(...candidates) {
  for (const candidate of candidates) {
    const value = asString(candidate);
    if (!value) continue;
    if (RFC3339.test(value) && Number.isFinite(Date.parse(value))) return value;
  }
  return '';
}

function canonicalEvidence(payload) {
  return stableStringify(payload);
}

function pickRepository(payload, override) {
  if (override) return asRepository(override);
  const repositoryObject = asRecord(payload.repository);
  const repository = asString(repositoryObject?.full_name) || asString(payload.repository_name);
  if (!repository) throw new Error('repository is required; pass --repository');
  return asRepository(repository);
}

function makeCommonEvent(event) {
  if (!REPOSITORY.test(event.repository)) {
    throw new Error('invalid repository');
  }
  if (!event.actorId || !event.actorId.startsWith('github:')) {
    throw new Error('actor binding is required');
  }
  if (event.baseSha !== null && !SHA.test(event.baseSha)) throw new Error('baseSha must be a full SHA or null');
  if (event.headSha !== null && !SHA.test(event.headSha)) throw new Error('headSha must be a full SHA or null');
  if (!event.recordedAt || !RFC3339.test(event.recordedAt)) throw new Error('recordedAt must be RFC3339');
  if (!event.occurredAt || !RFC3339.test(event.occurredAt)) throw new Error('occurredAt must be RFC3339');
  return event;
}

function createPushEvents(payload, context) {
  const ref = asString(payload.ref);
  if (!ref) throw new Error('push.ref is required');
  const before = asSha(payload.before, 'push.before', true);
  const after = asSha(payload.after, 'push.after', true);
  const deleted = payload.deleted === true;
  const eventTime = pickTimestamp(
    asString(payload.head_commit?.timestamp),
    payload.timestamp,
    payload.repository?.pushed_at,
    context.recordedAt,
  );
  const occurredAt = asTimestamp(eventTime, 'recorded_at');
  const actor = asActor(
    pickActor(
      payload.pusher?.login,
      payload.pusher?.name,
      payload.sender?.login,
      payload.sender?.name,
    ),
    'github',
  );
  const subjectId = `git:ref/${ref}`;
  const events = [];
  const base = {
    source: 'github-api',
    repository: context.repository,
    ticketId: context.ticket,
    correlationId: context.correlationId,
    actorId: actor,
    baseSha: before,
    headSha: deleted ? null : after,
    evidenceKind: 'github_push',
    evidenceRef: `github:push/${context.correlationId}`,
    recordedAt: context.recordedAt,
  };
  events.push(makeCommonEvent({
    ...base,
    eventId: `${context.correlationId}:push`,
    type: 'git.push.received',
    trustClass: 'SYSTEM_FACT',
    occurredAt,
    subjectId,
    outcome: 'CREATED',
    evidence: canonicalEvidence({
      event: 'push',
      action: 'received',
      ref,
      before,
      after,
      deleted,
      sender: asString(payload.sender?.login) || asString(payload.sender?.name),
      pusher: asString(payload.pusher?.login) || asString(payload.pusher?.name),
    }),
  }));
  if (deleted) {
    events.push(makeCommonEvent({
      ...base,
      eventId: `${context.correlationId}:push:branch-deleted`,
      type: 'branch.deleted',
      trustClass: 'SYSTEM_FACT',
      occurredAt,
      baseSha: before,
      headSha: null,
      subjectId: `github:branch/${encodeURIComponent(ref)}`,
      evidenceKind: 'github_branch',
      evidenceRef: `github:branch/${encodeURIComponent(ref)}`,
      outcome: 'DELETED',
      evidence: canonicalEvidence({
        event: 'push.branch_deleted',
        ref,
        before,
      }),
    }));
  }
  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  for (const commit of commits) {
    if (!commit || typeof commit !== 'object' || Array.isArray(commit)) continue;
    const sha = asSha(commit.id, 'commit.id');
    const commitActor = pickActor(
      commit.author?.username,
      commit.committer?.name,
      commit.committer?.username,
      payload.sender?.login,
    );
    const commitActorId = asActor(commitActor, 'github');
    const commitAt = asTimestamp(
      pickTimestamp(asString(commit.timestamp), asString(payload.head_commit?.timestamp), context.recordedAt),
      'commit.timestamp',
    );
    events.push(makeCommonEvent({
      ...base,
      eventId: `${context.correlationId}:commit:${sha}`,
      type: 'git.commit.created',
      trustClass: 'SYSTEM_FACT',
      occurredAt: commitAt,
      actorId: commitActorId,
      subjectId: `git:commit/${sha}`,
      baseSha: null,
      headSha: sha,
      outcome: 'CREATED',
      evidenceKind: 'github_commit',
      evidenceRef: `github:commit/${sha}`,
      evidence: canonicalEvidence({
        event: 'git-commit',
        sha,
        message: asString(commit.message),
        distinct: commit.distinct === true,
      }),
    }));
  }
  return events;
}

function createPullRequestEvents(payload, context) {
  const action = asString(payload.action);
  if (!['opened', 'synchronize', 'closed'].includes(action)) {
    throw new Error(`unsupported pull_request action: ${action}`);
  }
  const pullRequest = asRecord(payload.pull_request);
  if (!pullRequest) throw new Error('pull_request object is required');
  const number = asString(pullRequest.number) || asString(pullRequest.id);
  if (!number) throw new Error('pull_request.number is required');
  const baseSha = asSha(pullRequest.base?.sha, 'pull_request.base.sha', true);
  const headSha = asSha(pullRequest.head?.sha, 'pull_request.head.sha', true);
  const actor = asActor(
    pickActor(
      asString(pullRequest.merged_by?.login),
      asString(payload.sender?.login),
      asString(payload.sender?.name),
    ),
    asString(payload.sender?.login, 'github'),
  );
  const createdAt = asTimestamp(asString(pullRequest.created_at), 'pull_request.created_at');
  const updatedAt = asTimestamp(asString(pullRequest.updated_at), 'pull_request.updated_at', true);
  const mergedAt = asTimestamp(asString(pullRequest.merged_at), 'pull_request.merged_at', true);
  const actionMap = {
    opened: { type: 'pull_request.opened', outcome: 'CREATED', occurredAt: createdAt },
    synchronize: { type: 'pull_request.synchronized', outcome: 'UPDATED', occurredAt: updatedAt },
    closed: {
      type: pullRequest.merged === true ? 'pull_request.merged' : 'pull_request.closed',
      outcome: pullRequest.merged === true ? 'MERGED' : 'CLOSED',
      occurredAt: mergedAt || updatedAt || createdAt,
    },
  };
  const mapping = actionMap[action];
  const occurredAt = asTimestamp(mapping.occurredAt, 'pull_request occurred_at');
  const subjectId = `github:pull-request/${number}`;
  return [makeCommonEvent({
    source: 'github-api',
    occurredAt,
    recordedAt: context.recordedAt,
    actorId: actor,
    subjectId,
    repository: context.repository,
    ticketId: context.ticket,
    correlationId: context.correlationId,
    baseSha,
    headSha,
    eventId: `${context.correlationId}:pull-request:${action}`,
    type: mapping.type,
    trustClass: 'SYSTEM_FACT',
    outcome: mapping.outcome,
    evidenceKind: 'github_pull_request',
    evidenceRef: `github:pull-request/${number}`,
    evidence: canonicalEvidence({
      event: 'pull_request',
      action,
      number,
      base: baseSha,
      head: headSha,
      merged: pullRequest.merged === true,
      state: asString(pullRequest.state),
    }),
  })];
}

function createPullRequestReviewEvents(payload, context) {
  const action = asString(payload.action);
  if (action !== 'submitted') {
    throw new Error(`unsupported pull_request_review action: ${action}`);
  }
  const review = asRecord(payload.review);
  if (!review) throw new Error('pull_request_review.review is required');
  const pullRequest = asRecord(payload.pull_request);
  if (!pullRequest) throw new Error('pull_request_review.pull_request is required');
  const reviewId = asString(review.id);
  const number = asString(pullRequest.number) || asString(pullRequest.id);
  if (!number) throw new Error('pull_request_review.number is required');
  const actor = asActor(
    pickActor(asString(review.user?.login), asString(payload.sender?.login)),
    asString(payload.sender?.login, 'github'),
  );
  const baseSha = asSha(pullRequest.base?.sha, 'pull_request.base.sha', true);
  const headSha = asSha(pullRequest.head?.sha, 'pull_request.head.sha', true);
  const state = asString(review.state);
  const outcomes = {
    approved: 'APPROVED',
    changes_requested: 'CHANGES_REQUESTED',
    commented: 'UPDATED',
    dismissed: 'UPDATED',
  };
  const outcome = outcomes[state];
  if (!outcome) throw new Error(`unsupported pull_request_review state: ${state}`);
  const occurredAt = asTimestamp(
    asString(review.submitted_at) || asString(pullRequest.updated_at) || context.recordedAt,
    'pull_request_review.submitted_at',
  );
  return [makeCommonEvent({
    source: 'github-api',
    occurredAt,
    recordedAt: context.recordedAt,
    actorId: actor,
    subjectId: `github:review/${reviewId || number}`,
    repository: context.repository,
    ticketId: context.ticket,
    correlationId: context.correlationId,
    baseSha,
    headSha,
    eventId: `${context.correlationId}:review:${reviewId || number}`,
    type: 'pull_request.reviewed',
    trustClass: 'SYSTEM_FACT',
    outcome,
    evidenceKind: 'github_review',
    evidenceRef: `github:review/${reviewId || number}`,
    evidence: canonicalEvidence({
      event: 'pull_request_review',
      state,
      pullRequest: number,
      review: reviewId,
    }),
  })];
}

function createWorkflowRunEvents(payload, context) {
  const action = asString(payload.action);
  if (action !== 'completed') {
    throw new Error(`unsupported workflow_run action: ${action}`);
  }
  const workflowRun = asRecord(payload.workflowRun) || asRecord(payload.workflow_run);
  if (!workflowRun) throw new Error('workflow_run object is required');
  const id = asString(workflowRun.id);
  if (!id) throw new Error('workflow_run.id is required');
  const actor = asActor(
    pickActor(asString(workflowRun.actor?.login), asString(payload.sender?.login), asString(payload.sender?.name)),
    asString(payload.sender?.login, 'github'),
  );
  const concluded = asString(workflowRun.conclusion);
  const outcomes = {
    success: 'PASSED',
    neutral: 'DEGRADED',
    failure: 'FAILED',
    cancelled: 'SKIPPED',
    skipped: 'SKIPPED',
    timed_out: 'FAILED',
    startup_failure: 'FAILED',
    action_required: 'BLOCKED',
    stale: 'BLOCKED',
  };
  const outcome = outcomes[concluded];
  if (!outcome) throw new Error(`unsupported workflow_run.conclusion: ${concluded}`);
  const occurredAt = asTimestamp(
    asString(workflowRun.updated_at) || asString(workflowRun.created_at),
    'workflow_run.updated_at',
  );
  const headSha = asSha(workflowRun.head_sha, 'workflow_run.head_sha', true);
  return [makeCommonEvent({
    source: 'github-api',
    occurredAt,
    recordedAt: context.recordedAt,
    actorId: actor,
    subjectId: `github:check-run/${id}`,
    repository: context.repository,
    ticketId: context.ticket,
    correlationId: context.correlationId,
    baseSha: null,
    headSha,
    eventId: `${context.correlationId}:check:${id}`,
    type: 'check.completed',
    trustClass: 'SYSTEM_FACT',
    outcome,
    evidenceKind: 'github_check',
    evidenceRef: `github:check-run/${id}`,
    evidence: canonicalEvidence({
      event: 'workflow_run',
      name: asString(workflowRun.name),
      conclusion: concluded,
      status: asString(workflowRun.status),
    }),
  })];
}

const EVENT_BUILDERS = {
  push: createPushEvents,
  pull_request: createPullRequestEvents,
  pull_request_review: createPullRequestReviewEvents,
  workflow_run: createWorkflowRunEvents,
};

function toEventSet(eventName, payload, context) {
  const builder = EVENT_BUILDERS[eventName];
  if (!builder) throw new Error(`unsupported event name: ${eventName}`);
  return builder(payload, context);
}

async function main() {
  let options;
  try {
    options = parser(process.argv.slice(2));
  } catch (error) {
    fail(error instanceof Error ? error.message : 'invalid arguments');
    process.stdout.write(usage);
    return;
  }
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  if (!options.eventName) {
    fail('missing --event-name');
    process.stdout.write(usage);
    return;
  }
  if (!EVENT_NAMES.has(options.eventName)) {
    fail(`unsupported event name: ${options.eventName}`);
    process.stdout.write(usage);
    return;
  }
  if (!options.eventPath) {
    fail('missing --event-path');
    return;
  }
  if (!options.output) {
    fail('missing --output');
    return;
  }

  const eventPath = path.resolve(options.eventPath);
  let payload;
  try {
    const raw = await fs.readFile(eventPath, 'utf8');
    payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('event payload must be a JSON object');
    }
  } catch (error) {
    fail(`event payload is invalid JSON: ${error instanceof Error ? error.message : 'invalid payload'}`);
    return;
  }

  try {
    const repository = pickRepository(payload, options.repository);
    const ticket = asTicket(options.ticket);
    const recordedAt = asTimestamp(
      options.recordedAt
      || asString(payload.repository?.updated_at)
      || asString(payload.timestamp)
      || asString(payload.pushed_at)
      || asString(payload.workflow_run?.updated_at)
      || asString(payload.workflow_run?.created_at),
      'recorded-at',
    );
    const correlationFallback = asString(payload.workflow_run?.id)
      || asString(payload.pull_request?.id)
      || asString(payload.review?.id)
      || asString(payload.sender?.id);
    const correlationId = asString(options.correlationId, correlationFallback);
    if (!correlationId) throw new Error('correlation-id is required');
    const streamId = asString(options.streamId, `${repository.replace('/', '-')}-${correlationId}`);
    if (!streamId) throw new Error('stream-id is required');
    const output = path.resolve(options.output);
    const context = {
      repository,
      ticket,
      recordedAt,
      correlationId,
      streamId,
    };
    const events = toEventSet(options.eventName, payload, context);
    if (!events.length) throw new Error('no events could be mapped from payload');
    const generatedAt = events
      .map((event) => event.occurredAt)
      .sort()
      .at(-1) ?? context.recordedAt;
    const document = createEventLog({
      streamId: context.streamId,
      generatedAt,
      events,
    });
    await writeEventLogAtomic(output, document);
    process.stdout.write(`${JSON.stringify({
      status: 'ok',
      streamId: context.streamId,
      output: path.relative(process.cwd(), output),
      eventCount: events.length,
      generatedAt,
      schema: 't2c.event-log/v1',
    })}\n`);
  } catch (error) {
    fail(error instanceof Error ? error.message : 'failed to create event log');
  }
}

await main();
