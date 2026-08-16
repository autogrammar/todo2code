import type { GroundedGenerationMetadata } from './types.js';
import {
  GENERATION_EFFECTIVE_MODES,
  GENERATION_REQUESTED_MODES,
  RUNTIME_VERSION,
  dateString,
  enumValue,
  exactKeys,
  fingerprint,
  nonBlankString,
  nullableString,
  objectValue,
} from './schema-primitives.js';

export function assertGenerationMatchesExtractor(value: unknown, extractor: string, name: string): void {
  const generation = value as { generator: string; generatorVersion: string };
  const separator = extractor.lastIndexOf('@');
  const expectedGenerator = separator > 0 ? extractor.slice(0, separator) : extractor;
  if (generation.generator !== expectedGenerator) {
    throw new Error(`${name}.generator must match source.extractor (${expectedGenerator})`);
  }
  if (separator > 0 && generation.generatorVersion !== extractor.slice(separator + 1)) {
    throw new Error(`${name}.generatorVersion must match source.extractor (${extractor.slice(separator + 1)})`);
  }
}

export function assertIntentGenerationMetadata(value: unknown, name: string): void {
  const generation = objectValue(value, name);
  exactKeys(generation, [
    'generator', 'generatorVersion', 'runtimeVersion', 'requested', 'used', 'degraded',
    'fallbackReason', 'provider', 'model', 'responseId',
  ], name);
  nonBlankString(generation.generator, `${name}.generator`);
  nonBlankString(generation.generatorVersion, `${name}.generatorVersion`);
  if (typeof generation.runtimeVersion !== 'string' || !RUNTIME_VERSION.test(generation.runtimeVersion)) {
    throw new Error(`${name}.runtimeVersion must be a semantic version`);
  }
  enumValue(generation.requested, GENERATION_EFFECTIVE_MODES, `${name}.requested`);
  enumValue(generation.used, GENERATION_EFFECTIVE_MODES, `${name}.used`);
  if (typeof generation.degraded !== 'boolean') throw new Error(`${name}.degraded must be a boolean`);
  nullableString(generation.fallbackReason, `${name}.fallbackReason`);
  nullableString(generation.provider, `${name}.provider`);
  nullableString(generation.model, `${name}.model`);
  nullableString(generation.responseId, `${name}.responseId`);
  if (generation.used === 'llm') {
    nonBlankString(generation.provider, `${name}.provider`);
    nonBlankString(generation.model, `${name}.model`);
  } else if (generation.provider !== null || generation.model !== null || generation.responseId !== null) {
    throw new Error(`${name}: deterministic generation cannot claim an LLM provider, model or responseId`);
  }
  if (generation.degraded) {
    if (generation.requested !== 'llm' || generation.used !== 'deterministic') {
      throw new Error(`${name}: degraded generation must be an LLM request using deterministic fallback`);
    }
    nonBlankString(generation.fallbackReason, `${name}.fallbackReason`);
  } else if (generation.fallbackReason !== null) {
    throw new Error(`${name}.fallbackReason must be null when generation is not degraded`);
  }
}

export function assertGroundedGenerationMetadata(value: unknown, name: string): asserts value is GroundedGenerationMetadata {
  // #lizard forgives
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

  if (generation.effectiveMode === 'llm') {
    nonBlankString(generation.model, `${name}.model`);
    nonBlankString(generation.provider, `${name}.provider`);
    if (generation.degraded) throw new Error(`${name}.degraded must be false when effectiveMode is llm`);
  }
  if (generation.requestedMode === 'deterministic') {
    if (generation.effectiveMode !== 'deterministic' || generation.degraded
      || generation.model !== null || generation.provider !== null || generation.responseId !== null
      || generation.reason !== null) {
      throw new Error(`${name} deterministic mode cannot contain LLM or degradation metadata`);
    }
  }
  if (generation.requestedMode === 'require-llm' && generation.effectiveMode !== 'llm') {
    throw new Error(`${name} require-llm mode cannot use deterministic output`);
  }
  if (generation.requestedMode === 'prefer-llm' && generation.effectiveMode === 'deterministic' && !generation.degraded) {
    throw new Error(`${name} prefer-llm deterministic output must be marked degraded`);
  }
  if (generation.degraded) {
    if (generation.requestedMode !== 'prefer-llm' || generation.effectiveMode !== 'deterministic') {
      throw new Error(`${name} degraded output is only valid for prefer-llm deterministic fallback`);
    }
    nonBlankString(generation.reason, `${name}.reason`);
  } else if (generation.reason !== null) {
    throw new Error(`${name}.reason must be null when output is not degraded`);
  }
}

