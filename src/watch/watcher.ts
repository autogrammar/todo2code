// Local change detection with a rate-limited report.
//
// The watcher polls the tree instead of relying on `fs.watch` recursion, which
// is platform-dependent and drops events under load. A poll is cheap because
// ignored directories are pruned before they are read, and it gives one
// deterministic answer: the set of paths whose size or mtime moved.
//
// Two independent timings apply:
//   * `scanIntervalMs` — how quickly a change is noticed;
//   * `minIntervalMs`  — the floor between two reports.
// A report is therefore never generated more often than the floor allows, no
// matter how frequently files change.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { loadIgnoreMatcher, type IgnoreMatcher } from '../core/ignore.js';
import type { PipelineOptions } from '../core/types.js';
import { runPipeline } from '../pipeline/run.js';

/** Repository-relative path -> `mtimeMs:size`. */
export type TreeSnapshot = Map<string, string>;

export interface SnapshotDelta {
  added: string[];
  removed: string[];
  modified: string[];
  total: number;
}

export interface ScanOptions {
  maxFiles?: number;
  /** Follow nothing: symlinks are skipped to avoid cycles outside the root. */
  matcher: IgnoreMatcher;
}

export async function scanTree(root: string, options: ScanOptions): Promise<TreeSnapshot> {
  const maxFiles = Math.max(1, options.maxFiles ?? 50_000);
  const snapshot: TreeSnapshot = new Map();
  const absoluteRoot = path.resolve(root);

  async function visit(directory: string): Promise<void> {
    if (snapshot.size >= maxFiles) return;
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return; // A directory removed mid-scan is simply absent from the snapshot.
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (snapshot.size >= maxFiles) return;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(absoluteRoot, absolute).replace(/\\/g, '/');
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        // Pruning here is what keeps polling cheap: node_modules is never read.
        if (options.matcher.ignores(relative, true)) continue;
        await visit(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (options.matcher.ignores(relative, false)) continue;

      try {
        const stat = await fs.stat(absolute);
        snapshot.set(relative, `${Math.trunc(stat.mtimeMs)}:${stat.size}`);
      } catch {
        // Vanished between readdir and stat; treat as absent.
      }
    }
  }

  await visit(absoluteRoot);
  return snapshot;
}

export function diffSnapshots(before: TreeSnapshot, after: TreeSnapshot): SnapshotDelta {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const [file, signature] of after) {
    const previous = before.get(file);
    if (previous === undefined) added.push(file);
    else if (previous !== signature) modified.push(file);
  }
  for (const file of before.keys()) {
    if (!after.has(file)) removed.push(file);
  }

  added.sort();
  removed.sort();
  modified.sort();
  return { added, removed, modified, total: added.length + removed.length + modified.length };
}

export function describeDelta(delta: SnapshotDelta, maxNames = 3): string {
  const names = [
    ...delta.added.map((file) => `+${file}`),
    ...delta.modified.map((file) => `~${file}`),
    ...delta.removed.map((file) => `-${file}`),
  ];
  const shown = names.slice(0, maxNames).join(', ');
  const rest = names.length - Math.min(names.length, maxNames);
  return rest > 0 ? `${shown} (+${rest} more)` : shown;
}

export type WatchEvent =
  | { type: 'ready'; root: string; files: number; sources: string[] }
  | { type: 'change'; delta: SnapshotDelta; description: string }
  | { type: 'throttled'; waitMs: number; pending: number }
  | { type: 'report:start'; reason: string }
  | { type: 'report:done'; runId: string; summaryPath: string; durationMs: number }
  | { type: 'report:error'; message: string }
  | { type: 'stopped' };

export interface ReportResult {
  runId: string;
  summaryPath: string;
}

export interface WatchOptions {
  root: string;
  pipeline: PipelineOptions;
  /** Floor between two reports. Defaults to 60 000 ms. */
  minIntervalMs?: number;
  /** How often the tree is rescanned. Defaults to 2 000 ms. */
  scanIntervalMs?: number;
  /** Generate one report before waiting for the first change. */
  runOnStart?: boolean;
  maxFiles?: number;
  signal?: AbortSignal;
  onEvent?: (event: WatchEvent) => void;
  /** Overridable for tests; defaults to the real pipeline. */
  runReport?: (reason: string) => Promise<ReportResult>;
  /** Overridable for tests. */
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const DEFAULT_MIN_INTERVAL_MS = 60_000;
const DEFAULT_SCAN_INTERVAL_MS = 2_000;

interface WatchRuntime {
  root: string;
  minIntervalMs: number;
  scanIntervalMs: number;
  emit: (event: WatchEvent) => void;
  now: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  signal: AbortSignal | undefined;
  matcher: IgnoreMatcher;
  runReport: (reason: string) => Promise<ReportResult>;
  scanOptions: ScanOptions;
}

async function createWatchRuntime(options: WatchOptions, config: T2CConfig): Promise<WatchRuntime> {
  const root = path.resolve(options.root);
  const minIntervalMs = Math.max(0, options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS);
  const scanIntervalMs = Math.max(50, options.scanIntervalMs ?? DEFAULT_SCAN_INTERVAL_MS);
  const emit = options.onEvent ?? ((): void => {});
  const now = options.now ?? ((): number => Date.now());
  const sleep = options.sleep ?? defaultSleep;
  const signal = options.signal;

  const matcher = await loadIgnoreMatcher(root);
  const runReport = options.runReport ?? (async (): Promise<ReportResult> => {
    const result = await runPipeline(options.pipeline, config);
    return { runId: result.manifest.runId, summaryPath: result.summaryPath };
  });

  const scanOptions: ScanOptions = { matcher, ...(options.maxFiles === undefined ? {} : { maxFiles: options.maxFiles }) };
  return { root, minIntervalMs, scanIntervalMs, emit, now, sleep, signal, matcher, runReport, scanOptions };
}

export async function watchRepository(options: WatchOptions, config: T2CConfig): Promise<void> {
  const runtime = await createWatchRuntime(options, config);
  const {
    root, minIntervalMs, scanIntervalMs, emit, now, sleep, signal, matcher, runReport, scanOptions,
  } = runtime;
  let snapshot = await scanTree(root, scanOptions);
  emit({ type: 'ready', root, files: snapshot.size, sources: matcher.sources });

  // `lastReportStartedAt` anchors the floor to the start of a report, so a slow
  // pipeline does not add its own duration to the wait before the next one.
  let lastReportStartedAt = Number.NEGATIVE_INFINITY;
  let pending = 0;
  let pendingReason = '';

  if (options.runOnStart ?? true) {
    lastReportStartedAt = now();
    await generate('initial scan');
  }

  while (!signal?.aborted) {
    await sleep(scanIntervalMs, signal);
    if (signal?.aborted) break;

    const current = await scanTree(root, scanOptions);
    const delta = diffSnapshots(snapshot, current);
    snapshot = current;

    if (delta.total > 0) {
      pending += delta.total;
      pendingReason = describeDelta(delta);
      emit({ type: 'change', delta, description: pendingReason });
    }
    if (pending === 0) continue;

    const waitMs = lastReportStartedAt + minIntervalMs - now();
    if (waitMs > 0) {
      emit({ type: 'throttled', waitMs, pending });
      continue;
    }

    const reason = `${pending} change(s): ${pendingReason}`;
    pending = 0;
    pendingReason = '';
    lastReportStartedAt = now();
    await generate(reason);
  }

  emit({ type: 'stopped' });

  async function generate(reason: string): Promise<void> {
    emit({ type: 'report:start', reason });
    const startedAt = now();
    try {
      const result = await runReport(reason);
      emit({
        type: 'report:done',
        runId: result.runId,
        summaryPath: result.summaryPath,
        durationMs: now() - startedAt,
      });
    } catch (error) {
      emit({ type: 'report:error', message: error instanceof Error ? error.message : String(error) });
    }
    // Changes written by the report itself must not trigger the next one.
    snapshot = await scanTree(root, scanOptions);
  }
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      finish();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    function finish(): void {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }
  });
}
