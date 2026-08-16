import { createCodeChangePlanHash, createCodeChangePlanId } from './id.js';
import type { CodeChangePlan } from './types.js';
import {
  CODE_CHANGE_ACTIONS,
  CODE_CHANGE_PLAN_ID,
  CODE_CHANGE_RISK_LEVELS,
  CONCLUSION_ID,
  DIAGNOSTIC_ID,
  RECORD_ID,
  TODO_PRIORITIES,
  TODO_PROPOSAL_ID,
  confidence,
  dateString,
  enumValue,
  exactKeys,
  fingerprint,
  knownReferences,
  nonBlankString,
  nonEmptyUniqueIdArray,
  nonEmptyUniqueStringArray,
  objectValue,
  repositoryPath,
  stringArray,
  uniqueIdArray,
} from './schema-primitives.js';
import { assertGroundedGenerationMetadata } from './schema-generation-validation.js';

export function assertCodeChangePlanValue(
  value: unknown,
  known: {
    recordIds: Set<string>;
    diagnosticIds: Set<string>;
    conclusionIds: Set<string>;
    proposalIds: Set<string>;
  },
): asserts value is CodeChangePlan {
  const plan = objectValue(value, 'Code change plan');
  exactKeys(plan, [
    'schemaVersion', 'id', 'planHash', 'status', 'createdAt', 'title', 'description', 'priority',
    'target', 'acceptanceCriteria', 'changes', 'risk', 'rollback', 'evidence', 'confidence', 'generation',
  ], 'Code change plan');
  if (plan.schemaVersion !== 't2c.code-change-plan/v1') {
    throw new Error('Unsupported code change plan schemaVersion');
  }
  if (typeof plan.id !== 'string' || !CODE_CHANGE_PLAN_ID.test(plan.id)) {
    throw new Error('Code change plan id must match CPLAN-<20 hex>');
  }
  fingerprint(plan.planHash, `Code change plan ${plan.id}: planHash`);
  if (plan.status !== 'proposed') throw new Error(`Code change plan ${plan.id}: status must be proposed`);
  dateString(plan.createdAt, `Code change plan ${plan.id}: createdAt`);
  nonBlankString(plan.title, `Code change plan ${plan.id}: title`);
  nonBlankString(plan.description, `Code change plan ${plan.id}: description`);
  enumValue(plan.priority, TODO_PRIORITIES, `Code change plan ${plan.id}: priority`);
  const target = objectValue(plan.target, `Code change plan ${plan.id}: target`);
  exactKeys(target, ['paths', 'symbols', 'tickets', 'versions'], `Code change plan ${plan.id}: target`);
  for (const key of ['paths', 'symbols', 'tickets', 'versions'] as const) {
    stringArray(target[key], `Code change plan ${plan.id}: target.${key}`, true);
    if ((target[key] as string[]).some((item) => !item.trim())) {
      throw new Error(`Code change plan ${plan.id}: target.${key} cannot contain blank values`);
    }
  }
  const targetPaths = new Set((target.paths as string[]).map((item, index) => (
    repositoryPath(item, `Code change plan ${plan.id}: target.paths[${index}]`)
  )));
  nonEmptyUniqueStringArray(plan.acceptanceCriteria, `Code change plan ${plan.id}: acceptanceCriteria`);
  if (!Array.isArray(plan.changes) || plan.changes.length === 0) {
    throw new Error(`Code change plan ${plan.id}: changes must be a non-empty array`);
  }
  const changePaths = new Set<string>();
  for (const [index, rawChange] of plan.changes.entries()) {
    const change = objectValue(rawChange, `Code change plan ${plan.id}: changes[${index}]`);
    exactKeys(change, ['path', 'action', 'symbols', 'rationale'], `Code change plan ${plan.id}: changes[${index}]`);
    nonBlankString(change.path, `Code change plan ${plan.id}: changes[${index}].path`);
    const normalizedPath = repositoryPath(change.path, `Code change plan ${plan.id}: changes[${index}].path`);
    if (!targetPaths.has(normalizedPath)) {
      throw new Error(`Code change plan ${plan.id}: changes[${index}].path is not present in target.paths`);
    }
    enumValue(change.action, CODE_CHANGE_ACTIONS, `Code change plan ${plan.id}: changes[${index}].action`);
    stringArray(change.symbols, `Code change plan ${plan.id}: changes[${index}].symbols`, true);
    if ((change.symbols as string[]).some((item) => !item.trim())) {
      throw new Error(`Code change plan ${plan.id}: changes[${index}].symbols cannot contain blank values`);
    }
    nonBlankString(change.rationale, `Code change plan ${plan.id}: changes[${index}].rationale`);
    if (changePaths.has(normalizedPath)) {
      throw new Error(`Code change plan ${plan.id}: duplicate change for ${normalizedPath}`);
    }
    changePaths.add(normalizedPath);
  }
  const risk = objectValue(plan.risk, `Code change plan ${plan.id}: risk`);
  exactKeys(risk, ['level', 'reasons'], `Code change plan ${plan.id}: risk`);
  enumValue(risk.level, CODE_CHANGE_RISK_LEVELS, `Code change plan ${plan.id}: risk.level`);
  nonEmptyUniqueStringArray(risk.reasons, `Code change plan ${plan.id}: risk.reasons`);
  nonBlankString(plan.rollback, `Code change plan ${plan.id}: rollback`);
  const evidence = objectValue(plan.evidence, `Code change plan ${plan.id}: evidence`);
  exactKeys(evidence, [
    'graphFingerprint', 'recordIds', 'diagnosticIds', 'conclusionIds', 'proposalIds',
  ], `Code change plan ${plan.id}: evidence`);
  fingerprint(evidence.graphFingerprint, `Code change plan ${plan.id}: evidence.graphFingerprint`);
  nonEmptyUniqueIdArray(evidence.recordIds, RECORD_ID, `Code change plan ${plan.id}: evidence.recordIds`);
  nonEmptyUniqueIdArray(evidence.diagnosticIds, DIAGNOSTIC_ID, `Code change plan ${plan.id}: evidence.diagnosticIds`);
  uniqueIdArray(evidence.conclusionIds, CONCLUSION_ID, `Code change plan ${plan.id}: evidence.conclusionIds`);
  uniqueIdArray(evidence.proposalIds, TODO_PROPOSAL_ID, `Code change plan ${plan.id}: evidence.proposalIds`);
  knownReferences(evidence.recordIds as string[], known.recordIds, `Code change plan ${plan.id}: evidence.recordIds`);
  knownReferences(evidence.diagnosticIds as string[], known.diagnosticIds, `Code change plan ${plan.id}: evidence.diagnosticIds`);
  knownReferences(evidence.conclusionIds as string[], known.conclusionIds, `Code change plan ${plan.id}: evidence.conclusionIds`);
  knownReferences(evidence.proposalIds as string[], known.proposalIds, `Code change plan ${plan.id}: evidence.proposalIds`);
  confidence(plan.confidence, `Code change plan ${plan.id}: confidence`);
  assertGroundedGenerationMetadata(plan.generation, `Code change plan ${plan.id}: generation`);

  const semantic = plan as unknown as CodeChangePlan;
  const expectedHash = createCodeChangePlanHash(semantic);
  if (plan.planHash !== expectedHash) {
    throw new Error(`Code change plan planHash does not match semantic content: expected ${expectedHash}`);
  }
  const expectedId = createCodeChangePlanId(semantic);
  if (plan.id !== expectedId) {
    throw new Error(`Code change plan id does not match semantic content: expected ${expectedId}`);
  }
}

