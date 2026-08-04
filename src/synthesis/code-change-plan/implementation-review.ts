import { assertCodeChangePlansForReview, assertGroundedGenerationMetadata } from '../../core/schema.js';
import { sha256, stableStringify } from '../../core/id.js';
import type { CodeChangePlan, CodeChangeReviewPatch, GroundedGenerationMetadata, TodoPriority } from '../../core/types.js';
import { IMPLEMENTATION_DIAGNOSTIC_CODES } from './implementation-diagnostics.js';
import { T2C_VERSION } from '../../version.js';

export interface CreateCodeChangeReviewOptions {
  plans: CodeChangePlan[];
  graphFingerprint: string;
  createdAt?: string;
}

export interface CreatedCodeChangeReview {
  markdown: string;
  artifact: CodeChangeReviewPatch;
}

/**
 * Render a stable, reviewable Markdown brief for grounded code-change plans.
 *
 * This is not a source patch and is never applied to the tree. It exists so
 * humans and agents share one hash-bound artifact that lists exact paths,
 * acceptance criteria, evidence IDs, risk and rollback instructions.
 */
export function createCodeChangeReviewPatch(
  options: CreateCodeChangeReviewOptions,
): CreatedCodeChangeReview {
  const context = buildCodeChangeReviewContext(options);
  const markdown = buildCodeChangeReviewMarkdown(context);
  const artifact = buildCodeChangeReviewArtifact(context, markdown);
  assertCodeChangeReviewPatch(artifact);
  return { markdown, artifact };
}

interface CodeChangeReviewContext {
  plans: CodeChangePlan[];
  graphFingerprint: string;
  createdAt: string;
}

function buildCodeChangeReviewContext(options: CreateCodeChangeReviewOptions): CodeChangeReviewContext {
  if (typeof options.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(options.graphFingerprint)) {
    throw new Error('graphFingerprint must be a SHA-256 hex digest');
  }
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('createdAt must be an ISO date-time');
  assertCodeChangePlansForReview(options.plans, options.graphFingerprint);
  return {
    plans: sortCodeChangeReviewPlans(options.plans),
    graphFingerprint: options.graphFingerprint,
    createdAt,
  };
}

function sortCodeChangeReviewPlans(plans: CodeChangePlan[]): CodeChangePlan[] {
  return [...plans].sort((left, right) =>
    priorityRank(left.priority) - priorityRank(right.priority) || left.id.localeCompare(right.id));
}

function buildCodeChangeReviewMarkdown(context: CodeChangeReviewContext): string {
  return renderCodeChangeReviewMarkdown(context.plans, context.graphFingerprint);
}

function buildCodeChangeReviewArtifact(
  context: CodeChangeReviewContext,
  markdown: string,
): CodeChangeReviewPatch {
  return {
    schemaVersion: 't2c.code-change-review/v1',
    createdAt: context.createdAt,
    graphFingerprint: context.graphFingerprint,
    planIds: context.plans.map((plan) => plan.id),
    planHashes: context.plans.map((plan) => plan.planHash),
    renderedPatchHash: sha256(markdown),
    generation: deterministicGeneration(context.createdAt, 't2c/code-change-review'),
  };
}

export function renderCodeChangeReviewMarkdown(
  plans: CodeChangePlan[],
  graphFingerprint: string,
): string {
  const lines = buildCodeChangeReviewMarkdownLines(plans, graphFingerprint);
  return lines.join('\n');
}

function buildCodeChangeReviewMarkdownLines(
  plans: CodeChangePlan[],
  graphFingerprint: string,
): string[] {
  const lines = [
    '<!-- t2c.code-change-review/v1 -->',
    '# todo2code proposed code changes',
    '',
    'This document is a grounded **review brief**, not an auto-applied source patch.',
    'Implement the listed paths in a normal branch, re-run the pipeline, then',
    '`t2c evaluate-code-change`. Acceptance still requires human/CI approval before DONE.',
    '',
    `Graph fingerprint: \`${graphFingerprint}\``,
    '',
  ];
  if (!plans.length) {
    lines.push('_No grounded code-change plans. Open diagnostics either cleared or lack repository paths._', '');
    return lines;
  }
  let currentPriority: CodeChangePlan['priority'] | null = null;
  for (const plan of plans) {
    currentPriority = appendPriorityHeader(lines, currentPriority, plan);
    appendPlanDetails(lines, plan);
  }
  appendAfterImplementationSection(lines);
  return lines;
}

function appendPriorityHeader(
  lines: string[],
  currentPriority: CodeChangePlan['priority'] | null,
  plan: CodeChangePlan,
): CodeChangePlan['priority'] {
  if (plan.priority === currentPriority) return currentPriority;
  if (currentPriority !== null) lines.push('');
  lines.push(`## ${plan.priority}`, '');
  return plan.priority;
}

function appendPlanDetails(lines: string[], plan: CodeChangePlan): void {
  lines.push(`### ${inline(plan.title)} (\`${plan.id}\`)`, '');
  lines.push(`- Plan hash: \`${plan.planHash}\``);
  lines.push(`- Risk: **${plan.risk.level}** — ${plan.risk.reasons.map(inline).join('; ')}`);
  lines.push(`- Confidence: ${plan.confidence.toFixed(2)}`);
  lines.push(`- Description: ${inline(plan.description)}`);
  appendPlanChanges(lines, plan);
  lines.push('- Acceptance criteria:');
  for (const criterion of plan.acceptanceCriteria) lines.push(`  - [ ] ${inline(criterion)}`);
  lines.push(`- Diagnostics: ${renderIds(plan.evidence.diagnosticIds)}`);
  lines.push(`- Evidence records: ${renderIds(plan.evidence.recordIds)}`);
  if (plan.evidence.proposalIds.length) lines.push(`- TODO proposals: ${renderIds(plan.evidence.proposalIds)}`);
  if (plan.evidence.conclusionIds.length) lines.push(`- Conclusions: ${renderIds(plan.evidence.conclusionIds)}`);
  lines.push(`- Rollback: ${inline(plan.rollback)}`);
  lines.push('');
}

function appendPlanChanges(lines: string[], plan: CodeChangePlan): void {
  lines.push('- Changes:');
  for (const change of plan.changes) {
    const symbols = change.symbols.length ? ` symbols: ${change.symbols.map((item) => `\`${item}\``).join(', ')}` : '';
    lines.push(`  - \`${change.action}\` \`${change.path}\`${symbols}`);
    lines.push(`    - ${inline(change.rationale)}`);
  }
}

function appendAfterImplementationSection(lines: string[]): void {
  lines.push('## After implementation', '');
  lines.push('1. Re-run `t2c pipeline` (or extract + link + diagnose) on the changed tree.');
  lines.push('2. `t2c evaluate-code-change <plan.json> --before-graph … --after-graph … --out acceptance.json`.');
  lines.push('3. Require `accepted=true` and human/CI review before marking work DONE.');
  lines.push('');
}

export function assertCodeChangeReviewPatch(value: unknown): asserts value is CodeChangeReviewPatch {
  const artifact = assertReviewPatchObject(value, 'Code change review patch must be an object');
  validateReviewPatchKeys(artifact);
  assertCodeChangeReviewPatchSchema(artifact);
  assertCodeChangeReviewPatchPlanCollections(artifact);
  assertCodeChangeReviewPatchGeneration(artifact);
}

function validateReviewPatchKeys(artifact: Record<string, unknown>): void {
  const required = [
    'schemaVersion', 'createdAt', 'graphFingerprint', 'planIds', 'planHashes',
    'renderedPatchHash', 'generation',
  ];
  for (const key of required) {
    if (!(key in artifact)) throw new Error(`Code change review patch is missing: ${key}`);
  }
}

function assertCodeChangeReviewPatchSchema(artifact: Record<string, unknown>): void {
  assertReviewPatchSchemaVersion(artifact);
  assertReviewPatchDateFields(artifact);
  assertReviewPatchIds(artifact);
}

function assertReviewPatchSchemaVersion(artifact: Record<string, unknown>): void {
  if (artifact.schemaVersion !== 't2c.code-change-review/v1') {
    throw new Error('Unsupported code change review schemaVersion');
  }
}

function assertReviewPatchDateFields(artifact: Record<string, unknown>): void {
  if (typeof artifact.createdAt !== 'string' || Number.isNaN(Date.parse(artifact.createdAt))) {
    throw new Error('Code change review createdAt must be an ISO date-time');
  }
  if (typeof artifact.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.graphFingerprint)) {
    throw new Error('Code change review graphFingerprint must be SHA-256');
  }
  if (typeof artifact.renderedPatchHash !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.renderedPatchHash)) {
    throw new Error('Code change review renderedPatchHash must be SHA-256');
  }
}

function assertReviewPatchIds(artifact: Record<string, unknown>): void {
  if (!Array.isArray(artifact.planIds) || !artifact.planIds.every((id) => typeof id === 'string' && /^CPLAN-[a-f0-9]{20}$/.test(id))) {
    throw new Error('Code change review planIds must be CPLAN ids');
  }
  if (!Array.isArray(artifact.planHashes) || !artifact.planHashes.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))) {
    throw new Error('Code change review planHashes must be SHA-256 digests');
  }
}

function assertCodeChangeReviewPatchPlanCollections(artifact: Record<string, unknown>): void {
  if (artifact.planIds.length !== artifact.planHashes.length) {
    throw new Error('Code change review planIds and planHashes must have equal length');
  }
  if (new Set(artifact.planIds as string[]).size !== (artifact.planIds as string[]).length) {
    throw new Error('Code change review planIds must be unique');
  }
}

function assertCodeChangeReviewPatchGeneration(artifact: Record<string, unknown>): void {
  assertGroundedGenerationMetadata(artifact.generation, 'Code change review generation');
  const generation = artifact.generation as GroundedGenerationMetadata;
  if (generation.generatedAt !== artifact.createdAt) {
    throw new Error('Code change review generation.generatedAt must match createdAt');
  }
  if (generation.generator !== 't2c/code-change-review') {
    throw new Error('Code change review generation.generator must be t2c/code-change-review');
  }
}

function deterministicGeneration(generatedAt: string, generator: string): GroundedGenerationMetadata {
  return {
    generator,
    generatorVersion: '1',
    runtimeVersion: T2C_VERSION,
    generatedAt,
    requestedMode: 'deterministic',
    effectiveMode: 'deterministic',
    degraded: false,
    model: null,
    provider: null,
    responseId: null,
    configurationFingerprint: sha256(stableStringify({
      generator,
      generatorVersion: '1',
      codes: [...IMPLEMENTATION_DIAGNOSTIC_CODES].sort(),
    })),
    reason: null,
  };
}

function priorityRank(priority: TodoPriority): number {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 } as const)[priority];
}

function inline(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderIds(ids: string[]): string {
  return ids.length ? ids.map((id) => `\`${id}\``).join(', ') : '_none_';
}

function assertReviewPatchObject(value: unknown, objectLabel: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(objectLabel);
  }
  return value as Record<string, unknown>;
}
