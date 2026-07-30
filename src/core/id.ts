import { createHash, randomUUID } from 'node:crypto';
import type {
  CodeChangePlan,
  Conclusion,
  IntentRecord,
  IntentRelation,
  JsonValue,
  TodoProposal,
} from './types.js';

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      output[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return output;
  }
  return value;
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function shortHash(value: string | Buffer, length = 16): string {
  return sha256(value).slice(0, length);
}

export function createIntentId(seed: unknown, prefix = 'INT'): string {
  return `${prefix}-${shortHash(stableStringify(seed), 20)}`;
}

export function createRelationId(relation: Omit<IntentRelation, 'id'>): string {
  return `REL-${shortHash(stableStringify(relation), 20)}`;
}

export function createConclusionId(value: Pick<
Conclusion,
'kind' | 'title' | 'detail' | 'severity' | 'diagnosticIds' | 'recordIds'
>): string {
  return `CONC-${shortHash(stableStringify({
    kind: value.kind,
    title: value.title.trim(),
    detail: value.detail.trim(),
    severity: value.severity,
    diagnosticIds: [...new Set(value.diagnosticIds)].sort(),
    recordIds: [...new Set(value.recordIds)].sort(),
  }), 20)}`;
}

export function createTodoProposalId(value: Pick<
TodoProposal,
'title' | 'description' | 'target' | 'acceptanceCriteria'
>): string {
  return `TPROP-${shortHash(stableStringify({
    title: value.title.trim(),
    description: value.description.trim(),
    target: {
      paths: [...new Set(value.target.paths)].sort(),
      symbols: [...new Set(value.target.symbols)].sort(),
      tickets: [...new Set(value.target.tickets)].sort(),
      versions: [...new Set(value.target.versions)].sort(),
    },
    acceptanceCriteria: [...new Set(value.acceptanceCriteria.map((item) => item.trim()))].sort(),
  }), 20)}`;
}

export function createCodeChangePlanHash(value: Pick<
  CodeChangePlan,
  'title' | 'description' | 'priority' | 'target' | 'acceptanceCriteria' | 'changes' | 'risk' | 'rollback' | 'evidence'
>): string {
  return sha256(stableStringify({
    title: value.title.trim(),
    description: value.description.trim(),
    priority: value.priority,
    target: {
      paths: [...new Set(value.target.paths)].sort(),
      symbols: [...new Set(value.target.symbols)].sort(),
      tickets: [...new Set(value.target.tickets)].sort(),
      versions: [...new Set(value.target.versions)].sort(),
    },
    acceptanceCriteria: [...new Set(value.acceptanceCriteria.map((item) => item.trim()))].sort(),
    changes: [...value.changes]
      .map((change) => ({
        path: change.path.trim().replace(/\\/g, '/'),
        action: change.action,
        symbols: [...new Set(change.symbols.map((item) => item.trim()).filter(Boolean))].sort(),
        rationale: change.rationale.trim(),
      }))
      .sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action)),
    risk: {
      level: value.risk.level,
      reasons: [...new Set(value.risk.reasons.map((item) => item.trim()).filter(Boolean))].sort(),
    },
    rollback: value.rollback.trim(),
    evidence: {
      graphFingerprint: value.evidence.graphFingerprint,
      recordIds: [...new Set(value.evidence.recordIds)].sort(),
      diagnosticIds: [...new Set(value.evidence.diagnosticIds)].sort(),
      conclusionIds: [...new Set(value.evidence.conclusionIds)].sort(),
      proposalIds: [...new Set(value.evidence.proposalIds)].sort(),
    },
  }));
}

export function createCodeChangePlanId(value: Pick<
  CodeChangePlan,
  'title' | 'description' | 'priority' | 'target' | 'acceptanceCriteria' | 'changes' | 'risk' | 'rollback' | 'evidence'
>): string {
  return `CPLAN-${createCodeChangePlanHash(value).slice(0, 20)}`;
}

export function graphFingerprint(records: IntentRecord[], relations: IntentRelation[]): string {
  const payload = {
    records: records.map((record) => ({ ...record, observedAt: null })).sort((a, b) => a.id.localeCompare(b.id)),
    relations: [...relations].sort((a, b) => a.id.localeCompare(b.id)),
  };
  return sha256(stableStringify(payload));
}

export function newRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${stamp}-${randomUUID().slice(0, 8)}`;
}

export function asJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
