import type { ConclusionKind, DiagnosticSeverity, TodoPriority } from '../core/types.js';
import { structuredSchema as s, type StructuredSchema } from '../llm/structured-schema.js';

export interface RawConclusion {
  key: string;
  kind: ConclusionKind;
  title: string;
  detail: string;
  severity: DiagnosticSeverity;
  diagnosticIds: string[];
  recordIds: string[];
  confidence: number;
}

export interface RawProposal {
  key: string;
  title: string;
  description: string;
  priority: TodoPriority;
  target: { paths: string[]; symbols: string[]; tickets: string[]; versions: string[] };
  acceptanceCriteria: string[];
  dependencyKeys: string[];
  conclusionKeys: string[];
  diagnosticIds: string[];
  recordIds: string[];
  confidence: number;
}

export interface RawTaskSynthesisResponse {
  conclusions: RawConclusion[];
  proposals: RawProposal[];
}

const taskStrings = (minimum = 0) => s.array(s.string(), { minItems: minimum, uniqueItems: true });
const taskIds = (pattern: string) => s.array(s.string({ pattern }), { minItems: 1, uniqueItems: true });
const nonBlank = () => s.string({ minLength: 1, pattern: '.*\\S.*' });

const RAW_CONCLUSION_CONTRACT = s.object({
  key: nonBlank(),
  kind: s.enum(['finding', 'risk', 'decision', 'recommendation']),
  title: nonBlank(),
  detail: nonBlank(),
  severity: s.enum(['info', 'warning', 'review_required', 'blocking']),
  diagnosticIds: taskIds('^DIAG-[a-f0-9]{20}$'),
  recordIds: taskIds('^INT-[A-Z]+-[a-f0-9]{20}$'),
  confidence: s.number({ minimum: 0, maximum: 1 }),
}) satisfies StructuredSchema<RawConclusion>;

const RAW_PROPOSAL_CONTRACT = s.object({
  key: nonBlank(),
  title: nonBlank(),
  description: nonBlank(),
  priority: s.enum(['P0', 'P1', 'P2', 'P3']),
  target: s.object({ paths: taskStrings(), symbols: taskStrings(), tickets: taskStrings(), versions: taskStrings() }),
  acceptanceCriteria: taskStrings(1),
  dependencyKeys: taskStrings(),
  conclusionKeys: taskStrings(1),
  diagnosticIds: taskIds('^DIAG-[a-f0-9]{20}$'),
  recordIds: taskIds('^INT-[A-Z]+-[a-f0-9]{20}$'),
  confidence: s.number({ minimum: 0, maximum: 1 }),
}) satisfies StructuredSchema<RawProposal>;

export const TASK_SYNTHESIS_RESPONSE_CONTRACT = s.object({
  conclusions: s.array(RAW_CONCLUSION_CONTRACT, { maxItems: 100 }),
  proposals: s.array(RAW_PROPOSAL_CONTRACT, { maxItems: 100 }),
}) satisfies StructuredSchema<RawTaskSynthesisResponse>;
