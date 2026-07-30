// Watcher behaviour. The clock, sleep and report function are injected so the
// rate limit is verified in milliseconds rather than by waiting a real minute.

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createIgnoreMatcher, parseIgnoreFile } from '../src/core/ignore.js';
import type { PipelineOptions } from '../src/core/types.js';
import {
  describeDelta,
  diffSnapshots,
  scanTree,
  watchRepository,
  type ReportResult,
  type WatchEvent,
} from '../src/watch/watcher.js';
import { makeConfig } from './helpers.js';

function pipelineOptions(root: string): PipelineOptions {
  return {
    root,
    taskFile: null,
    todoFile: 'TODO.md',
    changelogFile: 'CHANGELOG.md',
    documentPatterns: [],
    includeDocumentationLlm: false,
    outputDir: '.intent',
    gitCommitCount: 10,
    allowSummaryFallback: true,
  };
}

/** Drives the loop on a virtual clock: no real time passes. */
function createHarness() {
  let now = 0;
  const events: WatchEvent[] = [];
  const reports: string[] = [];
  return {
    events,
    reports,
    now: (): number => now,
    advance: (ms: number): void => { now += ms; },
    sleep: async (ms: number): Promise<void> => { now += ms; },
    onEvent: (event: WatchEvent): void => { events.push(event); },
    runReport: async (reason: string): Promise<ReportResult> => {
      reports.push(reason);
      return { runId: `run-${reports.length}`, summaryPath: `.intent/runs/run-${reports.length}/team-summary.md` };
    },
  };
}

test('scanTree prunes ignored directories and records file signatures', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-scan-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.mkdir(path.join(root, 'node_modules', 'left-pad'), { recursive: true });
  await fs.mkdir(path.join(root, '.git'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const a = 1;\n', 'utf8');
  await fs.writeFile(path.join(root, 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n', 'utf8');
  await fs.writeFile(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8');

  const matcher = createIgnoreMatcher(parseIgnoreFile('node_modules/\n.*/\n'));
  const snapshot = await scanTree(root, { matcher });

  assert.deepEqual([...snapshot.keys()], ['src/index.ts']);
  assert.match(snapshot.get('src/index.ts') ?? '', /^\d+:\d+$/);
});

test('diffSnapshots classifies additions, modifications and removals', () => {
  const before = new Map([['a.ts', '1:10'], ['b.ts', '1:10']]);
  const after = new Map([['a.ts', '2:12'], ['c.ts', '1:5']]);
  const delta = diffSnapshots(before, after);

  assert.deepEqual(delta.added, ['c.ts']);
  assert.deepEqual(delta.modified, ['a.ts']);
  assert.deepEqual(delta.removed, ['b.ts']);
  assert.equal(delta.total, 3);
  assert.equal(describeDelta(delta), '+c.ts, ~a.ts, -b.ts');
});

test('describeDelta truncates long change lists', () => {
  const delta = diffSnapshots(new Map(), new Map([['a', '1'], ['b', '1'], ['c', '1'], ['d', '1']]));
  assert.equal(describeDelta(delta, 2), '+a, +b (+2 more)');
});

test('An unchanged tree produces exactly one report and then stays quiet', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-watch-quiet-'));
  await fs.writeFile(path.join(root, 'a.ts'), 'export const a = 1;\n', 'utf8');
  const harness = createHarness();
  const controller = new AbortController();

  let ticks = 0;
  await watchRepository({
    root,
    pipeline: pipelineOptions(root),
    minIntervalMs: 60_000,
    scanIntervalMs: 1_000,
    signal: controller.signal,
    now: harness.now,
    onEvent: harness.onEvent,
    runReport: harness.runReport,
    sleep: async (ms) => {
      await harness.sleep(ms);
      if (++ticks >= 5) controller.abort();
    },
  }, makeConfig(root));

  assert.deepEqual(harness.reports, ['initial scan']);
  assert.ok(!harness.events.some((event) => event.type === 'change'));
});

test('Reports are rate limited to one per interval no matter how often files change', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-watch-throttle-'));
  const target = path.join(root, 'a.ts');
  await fs.writeFile(target, 'export const a = 0;\n', 'utf8');

  const harness = createHarness();
  const controller = new AbortController();
  let ticks = 0;

  await watchRepository({
    root,
    pipeline: pipelineOptions(root),
    minIntervalMs: 60_000,
    scanIntervalMs: 1_000,
    signal: controller.signal,
    now: harness.now,
    onEvent: harness.onEvent,
    runReport: harness.runReport,
    sleep: async (ms) => {
      await harness.sleep(ms);
      ticks += 1;
      // Touch the file on every tick: 90 virtual seconds of constant churn.
      await fs.writeFile(target, `export const a = ${ticks};\n`, 'utf8');
      await fs.utimes(target, new Date(), new Date(Date.now() + ticks * 1000));
      if (ticks >= 90) controller.abort();
    },
  }, makeConfig(root));

  // 90 s of continuous change at a 60 s floor: the initial report plus one more.
  assert.equal(harness.reports.length, 2, `expected 2 reports, got ${harness.reports.length}`);
  assert.equal(harness.reports[0], 'initial scan');
  assert.match(harness.reports[1] ?? '', /change\(s\)/);
  assert.ok(
    harness.events.some((event) => event.type === 'throttled'),
    'the watcher must report that it is throttling',
  );
});

test('A change is reported once the interval has elapsed', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-watch-elapsed-'));
  const target = path.join(root, 'a.ts');
  await fs.writeFile(target, 'export const a = 0;\n', 'utf8');

  const harness = createHarness();
  const controller = new AbortController();
  let ticks = 0;

  await watchRepository({
    root,
    pipeline: pipelineOptions(root),
    minIntervalMs: 10_000,
    scanIntervalMs: 1_000,
    signal: controller.signal,
    now: harness.now,
    onEvent: harness.onEvent,
    runReport: harness.runReport,
    sleep: async (ms) => {
      await harness.sleep(ms);
      ticks += 1;
      if (ticks === 1) {
        await fs.writeFile(target, 'export const a = 1;\n', 'utf8');
        await fs.utimes(target, new Date(), new Date(Date.now() + 5000));
      }
      if (ticks >= 20) controller.abort();
    },
  }, makeConfig(root));

  assert.equal(harness.reports.length, 2);
  assert.match(harness.reports[1] ?? '', /^1 change\(s\): ~a\.ts$/);
});

test('Ignored files never trigger a report', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-watch-ignored-'));
  await fs.writeFile(path.join(root, '.intentignore'), 'ignored/\n*.log\n', 'utf8');
  await fs.mkdir(path.join(root, 'ignored'), { recursive: true });
  await fs.writeFile(path.join(root, 'a.ts'), 'export const a = 0;\n', 'utf8');

  const harness = createHarness();
  const controller = new AbortController();
  let ticks = 0;

  await watchRepository({
    root,
    pipeline: pipelineOptions(root),
    minIntervalMs: 0, // No floor: any missed change would surface immediately.
    scanIntervalMs: 1_000,
    signal: controller.signal,
    now: harness.now,
    onEvent: harness.onEvent,
    runReport: harness.runReport,
    sleep: async (ms) => {
      await harness.sleep(ms);
      ticks += 1;
      await fs.writeFile(path.join(root, 'ignored', `f${ticks}.txt`), 'x', 'utf8');
      await fs.writeFile(path.join(root, `noise-${ticks}.log`), 'x', 'utf8');
      if (ticks >= 6) controller.abort();
    },
  }, makeConfig(root));

  assert.deepEqual(harness.reports, ['initial scan']);
});

test('A failing report is surfaced and does not stop the watcher', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-watch-error-'));
  await fs.writeFile(path.join(root, 'a.ts'), 'export const a = 0;\n', 'utf8');
  const harness = createHarness();
  const controller = new AbortController();
  let ticks = 0;

  await watchRepository({
    root,
    pipeline: pipelineOptions(root),
    minIntervalMs: 0,
    scanIntervalMs: 1_000,
    signal: controller.signal,
    now: harness.now,
    onEvent: harness.onEvent,
    runReport: async () => { throw new Error('pipeline exploded'); },
    sleep: async (ms) => {
      await harness.sleep(ms);
      if (++ticks >= 3) controller.abort();
    },
  }, makeConfig(root));

  const failure = harness.events.find((event) => event.type === 'report:error');
  assert.ok(failure && failure.type === 'report:error');
  assert.match(failure.message, /pipeline exploded/);
  assert.ok(harness.events.some((event) => event.type === 'stopped'), 'the loop shuts down cleanly');
});

test('--no-initial-report waits for a real change', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-watch-noinitial-'));
  await fs.writeFile(path.join(root, 'a.ts'), 'export const a = 0;\n', 'utf8');
  const harness = createHarness();
  const controller = new AbortController();
  let ticks = 0;

  await watchRepository({
    root,
    pipeline: pipelineOptions(root),
    minIntervalMs: 0,
    scanIntervalMs: 1_000,
    runOnStart: false,
    signal: controller.signal,
    now: harness.now,
    onEvent: harness.onEvent,
    runReport: harness.runReport,
    sleep: async (ms) => {
      await harness.sleep(ms);
      if (++ticks >= 3) controller.abort();
    },
  }, makeConfig(root));

  assert.deepEqual(harness.reports, []);
});

test('Communication changes trigger watch and coalesce under the existing report rate limit', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-watch-communication-'));
  const ticketRoot = path.join(root, 'project', 'WM-202');
  await fs.mkdir(ticketRoot, { recursive: true });
  const target = path.join(ticketRoot, 'agent.plan.md');
  await fs.writeFile(target, 'Plan 0.\n', 'utf8');
  const harness = createHarness();
  const controller = new AbortController();
  let ticks = 0;

  await watchRepository({
    root,
    pipeline: pipelineOptions(root),
    minIntervalMs: 5_000,
    scanIntervalMs: 1_000,
    signal: controller.signal,
    now: harness.now,
    onEvent: harness.onEvent,
    runReport: harness.runReport,
    sleep: async (ms) => {
      await harness.sleep(ms);
      ticks += 1;
      if (ticks <= 3) {
        await fs.writeFile(target, `Plan ${ticks}.\n`, 'utf8');
        await fs.utimes(target, new Date(), new Date(Date.now() + ticks * 1000));
      }
      if (ticks >= 8) controller.abort();
    },
  }, makeConfig(root));

  assert.equal(harness.reports.length, 2);
  assert.match(harness.reports[1] ?? '', /project\/WM-202\/agent\.plan\.md/);
  assert.ok(harness.events.some((event) => event.type === 'throttled'));
});
