import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { stableStringify } from '../core/id.js';
import type { PipelineManifest } from '../core/types.js';
import {
  createEventLog,
  EventLogError,
  writeEventLogAtomic,
  type EventLogEventInput,
  type EventLogOutcome,
} from './event-log.js';

const execFileAsync = promisify(execFile);
const SHA = /^[a-f0-9]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
type CommonEventFields = Pick<EventLogEventInput,
  'occurredAt' | 'recordedAt' | 'repository' | 'ticketId' | 'correlationId' | 'baseSha' | 'headSha'>;

export async function persistPipelineEventLog(input: {
  root: string;
  runDirectory: string;
  manifest: PipelineManifest;
  replaceUnfinished?: boolean;
}): Promise<string> {
  const manifestPath = path.join(input.runDirectory, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as PipelineManifest;
  const manifestEvidence = canonicalPipelineManifestEvidence(manifest);
  const identity = await pipelineIdentity(input.root);
  const common: CommonEventFields = {
    occurredAt: manifest.createdAt,
    recordedAt: manifest.createdAt,
    repository: identity.repository,
    ticketId: manifest.configuration.communicationTicket,
    correlationId: manifest.runId,
    baseSha: null,
    headSha: identity.headSha,
  };
  const statusOutcome: EventLogOutcome = manifest.status === 'succeeded'
    ? 'PASSED' : manifest.status === 'degraded' ? 'DEGRADED' : 'FAILED';
  const events = baseEvents(manifest, common, statusOutcome, manifestEvidence);
  await appendDiagnosticEvent(events, { ...input, manifest }, common);
  if (Object.values(manifest.llm).some(Boolean)) {
    events.push({
      ...common,
      eventId: `${manifest.runId}:llm-analysis`,
      type: 'analysis.completed',
      trustClass: 'ADVISORY_INFERENCE',
      actorId: 'todo2code:llm-stage',
      subjectId: `run:${manifest.runId}`,
      source: 'todo2code:pipeline',
      outcome: statusOutcome,
      evidenceKind: 'pipeline_manifest',
      evidenceRef: 'artifact:manifest.json#event-log-projection-v1',
      evidence: manifestEvidence,
    });
  }
  const document = createEventLog({
    streamId: manifest.runId,
    generatedAt: manifest.createdAt,
    events,
  });
  const output = path.join(input.runDirectory, 'logs.dsl.txt');
  await writeEventLogAtomic(output, document, input.replaceUnfinished ? { replaceUnfinished: true } : {});
  return output;
}

export function canonicalPipelineManifestEvidence(manifest: PipelineManifest): string {
  const { files: _mutableFiles, ...immutable } = manifest;
  return stableStringify(immutable);
}

function baseEvents(
  manifest: PipelineManifest,
  common: CommonEventFields,
  statusOutcome: EventLogOutcome,
  evidence: string,
): EventLogEventInput[] {
  const evidenceFields = {
    evidenceKind: 'pipeline_manifest',
    evidenceRef: 'artifact:manifest.json#event-log-projection-v1',
    evidence,
  };
  return [{
    ...common,
    ...evidenceFields,
    eventId: `${manifest.runId}:analysis`,
    type: 'analysis.completed',
    trustClass: 'SYSTEM_FACT',
    actorId: 'todo2code:pipeline',
    subjectId: `run:${manifest.runId}`,
    source: 'todo2code:pipeline',
    outcome: statusOutcome,
  }];
}

async function pipelineIdentity(root: string): Promise<{ repository: string; headSha: string | null }> {
  const resolvedRoot = await fs.realpath(root);
  const [remote, head] = await Promise.all([
    git(root, ['config', '--get', 'remote.origin.url']),
    git(root, ['rev-parse', '--verify', 'HEAD']),
  ]);
  return {
    repository: repositoryFromRemote(remote)
      ?? `local/${createHash('sha256').update(resolvedRoot).digest('hex').slice(0, 24)}`,
    headSha: SHA.test(head) ? head : null,
  };
}

async function git(root: string, args: string[]): Promise<string> {
  try {
    const result = await execFileAsync('git', ['-C', root, '--no-optional-locks', ...args], {
      encoding: 'utf8', maxBuffer: 1024 * 1024,
      env: { ...process.env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' },
    });
    return result.stdout.trim();
  } catch {
    return '';
  }
}

function repositoryFromRemote(remote: string): string | null {
  if (!remote) return null;
  let repositoryPath = '';
  const scp = /^[^@\s]+@[^:\s]+:(.+)$/.exec(remote);
  if (scp) repositoryPath = scp[1] ?? '';
  else {
    try {
      const url = new URL(remote);
      if (!['http:', 'https:', 'ssh:', 'git:'].includes(url.protocol)) return null;
      repositoryPath = url.pathname;
    } catch {
      return null;
    }
  }
  const parts = repositoryPath.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '').split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const repository = `${parts.at(-2)}/${parts.at(-1)}`;
  return REPOSITORY.test(repository) && !repository.includes('..') ? repository : null;
}

async function appendDiagnosticEvent(
  events: EventLogEventInput[],
  input: { root: string; runDirectory: string; manifest: PipelineManifest },
  common: CommonEventFields,
): Promise<void> {
  const relative = input.manifest.files.diagnostics;
  if (!relative) return;
  const diagnosticsPath = path.resolve(input.root, relative);
  const runRoot = `${path.resolve(input.runDirectory)}${path.sep}`;
  if (!diagnosticsPath.startsWith(runRoot)) evidenceError('Diagnostics evidence escapes the run directory');
  let evidence: Buffer;
  try {
    evidence = await fs.readFile(diagnosticsPath);
  } catch {
    evidenceError('Registered diagnostics evidence is missing');
  }
  let blocking = 0;
  let count = 0;
  try {
    const parsed = JSON.parse(evidence.toString('utf8')) as {
      diagnostics?: unknown[];
      counts?: { blocking?: number };
    };
    count = Array.isArray(parsed.diagnostics) ? parsed.diagnostics.length : 0;
    blocking = Number.isSafeInteger(parsed.counts?.blocking) ? parsed.counts?.blocking ?? 0 : 0;
  } catch {
    evidenceError('Diagnostics evidence is not valid JSON');
  }
  if (count === 0) return;
  events.push({
    ...common,
    eventId: `${input.manifest.runId}:diagnostics`,
    type: 'diagnostic.raised',
    trustClass: 'SYSTEM_FACT',
    actorId: 'todo2code:diagnostics',
    subjectId: `diagnostics:${input.manifest.runId}`,
    source: 'todo2code:pipeline',
    outcome: blocking > 0 ? 'BLOCKED' : 'DEGRADED',
    evidenceKind: 'diagnostic_report',
    evidenceRef: 'artifact:diagnostics.json',
    evidence,
  });
}

function evidenceError(message: string): never {
  throw new EventLogError('LOG-EVIDENCE-006', message);
}
