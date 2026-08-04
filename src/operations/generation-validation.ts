import type { GroundedGenerationMetadata } from '../core/types.js';

const SHA256 = /^[a-f0-9]{64}$/;

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
  assertExactKeys(
    generation,
    [
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
    ],
    'Operation plan generation',
  );
  for (const field of ['generator', 'generatorVersion', 'runtimeVersion'] as const) assertNonBlank(generation[field], `generation.${field}`);
  assertDateString(generation.generatedAt, 'generation.generatedAt');
  if (!['deterministic', 'prefer-llm', 'require-llm'].includes(String(generation.requestedMode))) throw new Error('generation.requestedMode is invalid');
  if (!['deterministic', 'llm'].includes(String(generation.effectiveMode))) throw new Error('generation.effectiveMode is invalid');
  if (typeof generation.degraded !== 'boolean') throw new Error('generation.degraded must be a boolean');
  if (typeof generation.configurationFingerprint !== 'string' || !SHA256.test(generation.configurationFingerprint)) {
    throw new Error('generation.configurationFingerprint must be SHA-256');
  }
  for (const field of ['model', 'provider', 'responseId', 'reason'] as const) {
    if (generation[field] !== null) assertNonBlank(generation[field], `generation.${field}`);
  }
  if (generation.effectiveMode === 'llm' && (generation.model === null || generation.provider === null)) {
    throw new Error('LLM operation plans require model and provider provenance');
  }
  if (
    generation.effectiveMode === 'deterministic'
    && (generation.model !== null || generation.provider !== null || generation.responseId !== null)
  ) {
    throw new Error('Deterministic operation plans cannot claim LLM provenance');
  }
}
