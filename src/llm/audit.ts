import type { T2CConfig } from '../config/env.js';
import type { JsonValue } from '../core/types.js';

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
    maxTokens: config.openRouter.maxTokens,
    temperature: config.openRouter.temperature,
    requireStructuredOutput: config.openRouter.requireStructuredOutput,
    responseHealing: config.openRouter.responseHealing,
  };
}
