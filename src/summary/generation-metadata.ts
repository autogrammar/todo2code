import { sha256, stableStringify } from '../core/id.js';
import type { T2CConfig } from '../config/env.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { T2C_VERSION } from '../version.js';
import type {
  GroundedGenerationMetadata,
  LlmResponseMetadata,
} from '../core/types.js';

export function generationMetadata(
  config: T2CConfig,
  mode: GroundedGenerationMetadata['requestedMode'],
  response?: LlmResponseMetadata,
  reason?: string,
): GroundedGenerationMetadata {
  const effectiveMode = resolveGenerationMode(response);
  const degraded = shouldDegradeGeneration(mode, effectiveMode);
  return {
    generator: 't2c/grounded-summary',
    generatorVersion: '2',
    runtimeVersion: T2C_VERSION,
    generatedAt: new Date().toISOString(),
    requestedMode: mode,
    effectiveMode,
    degraded,
    model: resolveGenerationModel(config, response),
    provider: resolveGenerationProvider(response),
    responseId: response?.responseId ?? null,
    configurationFingerprint: sha256(stableStringify(resolveGenerationConfiguration(config, mode))),
    reason: degraded ? reason ?? 'LLM_UNAVAILABLE' : null,
  };
}

function resolveGenerationMode(response?: LlmResponseMetadata): 'llm' | 'deterministic' {
  return response ? 'llm' : 'deterministic';
}

function shouldDegradeGeneration(
  mode: GroundedGenerationMetadata['requestedMode'],
  effectiveMode: 'llm' | 'deterministic',
): boolean {
  return mode === 'prefer-llm' && effectiveMode === 'deterministic';
}

function resolveGenerationModel(config: T2CConfig, response?: LlmResponseMetadata): string | null {
  return response ? response.model ?? config.openRouter.summaryModel : null;
}

function resolveGenerationProvider(response?: LlmResponseMetadata): string | null {
  return response ? response.provider ?? 'openrouter' : null;
}

function resolveGenerationConfiguration(
  config: T2CConfig,
  mode: GroundedGenerationMetadata['requestedMode'],
) {
  return openRouterAuditConfiguration(
    config,
    mode === 'deterministic' ? null : config.openRouter.summaryModel,
  );
}
