import { createRelationId, graphFingerprint } from '../core/id.js';
import { keywords, similarity } from '../core/text.js';
import type { IntentGraph, IntentRecord, IntentRelation, RelationType } from '../core/types.js';

interface PairEvidence {
  score: number;
  basis: string[];
}

export function linkIntentRecords(inputRecords: IntentRecord[], generatedAt = new Date().toISOString()): IntentGraph {
  const records = deduplicateRecords(inputRecords).sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(records.map((record) => [record.id, record]));
  const candidatePairs = collectCandidatePairs(records);
  const relations: IntentRelation[] = [];

  for (const key of [...candidatePairs].sort()) {
    const [leftId, rightId] = key.split('|');
    const left = leftId ? byId.get(leftId) : undefined;
    const right = rightId ? byId.get(rightId) : undefined;
    if (!left || !right) continue;
    const evidence = scorePair(left, right);
    if (evidence.score < 0.42) continue;
    const directed = determineRelation(left, right, evidence);
    const relationWithoutId = {
      from: directed.from.id,
      to: directed.to.id,
      type: directed.type,
      confidence: Math.round(Math.min(0.99, evidence.score) * 1000) / 1000,
      basis: evidence.basis,
    };
    relations.push({ id: createRelationId(relationWithoutId), ...relationWithoutId });
  }

  const uniqueRelations = [...new Map(relations.map((relation) => [relation.id, relation])).values()]
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: 't2c.graph/v1',
    generatedAt,
    fingerprint: graphFingerprint(records, uniqueRelations),
    records,
    relations: uniqueRelations,
    stats: {
      bySource: countBy(records, (record) => record.source.kind),
      byAction: countBy(records, (record) => record.statement.action),
      byStatus: countBy(records, (record) => record.lifecycle.status),
    },
  };
}

function deduplicateRecords(records: IntentRecord[]): IntentRecord[] {
  const byId = new Map<string, IntentRecord>();
  for (const record of records) {
    const existing = byId.get(record.id);
    if (!existing || record.epistemic.confidence > existing.epistemic.confidence) byId.set(record.id, record);
  }
  return [...byId.values()];
}

function collectCandidatePairs(records: IntentRecord[]): Set<string> {
  const buckets = new Map<string, string[]>();
  const add = (key: string, id: string): void => {
    const values = buckets.get(key) ?? [];
    values.push(id);
    buckets.set(key, values);
  };

  for (const record of records) {
    for (const ticket of record.statement.target.tickets) add(`ticket:${ticket.toLowerCase()}`, record.id);
    for (const symbol of record.statement.target.symbols) add(`symbol:${symbol.toLowerCase()}`, record.id);
    for (const filePath of record.statement.target.paths) add(`path:${filePath.toLowerCase()}`, record.id);
    for (const token of keywords(record.statement.object).slice(0, 5)) add(`token:${token}`, record.id);
  }

  const output = new Set<string>();
  for (const ids of buckets.values()) {
    const unique = [...new Set(ids)].sort();
    const limited = unique.slice(0, 300);
    for (let left = 0; left < limited.length; left += 1) {
      for (let right = left + 1; right < limited.length; right += 1) {
        const leftId = limited[left];
        const rightId = limited[right];
        if (leftId && rightId) output.add(`${leftId}|${rightId}`);
      }
    }
  }
  return output;
}

function scorePair(left: IntentRecord, right: IntentRecord): PairEvidence {
  let score = 0;
  const basis: string[] = [];
  if (intersects(left.statement.target.tickets, right.statement.target.tickets)) {
    score += 0.62;
    basis.push('shared_ticket');
  }
  if (intersectsNormalized(left.statement.target.symbols, right.statement.target.symbols)) {
    score += 0.48;
    basis.push('shared_symbol');
  }
  if (intersectsNormalized(left.statement.target.paths, right.statement.target.paths)) {
    score += 0.28;
    basis.push('shared_path');
  }
  if (left.statement.action === right.statement.action && left.statement.action !== 'unknown') {
    score += 0.13;
    basis.push('same_action');
  }
  const objectSimilarity = Math.max(
    similarity(left.statement.object, right.statement.object),
    similarity(left.statement.text, right.statement.text),
  );
  if (objectSimilarity >= 0.2) {
    score += objectSimilarity * 0.48;
    basis.push(`text_similarity:${objectSimilarity.toFixed(3)}`);
  }
  if (left.source.kind === right.source.kind) score -= 0.08;
  return { score: Math.max(0, score), basis: [...new Set(basis)].sort() };
}

function determineRelation(left: IntentRecord, right: IntentRecord, evidence: PairEvidence): { from: IntentRecord; to: IntentRecord; type: RelationType } {
  const textScore = Math.max(similarity(left.statement.object, right.statement.object), similarity(left.statement.text, right.statement.text));
  if (left.statement.polarity !== right.statement.polarity && textScore >= 0.45) {
    return { from: left, to: right, type: 'contradicts' };
  }
  if (left.source.kind === right.source.kind && textScore >= 0.82) {
    return { from: left, to: right, type: 'duplicates' };
  }

  const pair = `${left.source.kind}:${right.source.kind}`;
  if (pair === 'git:todo' || pair === 'git:nl' || pair === 'git:document') return { from: left, to: right, type: 'implements' };
  if (pair === 'todo:git' || pair === 'nl:git' || pair === 'document:git') return { from: right, to: left, type: 'implements' };
  if (left.source.kind === 'ast' && right.source.kind !== 'ast') return { from: right, to: left, type: 'evidenced_by' };
  if (right.source.kind === 'ast' && left.source.kind !== 'ast') return { from: left, to: right, type: 'evidenced_by' };
  if (left.source.kind === 'changelog' && ['git', 'ast'].includes(right.source.kind)) return { from: left, to: right, type: 'releases' };
  if (right.source.kind === 'changelog' && ['git', 'ast'].includes(left.source.kind)) return { from: right, to: left, type: 'releases' };
  if (left.source.kind === 'todo' && ['nl', 'document'].includes(right.source.kind)) return { from: left, to: right, type: 'plans' };
  if (right.source.kind === 'todo' && ['nl', 'document'].includes(left.source.kind)) return { from: right, to: left, type: 'plans' };
  if (left.source.kind === 'document' && right.source.kind === 'nl') return { from: left, to: right, type: 'documents' };
  if (right.source.kind === 'document' && left.source.kind === 'nl') return { from: right, to: left, type: 'documents' };
  if (evidence.score >= 0.8) return { from: left, to: right, type: 'same_as' };
  return { from: left, to: right, type: 'related_to' };
}

function intersects(left: string[], right: string[]): boolean {
  const set = new Set(left);
  return right.some((value) => set.has(value));
}

function intersectsNormalized(left: string[], right: string[]): boolean {
  const set = new Set(left.map((value) => value.toLowerCase()));
  return right.some((value) => set.has(value.toLowerCase()));
}

function countBy(records: IntentRecord[], selector: (record: IntentRecord) => string): Record<string, number> {
  const output: Record<string, number> = {};
  for (const record of records) {
    const key = selector(record);
    output[key] = (output[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}
