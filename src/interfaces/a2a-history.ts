import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { assertPathWithinRoot } from '../core/security.js';
import { isRecord } from './a2a-types.js';

interface IntentRunListItem {
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

interface CommunicationRunSummary {
  tickets: string[];
  participants: Array<{ participant: string; role: string; tickets: string[]; issueIds: string[] }>;
  issueSeverities: string[];
  issueCount: number;
}

export interface RunHistoryFilters {
  participant: string | null;
  role: string | null;
  ticket: string | null;
  severity: string | null;
}

const EMPTY_FILTERS: RunHistoryFilters = {
  participant: null,
  role: null,
  ticket: null,
  severity: null,
};

export async function listIntentRuns(
  config: T2CConfig,
  filters: RunHistoryFilters = EMPTY_FILTERS,
): Promise<IntentRunListItem[]> {
  const runsDirectory = await assertPathWithinRoot(
    config.root,
    path.resolve(config.root, config.outputDir, 'runs'),
    config.allowOutsideRoot,
  );
  const entries = await readRunEntries(runsDirectory);
  const items = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => right.name.localeCompare(left.name))
    .slice(0, 500)
    .map((entry) => readRun(config, runsDirectory, entry)));
  return items
    .filter((item): item is IntentRunListItem => item !== null)
    .filter((item) => matchesRunFilters(item.communication, filters))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
      || right.runId.localeCompare(left.runId));
}

async function readRunEntries(runsDirectory: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(runsDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function readRun(
  config: T2CConfig,
  runsDirectory: string,
  entry: Dirent,
): Promise<IntentRunListItem | null> {
  try {
    const runDirectory = path.join(runsDirectory, entry.name);
    const graphPath = await safeRunPath(config, runDirectory, 'intent.graph.json');
    const manifestPath = await safeRunPath(config, runDirectory, 'manifest.json');
    const [graphStat, manifestStat] = await Promise.all([
      fs.stat(graphPath).catch((error: NodeJS.ErrnoException) => error.code === 'ENOENT' ? null : Promise.reject(error)),
      fs.stat(manifestPath),
    ]);
    if (!manifestStat.isFile() || manifestStat.size > 2 * 1024 * 1024) return null;
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    return runListItem(config.root, entry.name, graphPath, graphStat, manifestStat, manifest);
  } catch {
    return null;
  }
}

async function safeRunPath(config: T2CConfig, directory: string, name: string): Promise<string> {
  return assertPathWithinRoot(config.root, path.join(directory, name), config.allowOutsideRoot);
}

async function runListItem(
  root: string,
  fallbackRunId: string,
  graphPath: string,
  graphStat: import('node:fs').Stats | null,
  manifestStat: import('node:fs').Stats,
  manifest: Record<string, unknown>,
): Promise<IntentRunListItem> {
  const files = safeManifestFiles(root, isRecord(manifest.files) ? manifest.files : {});
  const llm = isRecord(manifest.llm) ? manifest.llm : null;
  const runtime = isRecord(manifest.runtime) ? manifest.runtime : null;
  const warnings = Array.isArray(manifest.warnings) ? manifest.warnings : [];
  return {
    runId: typeof manifest.runId === 'string' ? manifest.runId : fallbackRunId,
    createdAt: validTimestamp(manifest.createdAt) ?? manifestStat.mtime.toISOString(),
    graphFingerprint: typeof manifest.graphFingerprint === 'string' ? manifest.graphFingerprint : null,
    graphPath: graphStat?.isFile() ? relativeApiPath(root, graphPath) : null,
    summaryPath: typeof files.summary === 'string' ? files.summary : null,
    warningCount: warnings.length,
    status: validStatus(manifest.status),
    failure: isRecord(manifest.failure) ? manifest.failure : null,
    runtimeVersion: runtime && typeof runtime.version === 'string' ? runtime.version : null,
    stages: isRecord(manifest.stages) ? manifest.stages : null,
    files,
    llm: llm ? llmSummary(llm) : null,
    graphBytes: graphStat?.isFile() ? graphStat.size : 0,
    communication: await readCommunicationSummary(root, files),
  };
}

function validTimestamp(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function validStatus(value: unknown): IntentRunListItem['status'] {
  return value === 'succeeded' || value === 'degraded' || value === 'failed' ? value : null;
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
    const filePath = path.resolve(root, relative);
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

function matchesRunFilters(summary: CommunicationRunSummary | null, filters: RunHistoryFilters): boolean {
  const participant = normalized(filters.participant);
  const role = normalized(filters.role);
  const ticket = normalized(filters.ticket);
  const severity = normalized(filters.severity);
  if (!participant && !role && !ticket && !severity) return true;
  if (!summary) return false;
  return (!participant || summary.participants.some((item) => item.participant.toLowerCase().includes(participant)))
    && (!role || summary.participants.some((item) => item.role.toLowerCase() === role))
    && (!ticket || summary.tickets.some((item) => item.toLowerCase() === ticket))
    && (!severity || summary.issueSeverities.some((item) => item.toLowerCase() === severity));
}

function normalized(value: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function safeManifestFiles(root: string, files: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [name, value] of Object.entries(files)) {
    if (typeof value !== 'string') continue;
    const absolute = path.resolve(root, value);
    const relative = path.relative(root, absolute);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) output[name] = value;
  }
  return output;
}

function relativeApiPath(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}
