import { sha256 } from '../core/id.js';
import type { CodeChangePlan, CodeChangeReviewPatch, GroundedGenerationMetadata } from '../core/types.js';
import {
  assertCodeChangePlansForReview,
  assertGroundedGenerationMetadata,
} from '../core/schema.js';
import {
  deterministicGeneration,
  inline,
  priorityRank,
  renderIds,
} from './code-change-plan-helpers.js';
import type { CreateCodeChangeReviewOptions, CreatedCodeChangeReview } from './code-change-plan-types.js';

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
  if (typeof options.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(options.graphFingerprint)) {
    throw new Error('graphFingerprint must be a SHA-256 hex digest');
  }
  assertCodeChangePlansForReview(options.plans, options.graphFingerprint);
  const plans = [...options.plans].sort((left, right) =>
    priorityRank(left.priority) - priorityRank(right.priority) || left.id.localeCompare(right.id));
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('createdAt must be an ISO date-time');
  const markdown = renderCodeChangeReviewMarkdown(plans, options.graphFingerprint);
  const artifact: CodeChangeReviewPatch = {
    schemaVersion: 't2c.code-change-review/v1',
    createdAt,
    graphFingerprint: options.graphFingerprint,
    planIds: plans.map((plan) => plan.id),
    planHashes: plans.map((plan) => plan.planHash),
    renderedPatchHash: sha256(markdown),
    generation: deterministicGeneration(createdAt, 't2c/code-change-review'),
  };
  assertCodeChangeReviewPatch(artifact);
  return { markdown, artifact };
}

export function renderCodeChangeReviewMarkdown(
  plans: CodeChangePlan[],
  graphFingerprint: string,
): string {
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
    return lines.join('\n');
  }
  let currentPriority: CodeChangePlan['priority'] | null = null;
  for (const plan of plans) {
    if (plan.priority !== currentPriority) {
      if (currentPriority !== null) lines.push('');
      currentPriority = plan.priority;
      lines.push(`## ${plan.priority}`, '');
    }
    lines.push(`### ${inline(plan.title)} (\`${plan.id}\`)`, '');
    lines.push(`- Plan hash: \`${plan.planHash}\``);
    lines.push(`- Risk: **${plan.risk.level}** — ${plan.risk.reasons.map(inline).join('; ')}`);
    lines.push(`- Confidence: ${plan.confidence.toFixed(2)}`);
    lines.push(`- Description: ${inline(plan.description)}`);
    lines.push('- Changes:');
    for (const change of plan.changes) {
      const symbols = change.symbols.length ? ` symbols: ${change.symbols.map((item) => `\`${item}\``).join(', ')}` : '';
      lines.push(`  - \`${change.action}\` \`${change.path}\`${symbols}`);
      lines.push(`    - ${inline(change.rationale)}`);
    }
    lines.push('- Acceptance criteria:');
    for (const criterion of plan.acceptanceCriteria) lines.push(`  - [ ] ${inline(criterion)}`);
    lines.push(`- Diagnostics: ${renderIds(plan.evidence.diagnosticIds)}`);
    lines.push(`- Evidence records: ${renderIds(plan.evidence.recordIds)}`);
    if (plan.evidence.proposalIds.length) lines.push(`- TODO proposals: ${renderIds(plan.evidence.proposalIds)}`);
    if (plan.evidence.conclusionIds.length) lines.push(`- Conclusions: ${renderIds(plan.evidence.conclusionIds)}`);
    lines.push(`- Rollback: ${inline(plan.rollback)}`);
    lines.push('');
  }
  lines.push('## After implementation', '');
  lines.push('1. Re-run `t2c pipeline` (or extract + link + diagnose) on the changed tree.');
  lines.push('2. `t2c evaluate-code-change <plan.json> --before-graph … --after-graph … --out acceptance.json`.');
  lines.push('3. Require `accepted=true` and human/CI review before marking work DONE.');
  lines.push('');
  return lines.join('\n');
}

export function assertCodeChangeReviewPatch(value: unknown): asserts value is CodeChangeReviewPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Code change review patch must be an object');
  }
  const artifact = value as Record<string, unknown>;
  const required = [
    'schemaVersion', 'createdAt', 'graphFingerprint', 'planIds', 'planHashes',
    'renderedPatchHash', 'generation',
  ];
  for (const key of required) {
    if (!(key in artifact)) throw new Error(`Code change review patch is missing: ${key}`);
  }
  if (artifact.schemaVersion !== 't2c.code-change-review/v1') {
    throw new Error('Unsupported code change review schemaVersion');
  }
  if (typeof artifact.createdAt !== 'string' || Number.isNaN(Date.parse(artifact.createdAt))) {
    throw new Error('Code change review createdAt must be an ISO date-time');
  }
  if (typeof artifact.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.graphFingerprint)) {
    throw new Error('Code change review graphFingerprint must be SHA-256');
  }
  if (typeof artifact.renderedPatchHash !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.renderedPatchHash)) {
    throw new Error('Code change review renderedPatchHash must be SHA-256');
  }
  if (!Array.isArray(artifact.planIds) || !artifact.planIds.every((id) => typeof id === 'string' && /^CPLAN-[a-f0-9]{20}$/.test(id))) {
    throw new Error('Code change review planIds must be CPLAN ids');
  }
  if (!Array.isArray(artifact.planHashes) || !artifact.planHashes.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))) {
    throw new Error('Code change review planHashes must be SHA-256 digests');
  }
  if (artifact.planIds.length !== artifact.planHashes.length) {
    throw new Error('Code change review planIds and planHashes must have equal length');
  }
  if (new Set(artifact.planIds as string[]).size !== (artifact.planIds as string[]).length) {
    throw new Error('Code change review planIds must be unique');
  }
  assertGroundedGenerationMetadata(artifact.generation, 'Code change review generation');
  const generation = artifact.generation as GroundedGenerationMetadata;
  if (generation.generatedAt !== artifact.createdAt) {
    throw new Error('Code change review generation.generatedAt must match createdAt');
  }
  if (generation.generator !== 't2c/code-change-review') {
    throw new Error('Code change review generation.generator must be t2c/code-change-review');
  }
}
