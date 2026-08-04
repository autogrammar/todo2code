interface ParsedOpenRouterResponse {
  parsed: OpenRouterResponse;
  text: string;
}

interface OpenRouterChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

export interface OpenRouterResponse {
  id?: string;
  model?: string;
  provider?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  choices?: OpenRouterChoice[];
  error?: { message?: string };
}

export interface OpenRouterRequestContext {
  apiKey: string;
  baseUrl: string;
  appName: string;
  timeoutMs: number;
  siteUrl?: string;
  signal?: AbortSignal;
}

type RequestAction =
  | { action: 'success' }
  | { action: 'retry'; retryAfterMs: number; error: Error }
  | { action: 'fail'; error: Error };

export async function requestOpenRouter(
  context: OpenRouterRequestContext,
  body: Record<string, unknown>,
  listAvailableModels: () => Promise<string[]>,
  createModelError: (message: string, model: string, availableModels: string[]) => Error,
): Promise<OpenRouterResponse> {
  const { apiKey, timeoutMs } = context;
  ensureApiKeyConfigured(apiKey);

  const controller = new AbortController();
  const detachAbort = connectAbortSignal(controller, context.signal);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await sendRequest(context, body, controller);
        const parsed = await parseResponse(response);
        const resolution = await resolveHttpResponse(
          response,
          parsed,
          body,
          attempt,
          listAvailableModels,
          createModelError,
        );
        if (resolution.action === 'retry') {
          lastError = resolution.error;
          await sleep(resolution.retryAfterMs);
          continue;
        }
        if (resolution.action === 'fail') throw resolution.error;
        return parsed;
      } catch (error) {
        const resolution = resolveTransportError(error, attempt, timeoutMs, context.signal);
        if (resolution.action === 'retry') {
          lastError = resolution.error;
          await sleep(resolution.retryAfterMs);
          continue;
        }
        lastError = resolution.error;
        throw lastError;
      }
    }
    throw lastError ?? new Error('OpenRouter request failed');
  } finally {
    clearTimeout(timeout);
    detachAbort();
  }
}

function ensureApiKeyConfigured(apiKey: string): void {
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for this operation');
}

function connectAbortSignal(controller: AbortController, externalSignal?: AbortSignal): () => void {
  const abortFromExternal = () => controller.abort();
  if (externalSignal) externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  if (externalSignal?.aborted) controller.abort();
  return () => externalSignal?.removeEventListener('abort', abortFromExternal);
}

function sendRequest(
  context: OpenRouterRequestContext,
  body: Record<string, unknown>,
  controller: AbortController,
): Promise<Response> {
  return fetch(`${context.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: buildRequestHeaders(context),
    body: JSON.stringify(removeUndefined(body)),
    signal: controller.signal,
  });
}

async function resolveHttpResponse(
  response: Response,
  parsed: ParsedOpenRouterResponse,
  body: Record<string, unknown>,
  attempt: number,
  listAvailableModels: () => Promise<string[]>,
  createModelError: (message: string, model: string, availableModels: string[]) => Error,
): Promise<RequestAction> {
  if (response.ok && !parsed.error) return { action: 'success' };

  const message = parsed.error?.message ?? parsed.text.slice(0, 500);
  const error = new Error(`OpenRouter HTTP ${response.status}: ${message}`);

  if (isInvalidModelError(response.status, message)) {
    return createModelErrorResponse(
      error.message,
      body,
      listAvailableModels,
      createModelError,
    );
  }

  if (isRetryableServerError(response.status) && attempt < 2) {
    return { action: 'retry', retryAfterMs: retryDelay(attempt), error };
  }

  return { action: 'fail', error };
}

async function createModelErrorResponse(
  message: string,
  body: Record<string, unknown>,
  listAvailableModels: () => Promise<string[]>,
  createModelError: (message: string, model: string, availableModels: string[]) => Error,
): Promise<RequestAction> {
  const model = typeof body.model === 'string' ? body.model : '(unknown)';
  try {
    const availableModels = await listAvailableModels();
    return { action: 'fail', error: createModelError(message, model, availableModels) };
  } catch (listError) {
    const listErrorMessage = listError instanceof Error ? listError.message : String(listError);
    return {
      action: 'fail',
      error: createModelError(
        `${message}\nAvailable OpenRouter models could not be fetched: ${listErrorMessage}`,
        model,
        [],
      ),
    };
  }
}

function resolveTransportError(
  error: unknown,
  attempt: number,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): RequestAction {
  if (error instanceof Error && error.name === 'AbortError') {
    if (externalSignal?.aborted) return { action: 'fail', error: new Error('OpenRouter request aborted by pipeline deadline') };
    return { action: 'fail', error: new Error(`OpenRouter request timed out after ${timeoutMs} ms`) };
  }

  if (error instanceof Error && isTransientNetworkError(error.message) && attempt < 2) {
    return { action: 'retry', retryAfterMs: retryDelay(attempt), error };
  }
  return { action: 'fail', error: error instanceof Error ? error : new Error(String(error)) };
}

function retryDelay(attempt: number): number {
  return 300 * (2 ** attempt);
}

function buildRequestHeaders(context: OpenRouterRequestContext): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.apiKey}`,
    'Content-Type': 'application/json',
    'X-OpenRouter-Title': context.appName,
  };
  if (context.siteUrl) headers['HTTP-Referer'] = context.siteUrl;
  return headers;
}

function shouldRetryWithoutJsonSchema(error: Error): boolean {
  return /OpenRouter HTTP 4\d\d:|returned non-JSON|response does not contain choices|returned invalid JSON/i.test(error.message);
}

export function shouldRetryRequestWithoutSchema(error: unknown): boolean {
  return error instanceof Error && shouldRetryWithoutJsonSchema(error);
}

function isRetryableServerError(status: number): boolean {
  return status >= 500 || status === 429;
}

function isTransientNetworkError(message: string): boolean {
  return /fetch failed|ECONNRESET|ETIMEDOUT/i.test(message);
}

function isInvalidModelError(status: number, message: string): boolean {
  return status === 400 && /(?:not a valid model ID|invalid model(?: ID)?|model ID .*not found)/i.test(message);
}

async function parseResponse(response: Response): Promise<ParsedOpenRouterResponse> {
  const text = await response.text();
  try {
    return { parsed: JSON.parse(text) as OpenRouterResponse, text };
  } catch {
    throw new Error(`OpenRouter returned non-JSON HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefined(item)]),
    );
  }
  return value;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
