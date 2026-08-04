import type { GroundedGenerationMetadata } from '../core/types.js';

const SHA256 = /^[a-f0-9]{64}$/;
const GENERATION_REQUIRED_FIELDS = [
  'generator',
  'generatorVersion',
  'runtimeVersion',
  'generatedAt',
  'requestedMode',
  'effectiveMode',
  'degraded',
  'model',
  'provider',
  'responseId',
  'configurationFingerprint',
  'reason',
] as const;

const REQUESTED_MODES = ['deterministic', 'prefer-llm', 'require-llm'] as const;
const EFFECTIVE_MODES = ['deterministic', 'llm'] as const;

function asObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${name} keys must be exactly: ${expected.join(', ')}`);
  }
}

function assertNonBlank(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-blank string`);
}

function assertDateString(value: unknown, name: string): void {
  assertNonBlank(value, name);
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${name} must be an ISO date-time`);
}

export function assertGeneration(value: unknown): asserts value is GroundedGenerationMetadata {
  const generation = asObject(value, 'Operation plan generation');
  assertExactKeys(generation, [...GENERATION_REQUIRED_FIELDS], 'Operation plan generation');
  assertGenerationRequiredTextFields(generation);
  assertDateString(generation.generatedAt, 'generation.generatedAt');
  assertGenerationModes(generation);
  assertGenerationOptionalTextFields(generation);
  assertGenerationProvenanceRules(generation);
}

function assertGenerationRequiredTextFields(generation: Record<string, unknown>): void {
  for (const field of ['generator', 'generatorVersion', 'runtimeVersion'] as const) assertNonBlank(generation[field], `generation.${field}`);
}

function assertGenerationModes(generation: Record<string, unknown>): void {
  if (!isAllowedGenerationMode(generation.requestedMode, REQUESTED_MODES)) {
    throw new Error('generation.requestedMode is invalid');
  }
  if (!isAllowedGenerationMode(generation.effectiveMode, EFFECTIVE_MODES)) {
    throw new Error('generation.effectiveMode is invalid');
  }
}

function assertGenerationOptionalTextFields(generation: Record<string, unknown>): void {
  for (const field of ['model', 'provider', 'responseId', 'reason'] as const) {
    if (generation[field] !== null) assertNonBlank(generation[field], `generation.${field}`);
  }
}

function assertGenerationProvenanceRules(generation: Record<string, unknown>): void {
  if (typeof generation.degraded !== 'boolean') throw new Error('generation.degraded must be a boolean');
  if (typeof generation.configurationFingerprint !== 'string' || !SHA256.test(generation.configurationFingerprint)) {
    throw new Error('generation.configurationFingerprint must be SHA-256');
  }

  if (generation.effectiveMode === 'llm' && (generation.model === null || generation.provider === null)) {
    throw new Error('LLM operation plans require model and provider provenance');
  }
  if (isDeterministicModeProvenance(generation)) {
    throw new Error('Deterministic operation plans cannot claim LLM provenance');
  }
}

function isAllowedGenerationMode(value: unknown, allowed: readonly string[]): boolean {
  return allowed.includes(String(value));
}

function isDeterministicModeProvenance(generation: Record<string, unknown>): boolean {
  return (
    generation.effectiveMode === 'deterministic'
    && (generation.model !== null || generation.provider !== null || generation.responseId !== null)
  ) {
    return true;
  }
  return false;
}
