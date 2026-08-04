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
  return {
    generator: 't2c/grounded-summary',
    generatorVersion: '2',
    runtimeVersion: T2C_VERSION,
    generatedAt: new Date().toISOString(),
    requestedMode: mode,
    ...resolveGenerationSummary(response, mode),
    model: resolveGenerationModel(config, response),
    provider: resolveGenerationProvider(response),
    responseId: resolveResponseId(response),
    configurationFingerprint: sha256(stableStringify(resolveGenerationConfiguration(config, mode))),
    reason: resolveGenerationReason(response, mode, reason),
  };
}

function resolveGenerationSummary(
  response: LlmResponseMetadata | undefined,
  mode: GroundedGenerationMetadata['requestedMode'],
): Pick<GroundedGenerationMetadata, 'effectiveMode' | 'degraded'> {
  const effectiveMode = resolveGenerationMode(response);
  return {
    effectiveMode,
    degraded: shouldDegradeGeneration(mode, effectiveMode),
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

function resolveResponseId(response?: LlmResponseMetadata): string | null {
  return response?.responseId ?? null;
}

function resolveGenerationReason(
  response: LlmResponseMetadata | undefined,
  mode: GroundedGenerationMetadata['requestedMode'],
  reason?: string,
): string | null {
  if (!shouldDegradeGeneration(mode, resolveGenerationMode(response))) {
    return null;
  }
  return reason ?? 'LLM_UNAVAILABLE';
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
