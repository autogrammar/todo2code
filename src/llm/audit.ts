import type { T2CConfig } from '../config/env.js';
import type { JsonValue } from '../core/types.js';
import { OPENROUTER_TIMEOUT_POLICY } from './openrouter-timeout.js';
import { lastResolvedSubllmRoute, shouldUseSubllm } from './subllm.js';

/** Safe, secret-free OpenRouter parameters persisted with standalone and pipeline audits. */
export function openRouterAuditConfiguration(
  config: T2CConfig,
  model: string | null,
  timeoutMs = config.openRouter.timeoutMs,
): Record<string, JsonValue> {
  const subllmEnabled = subllmRoutingEnabled();
  const route = subllmEnabled === true ? lastResolvedSubllmRoute() : null;
  return {
    model,
    baseUrl: config.openRouter.baseUrl,
    effectiveRouting: route ? {
      source: 'subllm',
      status: 'resolved',
      application: route.application,
      function: route.function,
      provider: route.provider,
      model: route.model,
      wireModel: route.wire_model,
      priority: route.priority,
      apiBase: route.api_base,
    } : subllmEnabled === true ? {
      source: 'subllm',
      status: 'unresolved',
    } : subllmEnabled === null ? {
      source: 'subllm',
      status: 'invalid-configuration',
    } : {
      source: 'direct',
      status: 'configured',
      provider: 'openrouter',
      model,
      wireModel: model,
      apiBase: config.openRouter.baseUrl,
    },
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

function subllmRoutingEnabled(): boolean | null {
  try {
    return shouldUseSubllm();
  } catch {
    return null;
  }
}
