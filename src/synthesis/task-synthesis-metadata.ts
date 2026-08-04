import { sha256, stableStringify } from '../core/id.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import type { T2CConfig } from '../config/env.js';
import type { GroundedGenerationMetadata, LlmResponseMetadata } from '../core/types.js';
import { T2C_VERSION } from '../version.js';

export type TaskSynthesisMode = 'prefer-llm' | 'require-llm';
export function taskSynthesisGenerationMetadata(
  config: T2CConfig,
  mode: TaskSynthesisMode,
  response: LlmResponseMetadata,
): GroundedGenerationMetadata {
  const configuration = openRouterAuditConfiguration(config, config.openRouter.taskModel);
  return {
    generator: 't2c/task-synthesis',
    generatorVersion: '2',
    runtimeVersion: T2C_VERSION,
    generatedAt: new Date().toISOString(),
    requestedMode: mode,
    effectiveMode: 'llm',
    degraded: false,
    model: response.model ?? config.openRouter.taskModel,
    provider: response.provider ?? 'openrouter',
    responseId: response.responseId,
    configurationFingerprint: sha256(stableStringify(configuration)),
    reason: null,
  };
}
