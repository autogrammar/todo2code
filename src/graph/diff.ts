import { sha256, stableStringify } from '../core/id.js';
import { assertIntentGraph } from '../core/schema.js';
import type {
  IntentGraph,
  IntentGraphDiff,
  IntentRecord,
  IntentRecordChange,
  IntentRelation,
} from '../core/types.js';

export interface DiffSvgOptions {
  maxItems?: number;
  title?: string;
}

export function diffIntentGraphs(
  before: IntentGraph,
  after: IntentGraph,
  generatedAt = new Date().toISOString(),
): IntentGraphDiff {
  assertGraph(before, 'before');
  assertGraph(after, 'after');

  const beforeById = new Map(before.records.map((record) => [record.id, record]));
  const afterById = new Map(after.records.map((record) => [record.id, record]));
  let unchangedRecords = 0;
  const unmatchedBefore: IntentRecord[] = [];
  const unmatchedAfter: IntentRecord[] = [];

  for (const record of before.records) {
    if (afterById.has(record.id)) unchangedRecords += 1;
    else unmatchedBefore.push(record);
  }
  for (const record of after.records) {
    if (!beforeById.has(record.id)) unmatchedAfter.push(record);
  }

  const beforeGroups = groupRecords(unmatchedBefore);
  const afterGroups = groupRecords(unmatchedAfter);
  const changed: IntentRecordChange[] = [];
  const removed: IntentRecord[] = [];
  const added: IntentRecord[] = [];
  const identities = [...new Set([...beforeGroups.keys(), ...afterGroups.keys()])].sort();

  for (const identity of identities) {
    const left = beforeGroups.get(identity) ?? [];
    const right = afterGroups.get(identity) ?? [];
    const paired = Math.min(left.length, right.length);
    for (let index = 0; index < paired; index += 1) {
      const beforeRecord = left[index];
      const afterRecord = right[index];
      if (!beforeRecord || !afterRecord) continue;
      changed.push({
        identity,
        before: beforeRecord,
        after: afterRecord,
        changedFields: changedFieldPaths(normalizeRecord(beforeRecord), normalizeRecord(afterRecord)),
      });
    }
    removed.push(...left.slice(paired));
    added.push(...right.slice(paired));
  }

  const beforeRelations = new Map(before.relations.map((relation) => [relationKey(relation), relation]));
  const afterRelations = new Map(after.relations.map((relation) => [relationKey(relation), relation]));
  const relationsAdded = [...afterRelations]
    .filter(([key]) => !beforeRelations.has(key))
    .map(([, relation]) => relation)
    .sort(compareRelations);
  const relationsRemoved = [...beforeRelations]
    .filter(([key]) => !afterRelations.has(key))
    .map(([, relation]) => relation)
    .sort(compareRelations);
  const relationsUnchanged = [...beforeRelations.keys()].filter((key) => afterRelations.has(key)).length;

  added.sort(compareRecords);
  removed.sort(compareRecords);
  changed.sort((left, right) => left.identity.localeCompare(right.identity));
  const summary = {
    recordsAdded: added.length,
    recordsRemoved: removed.length,
    recordsChanged: changed.length,
    recordsUnchanged: unchangedRecords,
    relationsAdded: relationsAdded.length,
    relationsRemoved: relationsRemoved.length,
    relationsUnchanged,
  };
  const fingerprint = sha256(stableStringify({
    beforeFingerprint: before.fingerprint,
    afterFingerprint: after.fingerprint,
    added: added.map((record) => record.id),
    removed: removed.map((record) => record.id),
    changed: changed.map((item) => [item.before.id, item.after.id, item.changedFields]),
    relationsAdded: relationsAdded.map(relationKey),
    relationsRemoved: relationsRemoved.map(relationKey),
  }));

  return {
    schemaVersion: 't2c.diff/v1',
    generatedAt,
    fingerprint,
    beforeFingerprint: before.fingerprint,
    afterFingerprint: after.fingerprint,
    records: { added, removed, changed, unchanged: unchangedRecords },
    relations: { added: relationsAdded, removed: relationsRemoved, unchanged: relationsUnchanged },
    summary,
  };
}

export function renderGraphDiffSvg(diff: IntentGraphDiff, options: DiffSvgOptions = {}): string {
  const maxItems = Math.max(1, Math.min(100, Math.trunc(options.maxItems ?? 18)));
  const title = options.title?.trim() || 'todo2code Intent Graph Diff';
  const sections = [
    { label: 'Added', color: '#22c55e', items: diff.records.added.map(recordLabel) },
    { label: 'Removed', color: '#ef4444', items: diff.records.removed.map(recordLabel) },
    { label: 'Changed', color: '#f59e0b', items: diff.records.changed.map(changeLabel) },
  ];
  const visibleRows = sections.reduce((total, section) => total + Math.min(section.items.length, maxItems) + 1, 0);
  const width = 1200;
  const height = Math.max(430, 220 + visibleRows * 28);
  let y = 190;
  const rows: string[] = [];
  for (const section of sections) {
    rows.push(`<text x="48" y="${y}" class="section" fill="${section.color}">${escapeXml(section.label)} (${section.items.length})</text>`);
    y += 30;
    for (const item of section.items.slice(0, maxItems)) {
      rows.push(`<circle cx="58" cy="${y - 5}" r="5" fill="${section.color}"/><text x="76" y="${y}" class="item">${escapeXml(truncate(item, 125))}</text>`);
      y += 28;
    }
    if (section.items.length > maxItems) {
      rows.push(`<text x="76" y="${y}" class="more">… ${section.items.length - maxItems} more</text>`);
      y += 28;
    }
    y += 12;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">Intent graph diff with ${diff.summary.recordsAdded} added, ${diff.summary.recordsRemoved} removed and ${diff.summary.recordsChanged} changed records.</desc>
  <style>
    .bg{fill:#0f172a}.panel{fill:#111827;stroke:#334155;stroke-width:1}.title{font:700 25px ui-sans-serif,system-ui;fill:#f8fafc}.meta{font:13px ui-monospace,monospace;fill:#94a3b8}.metric{font:700 20px ui-sans-serif,system-ui;fill:#f8fafc}.label{font:12px ui-sans-serif,system-ui;fill:#94a3b8}.section{font:700 17px ui-sans-serif,system-ui}.item{font:13px ui-monospace,monospace;fill:#e2e8f0}.more{font:italic 13px ui-sans-serif,system-ui;fill:#94a3b8}
  </style>
  <rect class="bg" width="100%" height="100%" rx="16"/>
  <text id="diff-title" x="40" y="46" class="title">${escapeXml(title)}</text>
  <text x="40" y="72" class="meta">${escapeXml(diff.beforeFingerprint.slice(0, 16))} → ${escapeXml(diff.afterFingerprint.slice(0, 16))}</text>
  ${metricCard(40, 92, 'Records +', diff.summary.recordsAdded, '#22c55e')}
  ${metricCard(230, 92, 'Records −', diff.summary.recordsRemoved, '#ef4444')}
  ${metricCard(420, 92, 'Changed', diff.summary.recordsChanged, '#f59e0b')}
  ${metricCard(610, 92, 'Relations +', diff.summary.relationsAdded, '#38bdf8')}
  ${metricCard(800, 92, 'Relations −', diff.summary.relationsRemoved, '#a78bfa')}
  <g>${rows.join('')}</g>
</svg>`;
}

function assertGraph(value: IntentGraph, name: string): void {
  try {
    assertIntentGraph(value);
  } catch (error) {
    throw new Error(`${name} must be a valid t2c.graph/v1 object: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function groupRecords(records: IntentRecord[]): Map<string, IntentRecord[]> {
  const groups = new Map<string, IntentRecord[]>();
  for (const record of records) {
    const identity = recordIdentity(record);
    const values = groups.get(identity) ?? [];
    values.push(record);
    groups.set(identity, values);
  }
  for (const values of groups.values()) values.sort(compareRecords);
  return groups;
}

function recordIdentity(record: IntentRecord): string {
  return stableStringify({
    sourceKind: record.source.kind,
    path: record.source.path,
    lines: record.source.lines,
    symbol: record.source.symbol,
    statementKind: record.statement.kind,
  });
}

function normalizeRecord(record: IntentRecord): unknown {
  return { ...record, id: null, observedAt: null };
}

function changedFieldPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (stableStringify(before) === stableStringify(after)) return [];
  if (isObject(before) && isObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return keys.flatMap((key) => changedFieldPaths(before[key], after[key], prefix ? `${prefix}.${key}` : key));
  }
  return [prefix || '$'];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function relationKey(relation: IntentRelation): string {
  return stableStringify({ from: relation.from, to: relation.to, type: relation.type, confidence: relation.confidence, basis: relation.basis });
}

function compareRecords(left: IntentRecord, right: IntentRecord): number {
  return left.id.localeCompare(right.id);
}

function compareRelations(left: IntentRelation, right: IntentRelation): number {
  return relationKey(left).localeCompare(relationKey(right));
}

function recordLabel(record: IntentRecord): string {
  const source = [record.source.path, record.source.lines?.start].filter((value) => value !== null && value !== undefined).join(':');
  return `${record.id} · ${record.statement.action} ${record.statement.object}${source ? ` · ${source}` : ''}`;
}

function changeLabel(change: IntentRecordChange): string {
  return `${change.before.id} → ${change.after.id} · ${change.changedFields.join(', ')}`;
}

function metricCard(x: number, y: number, label: string, value: number, color: string): string {
  return `<g><rect class="panel" x="${x}" y="${y}" width="170" height="68" rx="10"/><rect x="${x}" y="${y}" width="5" height="68" rx="3" fill="${color}"/><text x="${x + 18}" y="${y + 29}" class="metric">${value}</text><text x="${x + 18}" y="${y + 51}" class="label">${escapeXml(label)}</text></g>`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character] ?? character);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}
