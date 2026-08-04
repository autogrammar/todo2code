import type { BuildRecordGenerationInput, IntentGenerationMetadata } from './types.js';
import { T2C_VERSION } from './version.js';

const DEFAULT_GENERATION_MODE = 'deterministic';

export function generationMetadata(
  extractor: string,
  input: BuildRecordGenerationInput | undefined,
): IntentGenerationMetadata {
  return {
    ...generationIdentity(extractor),
    runtimeVersion: T2C_VERSION,
    requested: requestedGenerationMode(input),
    used: usedGenerationMode(input),
    degraded: input?.degraded ?? false,
    fallbackReason: input?.fallbackReason ?? null,
    provider: input?.provider ?? null,
    model: input?.model ?? null,
    responseId: input?.responseId ?? null,
  };
}

function requestedGenerationMode(input: BuildRecordGenerationInput | undefined): string {
  if (input?.requested !== undefined) return input.requested;
  return usedGenerationMode(input);
}

function usedGenerationMode(input: BuildRecordGenerationInput | undefined): string {
  return input?.used ?? DEFAULT_GENERATION_MODE;
}

function generationIdentity(extractor: string): { generator: string; generatorVersion: string } {
  const separator = extractor.lastIndexOf('@');
  if (separator > 0 && separator < extractor.length - 1) {
    return { generator: extractor.slice(0, separator), generatorVersion: extractor.slice(separator + 1) };
  }
  return { generator: extractor, generatorVersion: T2C_VERSION };
}
