import type { IntentRecord, RelationType, SourceKind } from '../core/types.js';
import type { PairEvidence } from './linker-scoring.js';

export interface DirectedRelation {
  from: IntentRecord;
  to: IntentRecord;
  type: RelationType;
}

interface SourceRelationRule {
  anchor: SourceKind;
  others: ReadonlySet<SourceKind>;
  type: RelationType;
  anchorPosition: 'from' | 'to';
}

const SOURCE_RELATION_RULES: SourceRelationRule[] = [
  { anchor: 'git', others: new Set(['todo', 'nl', 'document']), type: 'implements', anchorPosition: 'from' },
  {
    anchor: 'ast',
    others: new Set<SourceKind>(['nl', 'git', 'todo', 'changelog', 'document', 'agent_log', 'test', 'system']),
    type: 'evidenced_by',
    anchorPosition: 'to',
  },
  { anchor: 'changelog', others: new Set(['git', 'ast']), type: 'releases', anchorPosition: 'from' },
  { anchor: 'todo', others: new Set(['nl', 'document']), type: 'plans', anchorPosition: 'from' },
  { anchor: 'document', others: new Set(['nl']), type: 'documents', anchorPosition: 'from' },
];

function matchSourceRule(
  left: IntentRecord,
  right: IntentRecord,
  rule: SourceRelationRule,
): DirectedRelation | null {
  if (left.source.kind === rule.anchor && rule.others.has(right.source.kind)) {
    return orientRelation(left, right, rule);
  }
  if (right.source.kind === rule.anchor && rule.others.has(left.source.kind)) {
    return orientRelation(right, left, rule);
  }
  return null;
}

function orientRelation(
  anchor: IntentRecord,
  other: IntentRecord,
  rule: SourceRelationRule,
): DirectedRelation {
  return rule.anchorPosition === 'from'
    ? { from: anchor, to: other, type: rule.type }
    : { from: other, to: anchor, type: rule.type };
}

function relationForSourceKinds(left: IntentRecord, right: IntentRecord): DirectedRelation | null {
  for (const rule of SOURCE_RELATION_RULES) {
    const relation = matchSourceRule(left, right, rule);
    if (relation) return relation;
  }
  return null;
}

export function determineRelation(left: IntentRecord, right: IntentRecord, evidence: PairEvidence): DirectedRelation {
  const textScore = evidence.textScore;
  if (left.statement.polarity !== right.statement.polarity && textScore >= 0.45) {
    return { from: left, to: right, type: 'contradicts' };
  }
  if (left.source.kind === right.source.kind && textScore >= 0.82) {
    return { from: left, to: right, type: 'duplicates' };
  }
  const sourceRelation = relationForSourceKinds(left, right);
  if (sourceRelation) return sourceRelation;
  if (evidence.score >= 0.8) return { from: left, to: right, type: 'same_as' };
  return { from: left, to: right, type: 'related_to' };
}
