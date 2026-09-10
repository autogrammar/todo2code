import type { IntentRecord, MergeConflictFact } from '../../../src/core/types.js';

// Compile-only consumers: the public view remains assignable to IntentRecord,
// but generic facts and authority claims cannot masquerade as marker evidence.
export function contract(fact: MergeConflictFact, generic: IntentRecord): IntentRecord {
  const observed: 'observed' = fact.statement.modality;
  const notVerified: false = fact.metadata.gitIndexVerified;
  const source: string = fact.source.path;
  void [observed, notVerified, source];
  // @ts-expect-error a generic record has no conflict-fact guarantees
  const missingContract: MergeConflictFact = generic;
  // @ts-expect-error syntactic observations do not verify the Git index
  const verified: MergeConflictFact['metadata'] = { ...fact.metadata, gitIndexVerified: true };
  // @ts-expect-error marker evidence cannot authorize a merge
  const approval: MergeConflictFact['statement'] = { ...fact.statement, action: 'approve' };
  // @ts-expect-error the source must identify a file
  const missingSource: MergeConflictFact['source'] = { ...fact.source, path: null };
  void [missingContract, verified, approval, missingSource];
  return fact;
}
