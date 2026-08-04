import path from 'node:path';
import { promises as fs } from 'node:fs';
import { isRecord } from './a2a-types.js';

export interface IntentRunListItem {
  runId: string;
  createdAt: string;
  graphFingerprint: string | null;
  graphPath: string | null;
  summaryPath: string | null;
  warningCount: number;
  status: 'succeeded' | 'degraded' | 'failed' | null;
  failure: Record<string, unknown> | null;
  runtimeVersion: string | null;
  stages: Record<string, unknown> | null;
  files: Record<string, string>;
  llm: {
    naturalLanguageExtraction: boolean;
    markdownExtraction: boolean;
    documentationExtraction: boolean;
    taskSynthesis: boolean;
    summary: boolean;
  } | null;
  graphBytes: number;
  communication: CommunicationRunSummary | null;
}

export interface CommunicationRunSummary {
  tickets: string[];
  participants: Array<{ participant: string; role: string; tickets: string[]; issueIds: string[] }>;
  issueSeverities: string[];
  issueCount: number;
}

export async function runListItem(
  root: string,
  fallbackRunId: string,
  graphPath: string,
  graphStat: import('node:fs').Stats | null,
  manifestStat: import('node:fs').Stats,
  manifest: Record<string, unknown>,
): Promise<IntentRunListItem> {
  const files = safeManifestFiles(root, asRecord(manifest.files));
  return {
    runId: resolveRunId(manifest, fallbackRunId),
    createdAt: resolveCreatedAt(manifest, manifestStat),
    graphFingerprint: valueString(manifest.graphFingerprint),
    graphPath: graphStat?.isFile() ? relativeApiPath(root, graphPath) : null,
    summaryPath: valueString(files.summary),
    warningCount: warningCount(manifest),
    status: resolveStatus(manifest.status),
    failure: isRecord(manifest.failure) ? manifest.failure : null,
    runtimeVersion: runtimeVersion(manifest),
    stages: isRecord(manifest.stages) ? manifest.stages : null,
    files,
    llm: readLlmSummary(manifest),
    graphBytes: graphStat?.isFile() ? graphStat.size : 0,
    communication: await readCommunicationSummary(root, files),
  };
}

function resolveRunId(manifest: Record<string, unknown>, fallbackRunId: string): string {
  return typeof manifest.runId === 'string' ? manifest.runId : fallbackRunId;
}

function resolveCreatedAt(manifest: Record<string, unknown>, manifestStat: import('node:fs').Stats): string {
  return validTimestamp(manifest.createdAt) ?? manifestStat.mtime.toISOString();
}

function valueString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function warningCount(manifest: Record<string, unknown>): number {
  const warnings = Array.isArray(manifest.warnings) ? manifest.warnings : [];
  return warnings.length;
}

function resolveStatus(statusValue: unknown): IntentRunListItem['status'] {
  return statusValue === 'succeeded' || statusValue === 'degraded' || statusValue === 'failed' ? statusValue : null;
}

function runtimeVersion(manifest: Record<string, unknown>): string | null {
  const runtime = asRecord(manifest.runtime);
  if (!runtime || typeof runtime.version !== 'string') return null;
  return runtime.version;
}

function readLlmSummary(manifest: Record<string, unknown>): IntentRunListItem['llm'] {
  const llm = asRecord(manifest.llm);
  return llm ? llmSummary(llm) : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function validTimestamp(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function llmSummary(value: Record<string, unknown>): NonNullable<IntentRunListItem['llm']> {
  return {
    naturalLanguageExtraction: value.naturalLanguageExtraction === true,
    markdownExtraction: value.markdownExtraction === true,
    documentationExtraction: value.documentationExtraction === true,
    taskSynthesis: value.taskSynthesis === true,
    summary: value.summary === true,
  };
}

async function readCommunicationSummary(
  root: string,
  files: Record<string, string>,
): Promise<CommunicationRunSummary | null> {
  const relative = files.communicationAnalysis;
  if (!relative) return null;
  try {
    const filePath = path.resolve(root, relative.replace(/^\//, ''));
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > 4 * 1024 * 1024) return null;
    const value = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
    const participants = Array.isArray(value.participants)
      ? value.participants.filter(isRecord).map(participantSummary).filter((item) => item.participant)
      : [];
    const issues = Array.isArray(value.issues) ? value.issues.filter(isRecord) : [];
    return {
      tickets: stringArray(value.tickets),
      participants,
      issueSeverities: [...new Set(issues.flatMap((item) => (
        typeof item.severity === 'string' ? [item.severity] : []
      )))].sort(),
      issueCount: issues.length,
    };
  } catch {
    return null;
  }
}

function participantSummary(item: Record<string, unknown>): CommunicationRunSummary['participants'][number] {
  return {
    participant: typeof item.participant === 'string' ? item.participant : '',
    role: typeof item.role === 'string' ? item.role : 'unknown',
    tickets: stringArray(item.tickets),
    issueIds: stringArray(item.issueIds),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function safeManifestFiles(root: string, files: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [name, value] of Object.entries(files)) {
    if (typeof value !== 'string') continue;
    const safePath = value.replace(/^\//, '');
    const absolute = path.resolve(root, safePath);
    if (isWithinRoot(root, absolute)) output[name] = value;
  }
  return output;
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function relativeApiPath(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}
