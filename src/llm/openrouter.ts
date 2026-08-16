import { randomUUID } from 'node:crypto';
import type { T2CConfig } from '../config/env.js';
import { StructuredResponseError, type StructuredSchema } from './structured-schema.js';
import { openRouterRequestTimeout, type OpenRouterTimeoutDecision } from './openrouter-timeout.js';
import {
  extractContent,
  formatInvalidModelError,
  isInvalidModelError,
  parseJsonResponse,
  parseProviderResponse,
  responseMetadata,
  responseProviderLabel,
  type OpenRouterResponse,
  type OpenRouterResult,
} from './openrouter-parse.js';
import { redactProviderFailureText } from './openrouter-redact.js';
import { resolveSubllmRoute, shouldUseSubllm, type ResolvedSubllmRoute } from './subllm.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type { OpenRouterResult } from './openrouter-parse.js';

interface OpenRouterModelsResponse {
  data?: Array<{ id?: string }>;
  error?: { message?: string };
}

interface LlmTransport {
  provider: 'zai' | 'openrouter';
  providerLabel: 'Z.AI' | 'OpenRouter';
  apiBase: string;
  credential: string;
  wireModel: string | null;
  application: string | null;
  function: string | null;
  headers: Record<string, string>;
  subllm: boolean;
}

export class OpenRouterModelError extends Error {
  constructor(
    message: string,
    readonly model: string,
    readonly availableModels: string[],
  ) {
    super(message);
    this.name = 'OpenRouterModelError';
  }
}

export class OpenRouterClient {
  private resolvedSubllm: Promise<ResolvedSubllmRoute> | null = null;

  constructor(private readonly config: T2CConfig['openRouter']) {}

  isConfigured(): boolean {
    return shouldUseSubllm() || Boolean(this.config.apiKey);
  }

  async listAvailableModels(): Promise<string[]> {
    const transport = await this.transport();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const headers: Record<string, string> = {
        ...transport.headers,
        Authorization: `Bearer ${transport.credential}`,
      };
      const response = await fetch(`${transport.apiBase}/models`, {
        headers,
        signal: controller.signal,
      });
      const text = await response.text();
      let parsed: OpenRouterModelsResponse;
      try {
        parsed = JSON.parse(text) as OpenRouterModelsResponse;
      } catch {
        throw new Error(
          `${transport.providerLabel} models endpoint returned non-JSON HTTP ${response.status}: `
          + redactProviderFailureText(text.slice(0, 500), transport.credential),
        );
      }
      if (!response.ok || parsed.error) {
        throw new Error(
          `${transport.providerLabel} models HTTP ${response.status}: `
          + redactProviderFailureText(parsed.error?.message ?? text.slice(0, 500), transport.credential),
        );
      }
      return [...new Set((parsed.data ?? [])
        .map((model) => model.id?.trim())
        .filter((id): id is string => Boolean(id)))]
        .sort((left, right) => left.localeCompare(right));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${transport.providerLabel} models request timed out after ${this.config.timeoutMs} ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async chatText(messages: ChatMessage[], model = this.config.model): Promise<string> {
    return (await this.chatTextWithMetadata(messages, model)).value;
  }

  async chatTextWithMetadata(messages: ChatMessage[], model = this.config.model): Promise<OpenRouterResult<string>> {
    const response = await this.request({
      model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });
    const content = extractContent(response);
    if (!content.trim()) throw new Error(`${responseProviderLabel(response)} returned an empty response`);
    return { value: content.trim(), metadata: responseMetadata(response) };
  }

  async chatJson<T>(messages: ChatMessage[], schemaName: string, schema: Record<string, unknown>, model = this.config.model): Promise<T> {
    return (await this.chatJsonWithMetadata<T>(messages, schemaName, schema, model)).value;
  }

  async chatStructuredWithMetadata<T>(
    messages: ChatMessage[],
    schemaName: string,
    contract: StructuredSchema<T>,
    model = this.config.model,
  ): Promise<OpenRouterResult<T>> {
    const result = await this.chatJsonWithMetadata<unknown>(messages, schemaName, contract.jsonSchema, model);
    try {
      return { ...result, value: contract.parse(result.value) };
    } catch (error) {
      if (error instanceof StructuredResponseError) {
        throw new StructuredResponseError(error.message, result.metadata);
      }
      throw error;
    }
  }

  async chatJsonWithMetadata<T>(messages: ChatMessage[], schemaName: string, schema: Record<string, unknown>, model = this.config.model): Promise<OpenRouterResult<T>> {
    const structuredBody = {
      model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: this.config.requireStructuredOutput
        ? {
            type: 'json_schema',
            json_schema: { name: schemaName, strict: true, schema },
          }
        : { type: 'json_object' },
      provider: this.config.requireStructuredOutput ? { require_parameters: true } : undefined,
      plugins: this.config.responseHealing ? [{ id: 'response-healing' }] : undefined,
    };

    try {
      const response = await this.request(structuredBody);
      return parseJsonResponse<T>(response);
    } catch (firstError) {
      if (firstError instanceof OpenRouterModelError) throw firstError;
      if (!this.config.requireStructuredOutput) throw firstError;
      // Retrying without JSON Schema can repair a provider capability or output
      // formatting problem. It cannot repair a timeout/network/server failure,
      // and repeating those failures used to double the worst-case chunk time.
      if (!shouldRetryWithoutJsonSchema(firstError)) throw firstError;
      const fallback = await this.request({
        model,
        messages: [
          ...messages,
          { role: 'system' as const, content: 'Return one valid JSON object only. Do not wrap it in Markdown.' },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: 'json_object' },
        plugins: this.config.responseHealing ? [{ id: 'response-healing' }] : undefined,
      });
      return parseJsonResponse<T>(fallback);
    }
  }

  private async request(body: Record<string, unknown>): Promise<OpenRouterResponse> {
    const transport = shouldUseSubllm()
      ? await this.subllmTransport()
      : this.directOpenRouterTransport();
    const requestBody = providerRequestBody(body, transport);
    const timeoutDecision = openRouterRequestTimeout(requestBody, this.config.timeoutMs);
    const controller = new AbortController();
    const externalSignal = this.config.signal;
    const abortFromExternal = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
    if (externalSignal?.aborted) controller.abort();
    const timeout = setTimeout(() => controller.abort(), timeoutDecision.effectiveTimeoutMs);
    try {
      if (externalSignal?.aborted) throw new Error(`${transport.providerLabel} request aborted by pipeline deadline`);
      return await this.requestWithRetries(
        requestBody,
        transport,
        controller.signal,
        externalSignal,
        timeoutDecision,
      );
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    }
  }

  private async requestWithRetries(
    body: Record<string, unknown>,
    transport: LlmTransport,
    signal: AbortSignal,
    externalSignal: AbortSignal | undefined,
    timeoutDecision: OpenRouterTimeoutDecision,
  ): Promise<OpenRouterResponse> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.requestAttempt(body, transport, signal);
      } catch (caught) {
        const error = normalizeRequestError(caught, externalSignal, timeoutDecision, transport.providerLabel);
        lastError = error;
        if (!shouldRetryRequest(error, attempt)) throw error;
        await waitForRetry(
          300 * (2 ** attempt), signal, externalSignal, timeoutDecision, transport.providerLabel,
        );
      }
    }
    throw lastError ?? new Error(`${transport.providerLabel} request failed`);
  }

  private async requestAttempt(
    body: Record<string, unknown>,
    transport: LlmTransport,
    signal: AbortSignal,
  ): Promise<OpenRouterResponse> {
    const headers: Record<string, string> = {
      ...transport.headers,
      Authorization: `Bearer ${transport.credential}`,
      'Content-Type': 'application/json',
    };
    const response = await fetch(`${transport.apiBase}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
    const text = await response.text();
    const parsed = parseProviderResponse(text, response.status, transport.credential, transport.providerLabel);
    if (response.ok && !parsed.error) {
      parsed.provider ??= transport.provider;
      return parsed;
    }

    const message = redactProviderFailureText(parsed.error?.message ?? text.slice(0, 500), transport.credential);
    const error = new Error(`${transport.providerLabel} HTTP ${response.status}: ${message}`);
    if (!isInvalidModelError(response.status, message)) throw error;
    throw await this.invalidModelError(error, body.model, transport.providerLabel);
  }

  private async transport(): Promise<LlmTransport> {
    if (shouldUseSubllm()) {
      return this.subllmTransport();
    }
    return this.directOpenRouterTransport();
  }

  private async subllmTransport(): Promise<LlmTransport> {
    this.resolvedSubllm ??= resolveSubllmRoute();
    const { route, credential } = await this.resolvedSubllm;
    return {
      provider: route.provider,
      providerLabel: route.provider === 'zai' ? 'Z.AI' : 'OpenRouter',
      apiBase: route.api_base,
      credential,
      wireModel: route.wire_model,
      application: route.application,
      function: route.function,
      headers: { ...route.extra_headers },
      subllm: true,
    };
  }

  private directOpenRouterTransport(): LlmTransport {
    const credential = this.config.apiKey;
    if (!credential) throw new Error('OPENROUTER_API_KEY is required for this operation');
    const headers: Record<string, string> = { 'X-OpenRouter-Title': this.config.appName };
    if (this.config.siteUrl) headers['HTTP-Referer'] = this.config.siteUrl;
    return {
      provider: 'openrouter',
      providerLabel: 'OpenRouter',
      apiBase: this.config.baseUrl,
      credential,
      wireModel: null,
      application: null,
      function: null,
      headers,
      subllm: false,
    };
  }

  private async invalidModelError(
    error: Error,
    configuredModel: unknown,
    providerLabel: LlmTransport['providerLabel'],
  ): Promise<OpenRouterModelError> {
    const model = typeof configuredModel === 'string' ? configuredModel : '(unknown)';
    try {
      const availableModels = await this.listAvailableModels();
      return new OpenRouterModelError(
        formatInvalidModelError(error.message, availableModels, providerLabel),
        model,
        availableModels,
      );
    } catch (listError) {
      return new OpenRouterModelError(
        `${error.message}\nAvailable ${providerLabel} models could not be fetched: ${listError instanceof Error ? listError.message : String(listError)}`,
        model,
        [],
      );
    }
  }
}

function providerRequestBody(body: Record<string, unknown>, transport: LlmTransport): Record<string, unknown> {
  const prepared: Record<string, unknown> = {
    ...body,
    model: transport.wireModel ?? body.model,
  };
  if (!transport.subllm) return removeUndefined(prepared) as Record<string, unknown>;
  if (transport.provider === 'openrouter') {
    return removeUndefined({ ...prepared, user: transport.application }) as Record<string, unknown>;
  }

  const responseFormat = isRecord(prepared.response_format) ? prepared.response_format : null;
  const jsonSchema = responseFormat?.type === 'json_schema' && isRecord(responseFormat.json_schema)
    ? responseFormat.json_schema.schema
    : null;
  const messages = Array.isArray(prepared.messages) ? [...prepared.messages] : prepared.messages;
  if (jsonSchema && Array.isArray(messages)) {
    messages.unshift({
      role: 'system',
      content: 'Return exactly one JSON object matching this JSON Schema. '
        + `Do not add Markdown fences or prose: ${JSON.stringify(jsonSchema)}`,
    });
  }
  const requestId = `${transport.application}-${transport.function}-${randomUUID().replaceAll('-', '')}`;
  return removeUndefined({
    ...prepared,
    messages,
    response_format: jsonSchema ? { type: 'json_object' } : prepared.response_format,
    provider: undefined,
    plugins: undefined,
    request_id: requestId,
    user_id: transport.application,
  }) as Record<string, unknown>;
}

function normalizeRequestError(
  caught: unknown,
  externalSignal: AbortSignal | undefined,
  timeoutDecision: OpenRouterTimeoutDecision,
  providerLabel: string,
): Error {
  const error = caught instanceof Error ? caught : new Error(String(caught));
  if (error.name !== 'AbortError') return error;
  if (externalSignal?.aborted) return new Error(`${providerLabel} request aborted by pipeline deadline`);
  return new Error(
    `${providerLabel} request timed out after ${timeoutDecision.effectiveTimeoutMs} ms `
    + `(base ${timeoutDecision.baseTimeoutMs} ms, adaptive ${timeoutDecision.multiplier}x${timeoutDecision.capped ? ', capped' : ''})`,
  );
}

function shouldRetryRequest(error: Error, attempt: number): boolean {
  if (attempt >= 2) return false;
  return /(?:OpenRouter|Z\.AI) HTTP (?:429|5\d\d):|fetch failed|ECONNRESET|ETIMEDOUT/i.test(error.message);
}

async function waitForRetry(
  milliseconds: number,
  signal: AbortSignal,
  externalSignal: AbortSignal | undefined,
  timeoutDecision: OpenRouterTimeoutDecision,
  providerLabel: string,
): Promise<void> {
  try {
    await sleep(milliseconds, signal);
  } catch (error) {
    throw normalizeRequestError(error, externalSignal, timeoutDecision, providerLabel);
  }
}

function shouldRetryWithoutJsonSchema(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /OpenRouter HTTP 4\d\d:|OpenRouter returned non-JSON|response does not contain choices|returned invalid JSON/i.test(error.message);
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, removeUndefined(item)]));
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException('aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new DOMException('aborted', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
