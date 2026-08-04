import type { JsonValue, IntentRecord, GroundedGenerationMetadata } from '../types.js';
import {
  GENERATION_EFFECTIVE_MODES,
  GENERATION_REQUESTED_MODES,
  FINGERPRINT,
  ISO_DATE_TIME,
  RUNTIME_VERSION,
} from './constants.js';

export function objectValue(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

export function exactKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const expectedSet = new Set(expected);
  const missing = expected.filter((key) => !(key in value));
  const extra = Object.keys(value).filter((key) => !expectedSet.has(key));
  if (missing.length) throw new Error(`${name} is missing: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`${name} has unsupported fields: ${extra.join(', ')}`);
}

export function nonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.length) throw new Error(`${name} must be a non-empty string`);
}

export function nonBlankString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim().length) throw new Error(`${name} must be a non-blank string`);
}

export function nullableString(value: unknown, name: string): void {
  if (value !== null && typeof value !== 'string') throw new Error(`${name} must be a string or null`);
}

export function enumValue(value: unknown, allowed: Set<string>, name: string): asserts value is string {
  if (typeof value !== 'string' || !allowed.has(value)) throw new Error(`${name} has unsupported value: ${String(value)}`);
}

export function stringArray(value: unknown, name: string, unique = false): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${name} must be an array of strings`);
  }
  if (unique && new Set(value).size !== value.length) {
    throw new Error(`${name} must contain unique values`);
  }
}

export function nonEmptyUniqueStringArray(value: unknown, name: string): asserts value is string[] {
  stringArray(value, name, true);
  if (!value.length || value.some((item) => !item.trim().length)) {
    throw new Error(`${name} must contain at least one non-blank string`);
  }
  if (new Set(value.map((item) => item.trim())).size !== value.length) {
    throw new Error(`${name} must remain unique after trimming whitespace`);
  }
}

export function repositoryPath(value: unknown, name: string): string {
  nonBlankString(value, name);
  const normalized = value.trim().replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.split('/').some((part) => part === '..')) {
    throw new Error(`${name} must be a relative repository path without parent traversal`);
  }
  return normalized;
}

export function exactStringSet(actual: string[], expected: string[], name: string): void {
  const normalizedActual = [...actual].sort();
  if (normalizedActual.length !== expected.length
    || normalizedActual.some((value, index) => value !== expected[index])) {
    throw new Error(`${name} does not match the grounded diagnostic set`);
  }
}

export function uniqueIdArray(value: unknown, pattern: RegExp, name: string): asserts value is string[] {
  stringArray(value, name, true);
  if (value.some((item) => !pattern.test(item))) throw new Error(`${name} contains an invalid id`);
}

export function nonEmptyUniqueIdArray(value: unknown, pattern: RegExp, name: string): asserts value is string[] {
  uniqueIdArray(value, pattern, name);
  if (!value.length) throw new Error(`${name} must contain at least one id`);
}

export function knownReferences(values: string[], known: Set<string>, name: string): void {
  const unknown = values.filter((value) => !known.has(value));
  if (unknown.length) throw new Error(`${name} references unknown ids: ${unknown.join(', ')}`);
}

export function confidence(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1`);
  }
}

export function assertAcyclicProposalDependencies(proposals: { id: string; dependencies: string[] }[]): void {
  const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, chain: string[]): void => {
    if (visiting.has(id)) {
      const start = chain.indexOf(id);
      throw new Error(`TODO proposal dependency cycle: ${[...chain.slice(Math.max(0, start)), id].join(' -> ')}`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const proposal of proposals) visit(proposal.id, []);
}

export function dateString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !ISO_DATE_TIME.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${name} must be an ISO date-time string`);
  }
}

export function nullableDate(value: unknown, name: string): void {
  if (value !== null) dateString(value, name);
}

export function fingerprint(value: unknown, name: string): void {
  if (typeof value !== 'string' || !FINGERPRINT.test(value)) throw new Error(`${name} must be SHA-256`);
}

export function nonNegativeInteger(value: unknown, name: string): void {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${name} must be an integer >= 0`);
}

export function countMap(value: unknown, name: string): void {
  const map = objectValue(value, name);
  for (const [key, count] of Object.entries(map)) {
    if (!key) throw new Error(`${name} keys must be non-empty`);
    nonNegativeInteger(count, `${name}.${key}`);
  }
}

export function countRecords(records: IntentRecord[], selector: (record: IntentRecord) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const key = selector(record);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function exactCounts(value: unknown, expected: Record<string, number>, name: string): void {
  const actual = objectValue(value, name);
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort();
  for (const key of keys) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${name} is inconsistent for ${key}: expected ${expected[key] ?? 0}, received ${String(actual[key] ?? 0)}`);
    }
  }
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isJsonValue);
  return false;
}

export function assertGroundedGenerationMetadata(
  value: unknown,
  name: string,
): asserts value is GroundedGenerationMetadata {
  const generation = objectValue(value, name);
  exactKeys(generation, [
    'generator', 'generatorVersion', 'runtimeVersion', 'generatedAt', 'requestedMode', 'effectiveMode',
    'degraded', 'model', 'provider', 'responseId', 'configurationFingerprint', 'reason',
  ], name);
  nonBlankString(generation.generator, `${name}.generator`);
  nonBlankString(generation.generatorVersion, `${name}.generatorVersion`);
  if (typeof generation.runtimeVersion !== 'string' || !RUNTIME_VERSION.test(generation.runtimeVersion)) {
    throw new Error(`${name}.runtimeVersion must be a semantic version`);
  }
  dateString(generation.generatedAt, `${name}.generatedAt`);
  enumValue(generation.requestedMode, GENERATION_REQUESTED_MODES, `${name}.requestedMode`);
  enumValue(generation.effectiveMode, GENERATION_EFFECTIVE_MODES, `${name}.effectiveMode`);
  if (typeof generation.degraded !== 'boolean') throw new Error(`${name}.degraded must be a boolean`);
  nullableString(generation.model, `${name}.model`);
  nullableString(generation.provider, `${name}.provider`);
  nullableString(generation.responseId, `${name}.responseId`);
  fingerprint(generation.configurationFingerprint, `${name}.configurationFingerprint`);
  nullableString(generation.reason, `${name}.reason`);

  assertGroundedLlMMode(generation, name);
  assertModeRequirements(generation, name);
  assertDegradedRequirements(generation, name);
}

function assertGroundedLlMMode(generation: Record<string, unknown>, name: string): void {
  if (generation.effectiveMode !== 'llm') return;
  nonBlankString(generation.model, `${name}.model`);
  nonBlankString(generation.provider, `${name}.provider`);
  if (generation.degraded) throw new Error(`${name}.degraded must be false when effectiveMode is llm`);
}

function assertModeRequirements(generation: Record<string, unknown>, name: string): void {
  if (generation.requestedMode === 'deterministic') {
    assertDeterministicGeneration(generation, name);
    return;
  }
  if (generation.requestedMode === 'require-llm' && generation.effectiveMode !== 'llm') {
    throw new Error(`${name} require-llm mode cannot use deterministic output`);
  }
  if (generation.requestedMode === 'prefer-llm'
    && generation.effectiveMode === 'deterministic'
    && !generation.degraded) {
    throw new Error(`${name} prefer-llm deterministic output must be marked degraded`);
  }
}

function assertDeterministicGeneration(generation: Record<string, unknown>, name: string): void {
  if (
    generation.effectiveMode !== 'deterministic' || generation.degraded
    || generation.model !== null || generation.provider !== null || generation.responseId !== null
    || generation.reason !== null
  ) {
    throw new Error(`${name} deterministic mode cannot contain LLM or degradation metadata`);
  }
}

function assertDegradedRequirements(generation: Record<string, unknown>, name: string): void {
  if (!generation.degraded) {
    if (generation.reason !== null) {
      throw new Error(`${name}.reason must be null when output is not degraded`);
    }
    return;
  }
  if (generation.requestedMode !== 'prefer-llm' || generation.effectiveMode !== 'deterministic') {
    throw new Error(`${name} degraded output is only valid for prefer-llm deterministic fallback`);
  }
  nonBlankString(generation.reason, `${name}.reason`);
}
