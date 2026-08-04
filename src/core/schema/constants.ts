export const ACTIONS = new Set([
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
]);
export const MODALITIES = new Set(['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown']);
export const POLARITIES = new Set(['positive', 'negative']);
export const LIFECYCLES = new Set([
  'proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown',
]);
export const SOURCE_KINDS = new Set(['nl', 'git', 'ast', 'todo', 'changelog', 'document', 'agent_log', 'test', 'system']);
export const EPISTEMIC_CLASSES = new Set(['declaration', 'plan', 'claim', 'fact', 'inference', 'llm_inference']);
export const RELATION_TYPES = new Set([
  'declares', 'plans', 'implements', 'modifies', 'tests', 'documents', 'releases', 'depends_on',
  'blocks', 'supersedes', 'contradicts', 'duplicates', 'evidenced_by', 'claimed_by', 'same_as', 'related_to',
]);
export const CONCLUSION_KINDS = new Set(['finding', 'risk', 'decision', 'recommendation']);
export const DIAGNOSTIC_SEVERITIES = new Set(['info', 'warning', 'review_required', 'blocking']);
export const TODO_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
export const GENERATION_REQUESTED_MODES = new Set(['deterministic', 'prefer-llm', 'require-llm']);
export const GENERATION_EFFECTIVE_MODES = new Set(['deterministic', 'llm']);
export const RECORD_ID = /^INT-[A-Z]+-[a-f0-9]{20}$/;
export const RELATION_ID = /^REL-[a-f0-9]{20}$/;
export const DIAGNOSTIC_ID = /^DIAG-[a-f0-9]{20}$/;
export const CONCLUSION_ID = /^CONC-[a-f0-9]{20}$/;
export const TODO_PROPOSAL_ID = /^TPROP-[a-f0-9]{20}$/;
export const CODE_CHANGE_PLAN_ID = /^CPLAN-[a-f0-9]{20}$/;
export const CODE_CHANGE_ACTIONS = new Set(['create', 'modify', 'delete']);
export const CODE_CHANGE_RISK_LEVELS = new Set(['low', 'medium', 'high']);
export const FINGERPRINT = /^[a-f0-9]{64}$/;
export const RUNTIME_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
