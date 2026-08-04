import { assertCodeChangePlansForReview, assertGroundedGenerationMetadata } from '../../core/schema.js';
import {
  createCodeChangeSourcePatchHash,
  createCodeChangeSourcePatchId,
} from '../../core/id.js';
import type {
  CodeChangeFileAction,
  CodeChangePlan,
  CodeChangeSourceEdit,
  CodeChangeSourcePatch,
  CodeChangeSourcePatchSet,
} from '../../core/types.js';
import { normalizeUnifiedDiff } from './implementation-source-patch-diff.js';

export function assertCodeChangeSourcePatch(
  value: unknown,
  plan?: CodeChangePlan,
): asserts value is CodeChangeSourcePatch {
  const patch = assertCodeChangeSourcePatchObject(value, plan);
  validateSourcePatchSchema(patch);
  validateSourcePatchIdentifiers(patch);
  const editPaths = validateSourcePatchEdits(patch);
  validateSourcePatchHashAndId(patch);
  validateSourcePatchGeneration(patch);
  if (plan) {
    validateSourcePatchAgainstPlan(patch, plan, editPaths);
  }
}

function assertCodeChangeSourcePatchObject(value: unknown, plan?: CodeChangePlan): CodeChangeSourcePatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Code change source patch must be an object');
  }
  const patch = value as CodeChangeSourcePatch;
  exactSourcePatchKeys(patch as unknown as Record<string, unknown>, [
    'schemaVersion', 'id', 'patchHash', 'status', 'createdAt', 'planId', 'planHash',
    'graphFingerprint', 'diagnosticIds', 'recordIds', 'edits', 'acceptanceCriteria', 'generation',
  ], 'Source patch');
  if (plan !== undefined && typeof patch.planId === 'string' && patch.id) {
    if (patch.planId !== plan.id) {
      throw new Error('Source patch is not bound to the supplied plan');
    }
  }
  return patch;
}

function validateSourcePatchSchema(patch: CodeChangeSourcePatch): void {
  if (patch.schemaVersion !== 't2c.code-change-source-patch/v1') {
    throw new Error('Unsupported code change source patch schemaVersion');
  }
  if (typeof patch.createdAt !== 'string' || Number.isNaN(Date.parse(patch.createdAt))) {
    throw new Error('Source patch createdAt must be an ISO date-time');
  }
  if (patch.status !== 'proposed') throw new Error('Source patch status must be proposed');
  if (!Array.isArray(patch.edits) || patch.edits.length === 0) {
    throw new Error('Source patch edits must be a non-empty array');
  }
}

function validateSourcePatchIdentifiers(patch: CodeChangeSourcePatch): void {
  if (typeof patch.id !== 'string' || !/^SPATCH-[a-f0-9]{20}$/.test(patch.id)) {
    throw new Error('Source patch id must match SPATCH-<20 hex>');
  }
  if (typeof patch.patchHash !== 'string' || !/^[a-f0-9]{64}$/.test(patch.patchHash)) {
    throw new Error('Source patch patchHash must be SHA-256');
  }
  if (typeof patch.planId !== 'string' || !/^CPLAN-[a-f0-9]{20}$/.test(patch.planId)) {
    throw new Error('Source patch planId must match CPLAN-<20 hex>');
  }
  if (typeof patch.planHash !== 'string' || !/^[a-f0-9]{64}$/.test(patch.planHash)) {
    throw new Error('Source patch planHash must be SHA-256');
  }
  if (typeof patch.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(patch.graphFingerprint)) {
    throw new Error('Source patch graphFingerprint must be SHA-256');
  }
  assertSourcePatchIds(patch.diagnosticIds, /^DIAG-[a-f0-9]{20}$/, 'diagnosticIds');
  assertSourcePatchIds(patch.recordIds, /^INT-[A-Z]+-[a-f0-9]{20}$/, 'recordIds');
  assertSourcePatchStrings(patch.acceptanceCriteria, 'acceptanceCriteria', false);
}

function validateSourcePatchEdits(patch: CodeChangeSourcePatch): Set<string> {
  return collectSourcePatchEditPathActions(patch.edits);
}

function collectSourcePatchEditPathActions(edits: CodeChangeSourceEdit[]): Set<string> {
  const paths = new Set<string>();
  for (const edit of edits) {
    const editContext = validateSourcePatchEdit(edit, paths);
    paths.add(editContext.pathActionKey);
  }
  return paths;
}

interface SourcePatchEditValidationContext {
  pathActionKey: string;
}

function validateSourcePatchEdit(
  edit: CodeChangeSourceEdit,
  seen: Set<string>,
): SourcePatchEditValidationContext {
  const normalizedEdit = assertSourcePatchEditObject(edit);
  const normalizedPath = normalizeSourcePatchEditPath(normalizedEdit.path);
  validateSourcePatchEditBody(normalizedEdit, normalizedPath);
  validateSourcePatchEditDiff(normalizedEdit.unifiedDiff, normalizedPath);
  assertUniqueSourcePatchEditPathAction(seen, normalizedPath, normalizedEdit.action);
  const pathActionKey = `${normalizedPath}::${normalizedEdit.action}`;
  return { pathActionKey };
}

function assertSourcePatchEditObject(edit: CodeChangeSourceEdit | unknown): {
  path: unknown;
  action: unknown;
  symbols: unknown;
  instruction: unknown;
  unifiedDiff: string | null;
} {
  if (!edit || typeof edit !== 'object') throw new Error('Source patch edit must be an object');
  exactSourcePatchKeys(edit as unknown as Record<string, unknown>, [
    'path', 'action', 'symbols', 'instruction', 'unifiedDiff',
  ], 'Source patch edit');
  return edit as {
    path: unknown;
    action: unknown;
    symbols: unknown;
    instruction: unknown;
    unifiedDiff: string | null;
  };
}

function validateSourcePatchEditBody(
  edit: {
    path: unknown;
    action: unknown;
    symbols: unknown;
    instruction: unknown;
    unifiedDiff: string | null;
  },
  normalizedPath: string,
): void {
  ensureSourcePatchEditAction(edit.action);
  ensureSourcePatchEditInstruction(edit.instruction);
  assertSourcePatchStrings(edit.symbols, `edits[${normalizedPath}].symbols`, true);
}

function validateSourcePatchEditDiff(unifiedDiff: string | null, normalizedPath: string): void {
  if (unifiedDiff === null) return;
  if (typeof unifiedDiff !== 'string') {
    throw new Error(`Source patch unifiedDiff for ${normalizedPath} must be string or null`);
  }
  normalizeUnifiedDiff(unifiedDiff, normalizedPath);
}

function assertUniqueSourcePatchEditPathAction(
  seen: Set<string>,
  normalizedPath: string,
  action: unknown,
): void {
  const pathActionKey = `${normalizedPath}::${action}`;
  if (seen.has(pathActionKey)) throw new Error(`Duplicate source patch edit for ${normalizedPath}`);
}

function normalizeSourcePatchEditPath(pathValue: unknown): string {
  const normalizedPath = (typeof pathValue === 'string' ? pathValue.trim() : '').replace(/\\/g, '/');
  if (!normalizedPath || normalizedPath.startsWith('/') || normalizedPath.split('/').includes('..')) {
    throw new Error(`Source patch edit path is not a relative repository path: ${normalizedPath}`);
  }
  return normalizedPath;
}

function ensureSourcePatchEditAction(action: unknown): void {
  if (!['create', 'modify', 'delete'].includes(action as string) || typeof action !== 'string') {
    throw new Error(`Source patch edit action is unsupported: ${String(action)}`);
  }
}

function ensureSourcePatchEditInstruction(instruction: unknown): void {
  if (typeof instruction !== 'string' || !instruction.trim()) {
    throw new Error('Source patch edit instruction must be non-blank');
  }
}

function validateSourcePatchHashAndId(patch: CodeChangeSourcePatch): void {
  const expectedHash = createCodeChangeSourcePatchHash(patch);
  if (patch.patchHash !== expectedHash) {
    throw new Error(`Source patch patchHash does not match semantic content: expected ${expectedHash}`);
  }
  if (patch.id !== createCodeChangeSourcePatchId(patch)) {
    throw new Error('Source patch id does not match semantic content');
  }
}

function validateSourcePatchGeneration(patch: CodeChangeSourcePatch): void {
  assertGroundedGenerationMetadata(patch.generation, 'Source patch generation');
  if (patch.generation.generatedAt !== patch.createdAt) {
    throw new Error('Source patch generation.generatedAt must match createdAt');
  }
  if (patch.generation.generator !== 't2c/code-change-source-patch') {
    throw new Error('Source patch generation.generator must be t2c/code-change-source-patch');
  }
}

function validateSourcePatchAgainstPlan(
  patch: CodeChangeSourcePatch,
  plan: CodeChangePlan,
  editPaths: Set<string>,
): void {
  assertSourcePatchPlanBinding(patch, plan);
  const expectedChanges = collectExpectedPlanChanges(plan);
  validateSourcePatchEditsAgainstPlan(patch, plan, expectedChanges);
  validateSourcePatchEvidence(patch, plan, expectedChanges, editPaths);
}

function assertSourcePatchPlanBinding(patch: CodeChangeSourcePatch, plan: CodeChangePlan): void {
  if (patch.planHash !== plan.planHash) throw new Error('Source patch is not bound to the supplied plan');
  if (patch.graphFingerprint !== plan.evidence.graphFingerprint) {
    throw new Error('Source patch graphFingerprint does not match the plan');
  }
}

function collectExpectedPlanChanges(plan: CodeChangePlan): Map<string, CodeChangeFileAction> {
  return new Map(plan.changes.map((item) => [
    item.path.replace(/\\/g, '/'), item.action,
  ]));
}

function validateSourcePatchEditsAgainstPlan(
  patch: CodeChangeSourcePatch,
  plan: CodeChangePlan,
  expectedChanges: Map<string, CodeChangeFileAction>,
): void {
  const allowed = new Set(plan.target.paths.map((item) => item.replace(/\\/g, '/')));
  for (const edit of patch.edits) {
    const editPath = edit.path.replace(/\\/g, '/');
    if (!allowed.has(editPath)) {
      throw new Error(`Source patch path ${edit.path} is outside plan target.paths`);
    }
    if (expectedChanges.get(editPath) !== edit.action) {
      throw new Error(`Source patch action for ${edit.path} does not match the plan`);
    }
  }
}

function validateSourcePatchEvidence(
  patch: CodeChangeSourcePatch,
  plan: CodeChangePlan,
  expectedChangePaths: Map<string, CodeChangeFileAction>,
  editPaths: Set<string>,
): void {
  const actualEditPaths = [...editPaths].map((item) => {
    const marker = item.indexOf('::');
    return marker === -1 ? item : item.slice(0, marker);
  });
  const expectedPaths = [...expectedChangePaths.keys()];
  exactSourcePatchSet(actualEditPaths, expectedPaths, 'edit paths');
  exactSourcePatchSet(patch.diagnosticIds, plan.evidence.diagnosticIds, 'diagnosticIds');
  exactSourcePatchSet(patch.recordIds, plan.evidence.recordIds, 'recordIds');
  exactSourcePatchSet(patch.acceptanceCriteria, plan.acceptanceCriteria, 'acceptanceCriteria');
}

export function assertCodeChangeSourcePatchSet(
  value: unknown,
  plans?: CodeChangePlan[],
): asserts value is CodeChangeSourcePatchSet {
  const set = assertSourcePatchSetObject(value);
  const context = createSourcePatchSetValidationContext(plans);
  validateSourcePatchSetSchema(set);
  validateSourcePatchSetPatches(set, context);
  validateSourcePatchSetGeneration(set);
}

interface SourcePatchSetValidationContext {
  plansById: Map<string, CodeChangePlan>;
  expectedPlanIds: string[] | null;
}

function createSourcePatchSetValidationContext(plans?: CodeChangePlan[]): SourcePatchSetValidationContext {
  const expectedPlanIds = plans?.map((plan) => plan.id) ?? null;
  return {
    plansById: new Map((plans ?? []).map((plan) => [plan.id, plan])),
    expectedPlanIds,
  };
}

function assertSourcePatchSetObject(value: unknown): CodeChangeSourcePatchSet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Code change source patch set must be an object');
  }
  const set = value as CodeChangeSourcePatchSet;
  exactSourcePatchKeys(set as unknown as Record<string, unknown>, [
    'schemaVersion', 'generatedAt', 'graphFingerprint', 'patches', 'generation',
  ], 'Source patch set');
  return set;
}

function validateSourcePatchSetSchema(set: CodeChangeSourcePatchSet): void {
  if (set.schemaVersion !== 't2c.code-change-source-patch-set/v1') {
    throw new Error('Unsupported code change source patch set schemaVersion');
  }
  if (typeof set.generatedAt !== 'string' || Number.isNaN(Date.parse(set.generatedAt))) {
    throw new Error('Source patch set generatedAt must be an ISO date-time');
  }
  if (typeof set.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(set.graphFingerprint)) {
    throw new Error('Source patch set graphFingerprint must be SHA-256');
  }
  if (!Array.isArray(set.patches)) throw new Error('Source patch set patches must be an array');
}

function validateSourcePatchSetPatches(
  set: CodeChangeSourcePatchSet,
  context: SourcePatchSetValidationContext,
): void {
  const patchIds = new Set<string>();
  for (const patch of set.patches) {
    validateSetPatchAndTrackDuplicates(set, patch, context, patchIds);
  }
  validateSetPatchesPlanCoverage(set, context.expectedPlanIds);
}

function validateSetPatchAndTrackDuplicates(
  set: CodeChangeSourcePatchSet,
  patch: CodeChangeSourcePatch,
  context: SourcePatchSetValidationContext,
  patchIds: Set<string>,
): void {
  const expectedPlan = context.plansById.get(patch.planId);
  assertCodeChangeSourcePatch(patch, expectedPlan);
  validateSetPatchGraphFingerprint(set, patch);
  assertUniqueSetPatchId(patchIds, patch.id);
  patchIds.add(patch.id);
}

function validateSetPatchGraphFingerprint(
  set: CodeChangeSourcePatchSet,
  patch: CodeChangeSourcePatch,
): void {
  if (patch.graphFingerprint !== set.graphFingerprint) {
    throw new Error(`Source patch ${patch.id} graphFingerprint does not match its set`);
  }
}

function assertUniqueSetPatchId(
  patchIds: Set<string>,
  patchId: string,
): void {
  if (patchIds.has(patchId)) throw new Error(`Duplicate source patch id: ${patchId}`);
}

function validateSetPatchesPlanCoverage(
  set: CodeChangeSourcePatchSet,
  expectedPlanIds: string[] | null,
): void {
  if (!expectedPlanIds) return;
  exactSourcePatchSet(set.patches.map((patch) => patch.planId), expectedPlanIds, 'planIds');
}

function validateSourcePatchSetGeneration(set: CodeChangeSourcePatchSet): void {
  assertGroundedGenerationMetadata(set.generation, 'Source patch set generation');
  if (set.generation.generatedAt !== set.generatedAt) {
    throw new Error('Source patch set generation.generatedAt must match generatedAt');
  }
  if (set.generation.generator !== 't2c/code-change-source-patch-set') {
    throw new Error('Source patch set generation.generator must be t2c/code-change-source-patch-set');
  }
}

function exactSourcePatchKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${name} keys must be exactly: ${wanted.join(', ')}`);
  }
}

function assertSourcePatchIds(value: unknown, pattern: RegExp, name: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0
    || value.some((item) => typeof item !== 'string' || !pattern.test(item))) {
    throw new Error(`Source patch ${name} must be a non-empty array of valid IDs`);
  }
  if (new Set(value).size !== value.length) throw new Error(`Source patch ${name} must be unique`);
}

function assertSourcePatchStrings(value: unknown, name: string, emptyAllowed: boolean): asserts value is string[] {
  if (!Array.isArray(value) || (!emptyAllowed && value.length === 0)
    || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`Source patch ${name} must contain ${emptyAllowed ? 'only ' : ''}non-blank strings`);
  }
  if (new Set(value).size !== value.length) throw new Error(`Source patch ${name} must be unique`);
}

function exactSourcePatchSet(actual: string[], expected: string[], name: string): void {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  if (left.length !== right.length || left.some((item, index) => item !== right[index])) {
    throw new Error(`Source patch ${name} do not match the plan`);
  }
}
