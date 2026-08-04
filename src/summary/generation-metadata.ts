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
  const effectiveMode = response ? 'llm' : 'deterministic';
  const degraded = mode === 'prefer-llm' && effectiveMode === 'deterministic';
  const configuration = openRouterAuditConfiguration(
    config,
    mode === 'deterministic' ? null : config.openRouter.summaryModel,
  );
  return {
    generator: 't2c/grounded-summary',
    generatorVersion: '2',
    runtimeVersion: T2C_VERSION,
    generatedAt: new Date().toISOString(),
    requestedMode: mode,
    effectiveMode,
    degraded,
    model: response ? response.model ?? config.openRouter.summaryModel : null,
    provider: response ? response.provider ?? 'openrouter' : null,
    responseId: response?.responseId ?? null,
    configurationFingerprint: sha256(stableStringify(configuration)),
    reason: degraded ? reason ?? 'LLM_UNAVAILABLE' : null,
  };
}
