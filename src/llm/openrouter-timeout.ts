export const OPENROUTER_TIMEOUT_POLICY = Object.freeze({
  inputCharactersBaseline: 8_000,
  outputTokensBaseline: 6_000,
  complexityPointsBaseline: 4,
  scaleFactor: 2,
  maximumMultiplier: 8,
  maximumTimeoutMs: 600_000,
});

export interface OpenRouterTimeoutLoad {
  serializedInputCharacters: number;
  outputTokens: number;
  messageCount: number;
  strictJsonSchema: boolean;
  responseHealing: boolean;
}

export interface OpenRouterTimeoutDecision extends OpenRouterTimeoutLoad {
  baseTimeoutMs: number;
  complexityPoints: number;
  pressure: number;
  multiplier: number;
  effectiveTimeoutMs: number;
  capped: boolean;
}

/** Calculate one bounded request deadline without reading environment state. */
export function calculateOpenRouterTimeout(
  baseTimeoutMs: number,
  load: OpenRouterTimeoutLoad,
): OpenRouterTimeoutDecision {
  assertPositiveFinite(baseTimeoutMs, 'base timeout');
  if (baseTimeoutMs > OPENROUTER_TIMEOUT_POLICY.maximumTimeoutMs) {
    throw new Error(`OpenRouter base timeout must not exceed ${OPENROUTER_TIMEOUT_POLICY.maximumTimeoutMs} ms`);
  }
  assertNonNegativeInteger(load.serializedInputCharacters, 'serialized input characters');
  assertNonNegativeInteger(load.outputTokens, 'output tokens');
  assertNonNegativeInteger(load.messageCount, 'message count');
  if (typeof load.strictJsonSchema !== 'boolean' || typeof load.responseHealing !== 'boolean') {
    throw new Error('OpenRouter timeout complexity flags must be boolean');
  }

  const complexityPoints = load.messageCount
    + (load.strictJsonSchema ? 2 : 0)
    + (load.responseHealing ? 1 : 0);
  const pressure = Math.max(
    1,
    load.serializedInputCharacters / OPENROUTER_TIMEOUT_POLICY.inputCharactersBaseline,
    load.outputTokens / OPENROUTER_TIMEOUT_POLICY.outputTokensBaseline,
    complexityPoints / OPENROUTER_TIMEOUT_POLICY.complexityPointsBaseline,
  );
  const steps = pressure <= 1 ? 0 : Math.ceil(Math.log2(pressure));
  const multiplier = Math.min(
    OPENROUTER_TIMEOUT_POLICY.maximumMultiplier,
    OPENROUTER_TIMEOUT_POLICY.scaleFactor ** steps,
  );
  const scaledTimeoutMs = baseTimeoutMs * multiplier;
  const effectiveTimeoutMs = Math.min(
    OPENROUTER_TIMEOUT_POLICY.maximumTimeoutMs,
    scaledTimeoutMs,
  );

  return {
    ...load,
    baseTimeoutMs,
    complexityPoints,
    pressure,
    multiplier,
    effectiveTimeoutMs,
    capped: effectiveTimeoutMs < scaledTimeoutMs,
  };
}

/** Derive timeout pressure from the exact JSON-compatible OpenRouter body. */
export function openRouterRequestTimeout(
  body: Record<string, unknown>,
  baseTimeoutMs: number,
): OpenRouterTimeoutDecision {
  let serialized: string;
  try {
    serialized = JSON.stringify(body);
  } catch (error) {
    throw new Error(`OpenRouter request body must be JSON-serializable: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (serialized === undefined) {
    throw new Error('OpenRouter request body must serialize to a JSON object');
  }

  const messages = optionalArray(body.messages, 'messages');
  const plugins = optionalArray(body.plugins, 'plugins');
  const responseFormat = optionalObject(body.response_format, 'response_format');
  const jsonSchema = responseFormat?.type === 'json_schema'
    ? optionalObject(responseFormat.json_schema, 'response_format.json_schema')
    : undefined;
  const maxTokens = body.max_tokens === undefined ? 0 : body.max_tokens;
  assertNonNegativeInteger(maxTokens, 'max_tokens');

  return calculateOpenRouterTimeout(baseTimeoutMs, {
    serializedInputCharacters: serialized.length,
    outputTokens: maxTokens,
    messageCount: messages?.length ?? 0,
    strictJsonSchema: responseFormat?.type === 'json_schema' && jsonSchema?.strict === true,
    responseHealing: plugins?.some((plugin) => {
      if (plugin === null || typeof plugin !== 'object' || Array.isArray(plugin)) {
        throw new Error('OpenRouter request plugins must contain objects');
      }
      return (plugin as Record<string, unknown>).id === 'response-healing';
    }) ?? false,
  });
}

function optionalArray(value: unknown, name: string): unknown[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`OpenRouter request ${name} must be an array`);
  return value;
}

function optionalObject(value: unknown, name: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`OpenRouter request ${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertPositiveFinite(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`OpenRouter ${name} must be a positive finite number`);
  }
}

function assertNonNegativeInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`OpenRouter ${name} must be a non-negative safe integer`);
  }
}
