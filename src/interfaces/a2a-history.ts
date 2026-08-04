import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { assertPathWithinRoot } from '../core/security.js';
import {
  type CommunicationRunSummary,
  type IntentRunListItem,
  runListItem,
} from './a2a-run-list-item.js';

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

async function safeRunPath(config: T2CConfig, directory: string, name: string): Promise<string> {
  return assertPathWithinRoot(config.root, path.join(directory, name), config.allowOutsideRoot);
}
