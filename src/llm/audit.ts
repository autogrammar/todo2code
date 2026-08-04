import type { T2CConfig } from '../config/env.js';
import type { JsonValue } from '../core/types.js';
import { OPENROUTER_TIMEOUT_POLICY } from './openrouter-timeout.js';

/** Safe, secret-free OpenRouter parameters persisted with standalone and pipeline audits. */
export function openRouterAuditConfiguration(
  config: T2CConfig,
  model: string | null,
  timeoutMs = config.openRouter.timeoutMs,
): Record<string, JsonValue> {
  return {
    model,
    baseUrl: config.openRouter.baseUrl,
    timeoutMs,
    adaptiveTimeout: {
      baseTimeoutMs: timeoutMs,
      inputCharactersBaseline: OPENROUTER_TIMEOUT_POLICY.inputCharactersBaseline,
      outputTokensBaseline: OPENROUTER_TIMEOUT_POLICY.outputTokensBaseline,
      complexityPointsBaseline: OPENROUTER_TIMEOUT_POLICY.complexityPointsBaseline,
      scaleFactor: OPENROUTER_TIMEOUT_POLICY.scaleFactor,
      maximumMultiplier: OPENROUTER_TIMEOUT_POLICY.maximumMultiplier,
      maximumTimeoutMs: OPENROUTER_TIMEOUT_POLICY.maximumTimeoutMs,
    },
    maxTokens: config.openRouter.maxTokens,
    temperature: config.openRouter.temperature,
    requireStructuredOutput: config.openRouter.requireStructuredOutput,
    responseHealing: config.openRouter.responseHealing,
  };
}
