import { createHash } from 'node:crypto';

export const ANALYSIS_POLICY_SCHEMA = 't2c.analysis-policy/v1' as const;
export const ANALYSIS_POLICY_LLM_POLICY = 'REQUIRE_FOR_SELECTED_STAGES' as const;
export const ANALYSIS_POLICY_CACHE_MODE = 'EXACT_EVIDENCE' as const;

export const ANALYSIS_PURPOSES = [
  'documentation', 'intent', 'refactoring', 'security', 'tests',
] as const;
export type AnalysisPurpose = typeof ANALYSIS_PURPOSES[number];

export const ANALYSIS_TRIGGERS = [
  'documentation_drift', 'high_change_risk', 'intent_conflict',
  'public_contract_change', 'scope_ambiguity', 'security_sensitive', 'test_gap',
] as const;
export type AnalysisTrigger = typeof ANALYSIS_TRIGGERS[number];

export const ANALYSIS_CONTEXTS = [
  'changed_files', 'changed_symbols', 'dependency_graph', 'diagnostics',
  'documentation', 'intent_evidence', 'tests',
] as const;
export type AnalysisContext = typeof ANALYSIS_CONTEXTS[number];

export const ANALYSIS_SEVERITIES = ['info', 'warning', 'error'] as const;
export type AnalysisSeverity = typeof ANALYSIS_SEVERITIES[number];

export type AnalysisActivation = 'ALWAYS' | 'ON_TRIGGER';
export type AnalysisBudgetExhaustion = 'FAIL' | 'REPORT_INCOMPLETE';

export interface AnalysisBudget {
  /** Includes initial calls, retries and structured-output repair calls. */
  maxRequests: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  /** Hard elapsed-time ceiling for the whole budgeted scope. */
  maxDurationMs: number;
}

export interface AnalysisStage {
  id: string;
  purpose: AnalysisPurpose;
  activation: AnalysisActivation;
  triggers: AnalysisTrigger[];
  context: AnalysisContext[];
  minSeverity: AnalysisSeverity;
  budget: AnalysisBudget;
}

export interface AnalysisPolicy {
  schema: typeof ANALYSIS_POLICY_SCHEMA;
  profileId: string;
  llmPolicy: typeof ANALYSIS_POLICY_LLM_POLICY;
  cacheMode: typeof ANALYSIS_POLICY_CACHE_MODE;
  onProviderUnavailable: 'FAIL';
  onBudgetExhausted: AnalysisBudgetExhaustion;
  budget: AnalysisBudget;
  stages: AnalysisStage[];
}

export interface AnalysisUsageCeiling extends AnalysisBudget {
  stageIds: string[];
}

export interface AnalysisCacheIdentity {
  stageId: string;
  evidenceFingerprint: string;
  model: string;
  promptContract: string;
}

const PROFILE_ID = /^[a-z][a-z0-9-]{1,47}$/;
const STAGE_ID = /^[a-z][a-z0-9-]{1,47}$/;
const FINGERPRINT = /^(?:sha256:)?[a-f0-9]{64}$/;
const MAX_STAGES = 16;
const BUDGET_LIMITS: AnalysisBudget = {
  maxRequests: 64,
  maxInputTokens: 2_000_000,
  maxOutputTokens: 500_000,
  maxDurationMs: 3_600_000,
};

export function renderAnalysisPolicy(policy: AnalysisPolicy): string {
  assertAnalysisPolicy(policy);
  const lines = [
    'DOCUMENT "T2C_ANALYSIS_POLICY"',
    'VERSION 1',
    `SCHEMA ${json(policy.schema)}`,
    `PROFILE_ID ${json(policy.profileId)}`,
    `LLM_POLICY ${json(policy.llmPolicy)}`,
    `CACHE_MODE ${json(policy.cacheMode)}`,
    `ON_PROVIDER_UNAVAILABLE ${json(policy.onProviderUnavailable)}`,
    `ON_BUDGET_EXHAUSTED ${json(policy.onBudgetExhausted)}`,
    ...budgetLines(policy.budget),
    `STAGE_COUNT ${policy.stages.length}`,
  ];
  for (const stage of policy.stages) lines.push('STAGE', ...stageLines(stage), 'END_STAGE');
  return `${lines.join('\n')}\n`;
}

export function parseAnalysisPolicy(value: string): AnalysisPolicy {
  const reader = new PolicyReader(value);
  reader.exact('DOCUMENT "T2C_ANALYSIS_POLICY"');
  reader.exact('VERSION 1');
  const schema = reader.string('SCHEMA');
  const profileId = reader.string('PROFILE_ID');
  const llmPolicy = reader.string('LLM_POLICY');
  const cacheMode = reader.string('CACHE_MODE');
  const onProviderUnavailable = reader.string('ON_PROVIDER_UNAVAILABLE');
  const onBudgetExhausted = reader.string('ON_BUDGET_EXHAUSTED');
  const budget = reader.budget();
  const stageCount = reader.integer('STAGE_COUNT');
  if (stageCount < 1 || stageCount > MAX_STAGES) {
    fail('POLICY-VALUE-002', `STAGE_COUNT must be between 1 and ${MAX_STAGES}`);
  }
  const stages = Array.from({ length: stageCount }, () => parseStage(reader));
  reader.done();
  const policy = {
    schema, profileId, llmPolicy, cacheMode, onProviderUnavailable,
    onBudgetExhausted, budget, stages,
  } as AnalysisPolicy;
  assertAnalysisPolicy(policy);
  if (renderAnalysisPolicy(policy) !== value) {
    fail('POLICY-STRUCTURE-001', 'Analysis policy is not canonically encoded');
  }
  return policy;
}

export function assertAnalysisPolicy(policy: AnalysisPolicy): void {
  if (!policy || policy.schema !== ANALYSIS_POLICY_SCHEMA) {
    fail('POLICY-VALUE-002', `SCHEMA must be ${ANALYSIS_POLICY_SCHEMA}`);
  }
  if (!PROFILE_ID.test(policy.profileId)) fail('POLICY-VALUE-002', `Invalid PROFILE_ID ${policy.profileId}`);
  if (policy.llmPolicy !== ANALYSIS_POLICY_LLM_POLICY) {
    fail('POLICY-VALUE-002', `LLM_POLICY must be ${ANALYSIS_POLICY_LLM_POLICY}`);
  }
  if (policy.cacheMode !== ANALYSIS_POLICY_CACHE_MODE) {
    fail('POLICY-VALUE-002', `CACHE_MODE must be ${ANALYSIS_POLICY_CACHE_MODE}`);
  }
  if (policy.onProviderUnavailable !== 'FAIL') {
    fail('POLICY-VALUE-002', 'ON_PROVIDER_UNAVAILABLE must be FAIL');
  }
  oneOf(policy.onBudgetExhausted, ['FAIL', 'REPORT_INCOMPLETE'], 'ON_BUDGET_EXHAUSTED');
  validateBudget(policy.budget, 'policy');
  validateStages(policy.stages, policy.budget);
}

export function selectAnalysisStages(
  policy: AnalysisPolicy,
  observedTriggers: AnalysisTrigger[],
): AnalysisStage[] {
  assertAnalysisPolicy(policy);
  assertSortedUnique(observedTriggers, 'observed triggers');
  for (const trigger of observedTriggers) oneOf(trigger, ANALYSIS_TRIGGERS, 'observed trigger');
  const observed = new Set(observedTriggers);
  return policy.stages.filter((stage) => stage.activation === 'ALWAYS'
    || stage.triggers.some((trigger) => observed.has(trigger)));
}

export function calculateAnalysisUsageCeiling(
  policy: AnalysisPolicy,
  observedTriggers: AnalysisTrigger[],
): AnalysisUsageCeiling {
  const stages = selectAnalysisStages(policy, observedTriggers);
  const budget = sumBudgets(stages.map((stage) => stage.budget));
  return { stageIds: stages.map((stage) => stage.id), ...budget };
}

export function analysisPolicyFingerprint(policy: AnalysisPolicy): string {
  return digest(renderAnalysisPolicy(policy));
}

export function createAnalysisCacheKey(
  policy: AnalysisPolicy,
  identity: AnalysisCacheIdentity,
): string {
  const stage = policy.stages.find((candidate) => candidate.id === identity.stageId);
  if (!stage) fail('POLICY-VALUE-002', `Unknown cache stage ${identity.stageId}`);
  if (!FINGERPRINT.test(identity.evidenceFingerprint)) {
    fail('POLICY-VALUE-002', 'Evidence fingerprint must be a SHA-256 digest');
  }
  requireText(identity.model, 'cache model');
  requireText(identity.promptContract, 'cache prompt contract');
  return digest(JSON.stringify({
    policyFingerprint: analysisPolicyFingerprint(policy),
    stageId: stage.id,
    evidenceFingerprint: identity.evidenceFingerprint.replace(/^sha256:/, ''),
    model: identity.model,
    promptContract: identity.promptContract,
  }));
}

export function estimateAnalysisCostUsd(
  budget: AnalysisBudget,
  rates: { inputUsdPerMillion: number; outputUsdPerMillion: number },
): number {
  validateBudget(budget, 'cost estimate');
  validateRate(rates.inputUsdPerMillion, 'inputUsdPerMillion');
  validateRate(rates.outputUsdPerMillion, 'outputUsdPerMillion');
  return (budget.maxInputTokens * rates.inputUsdPerMillion
    + budget.maxOutputTokens * rates.outputUsdPerMillion) / 1_000_000;
}

export class AnalysisPolicyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'AnalysisPolicyError';
  }
}

class PolicyReader {
  private readonly lines: string[];
  private cursor = 0;

  constructor(value: string) {
    if (typeof value !== 'string' || value.startsWith('\uFEFF') || value.includes('\r')
      || !value.endsWith('\n') || value.includes('\n\n')) {
      fail('POLICY-STRUCTURE-001', 'Policy must be BOM-free UTF-8 text with canonical LF lines');
    }
    this.lines = value.slice(0, -1).split('\n');
  }

  exact(expected: string): void {
    if (this.lines[this.cursor++] !== expected) fail('POLICY-STRUCTURE-001', `Expected ${expected}`);
  }

  string(name: string): string {
    return stringValue(this.field(name), name);
  }

  stringArray(name: string): string[] {
    return stringArrayValue(this.field(name), name);
  }

  integer(name: string): number {
    return integerValue(this.field(name), name);
  }

  budget(): AnalysisBudget {
    return {
      maxRequests: this.integer('MAX_REQUESTS'),
      maxInputTokens: this.integer('MAX_INPUT_TOKENS'),
      maxOutputTokens: this.integer('MAX_OUTPUT_TOKENS'),
      maxDurationMs: this.integer('MAX_DURATION_MS'),
    };
  }

  done(): void {
    if (this.cursor !== this.lines.length) fail('POLICY-STRUCTURE-001', 'Trailing policy content is forbidden');
  }

  private field(name: string): string {
    const line = this.lines[this.cursor++] ?? '';
    if (!line.startsWith(`${name} `)) fail('POLICY-STRUCTURE-001', `Expected field ${name}`);
    return line.slice(name.length + 1);
  }
}

function parseStage(reader: PolicyReader): AnalysisStage {
  reader.exact('STAGE');
  const stage = {
    id: reader.string('ID'),
    purpose: reader.string('PURPOSE'),
    activation: reader.string('ACTIVATION'),
    triggers: reader.stringArray('TRIGGERS'),
    context: reader.stringArray('CONTEXT'),
    minSeverity: reader.string('MIN_SEVERITY'),
    budget: reader.budget(),
  } as AnalysisStage;
  reader.exact('END_STAGE');
  return stage;
}

function validateStages(stages: AnalysisStage[], globalBudget: AnalysisBudget): void {
  if (!Array.isArray(stages) || stages.length < 1 || stages.length > MAX_STAGES) {
    fail('POLICY-VALUE-002', `Policy must contain between 1 and ${MAX_STAGES} stages`);
  }
  if (!stages.every((stage) => stage && typeof stage === 'object')) {
    fail('POLICY-VALUE-002', 'Policy stages must contain only stage objects');
  }
  assertSortedUnique(stages.map((stage) => stage.id), 'stage IDs');
  for (const stage of stages) validateStage(stage, globalBudget);
  if (!stages.some((stage) => stage.activation === 'ALWAYS')) {
    fail('POLICY-TOPOLOGY-004', 'Policy must contain at least one ALWAYS semantic stage');
  }
  const maximum = sumBudgets(stages.map((stage) => stage.budget));
  assertWithinBudget(maximum, globalBudget, 'Combined stage budgets');
}

function validateStage(stage: AnalysisStage, globalBudget: AnalysisBudget): void {
  if (!STAGE_ID.test(stage.id)) fail('POLICY-VALUE-002', `Invalid stage ID ${stage.id}`);
  oneOf(stage.purpose, ANALYSIS_PURPOSES, `stage ${stage.id} PURPOSE`);
  oneOf(stage.activation, ['ALWAYS', 'ON_TRIGGER'], `stage ${stage.id} ACTIVATION`);
  oneOf(stage.minSeverity, ANALYSIS_SEVERITIES, `stage ${stage.id} MIN_SEVERITY`);
  assertVocabulary(stage.triggers, ANALYSIS_TRIGGERS, `stage ${stage.id} TRIGGERS`, true);
  assertVocabulary(stage.context, ANALYSIS_CONTEXTS, `stage ${stage.id} CONTEXT`, false);
  if (stage.activation === 'ALWAYS' && stage.triggers.length !== 0) {
    fail('POLICY-TOPOLOGY-004', `ALWAYS stage ${stage.id} cannot declare triggers`);
  }
  if (stage.activation === 'ON_TRIGGER' && stage.triggers.length === 0) {
    fail('POLICY-TOPOLOGY-004', `ON_TRIGGER stage ${stage.id} requires at least one trigger`);
  }
  validateBudget(stage.budget, `stage ${stage.id}`);
  assertWithinBudget(stage.budget, globalBudget, `Stage ${stage.id} budget`);
}

function validateBudget(budget: AnalysisBudget, label: string): void {
  if (!budget || typeof budget !== 'object') fail('POLICY-BUDGET-003', `${label} budget is required`);
  validateBoundedInteger(budget.maxRequests, 1, BUDGET_LIMITS.maxRequests, `${label} maxRequests`);
  validateBoundedInteger(budget.maxInputTokens, 1, BUDGET_LIMITS.maxInputTokens, `${label} maxInputTokens`);
  validateBoundedInteger(budget.maxOutputTokens, 1, BUDGET_LIMITS.maxOutputTokens, `${label} maxOutputTokens`);
  validateBoundedInteger(budget.maxDurationMs, 1, BUDGET_LIMITS.maxDurationMs, `${label} maxDurationMs`);
}

function assertWithinBudget(value: AnalysisBudget, ceiling: AnalysisBudget, label: string): void {
  if (value.maxRequests > ceiling.maxRequests
    || value.maxInputTokens > ceiling.maxInputTokens
    || value.maxOutputTokens > ceiling.maxOutputTokens
    || value.maxDurationMs > ceiling.maxDurationMs) {
    fail('POLICY-BUDGET-003', `${label} exceeds the global policy ceiling`);
  }
}

function assertVocabulary<T extends string>(
  values: T[],
  vocabulary: readonly T[],
  label: string,
  allowEmpty: boolean,
): void {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    fail('POLICY-VALUE-002', `${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
  }
  assertSortedUnique(values, label);
  for (const value of values) oneOf(value, vocabulary, label);
}

function assertSortedUnique(values: string[], label: string): void {
  if (!Array.isArray(values)) fail('POLICY-VALUE-002', `${label} must be an array`);
  if (!values.every((value) => typeof value === 'string')) {
    fail('POLICY-VALUE-002', `${label} must contain only strings`);
  }
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index]!;
    if (index > 0 && values[index - 1]! >= current) {
      fail('POLICY-TOPOLOGY-004', `${label} must be sorted and unique`);
    }
  }
}

function sumBudgets(budgets: AnalysisBudget[]): AnalysisBudget {
  return budgets.reduce((sum, budget) => ({
    maxRequests: sum.maxRequests + budget.maxRequests,
    maxInputTokens: sum.maxInputTokens + budget.maxInputTokens,
    maxOutputTokens: sum.maxOutputTokens + budget.maxOutputTokens,
    maxDurationMs: sum.maxDurationMs + budget.maxDurationMs,
  }), { maxRequests: 0, maxInputTokens: 0, maxOutputTokens: 0, maxDurationMs: 0 });
}

function stageLines(stage: AnalysisStage): string[] {
  return [
    `ID ${json(stage.id)}`,
    `PURPOSE ${json(stage.purpose)}`,
    `ACTIVATION ${json(stage.activation)}`,
    `TRIGGERS ${json(stage.triggers)}`,
    `CONTEXT ${json(stage.context)}`,
    `MIN_SEVERITY ${json(stage.minSeverity)}`,
    ...budgetLines(stage.budget),
  ];
}

function budgetLines(budget: AnalysisBudget): string[] {
  return [
    `MAX_REQUESTS ${budget.maxRequests}`,
    `MAX_INPUT_TOKENS ${budget.maxInputTokens}`,
    `MAX_OUTPUT_TOKENS ${budget.maxOutputTokens}`,
    `MAX_DURATION_MS ${budget.maxDurationMs}`,
  ];
}

function stringValue(value: string, name: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'string' || JSON.stringify(parsed) !== value) throw new Error();
    return parsed;
  } catch {
    fail('POLICY-STRUCTURE-001', `${name} must be a canonical JSON string`);
  }
}

function stringArrayValue(value: string, name: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')
      || JSON.stringify(parsed) !== value) throw new Error();
    return parsed;
  } catch {
    fail('POLICY-STRUCTURE-001', `${name} must be a canonical JSON string array`);
  }
}

function integerValue(value: string, name: string): number {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) fail('POLICY-STRUCTURE-001', `${name} must be a canonical integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail('POLICY-VALUE-002', `${name} must be a safe integer`);
  return parsed;
}

function validateBoundedInteger(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail('POLICY-BUDGET-003', `${label} must be an integer between ${minimum} and ${maximum}`);
  }
}

function validateRate(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) fail('POLICY-BUDGET-003', `${label} must be a non-negative number`);
}

function requireText(value: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) {
    fail('POLICY-VALUE-002', `${label} must contain between 1 and 256 characters`);
  }
}

function oneOf<T extends string>(value: T, choices: readonly T[], label: string): void {
  if (!choices.includes(value)) fail('POLICY-VALUE-002', `${label} must be one of: ${choices.join(', ')}`);
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function fail(code: string, message: string): never {
  throw new AnalysisPolicyError(code, message);
}
