import { statSync } from 'node:fs';
import path from 'node:path';
import { credentialFromSharedFile, runSubllm } from './subllm-process.js';

const APPLICATION = 'todo2code';
const FUNCTION = 'semantic';
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export interface SubllmPublicRoute {
  application: string;
  application_name: string;
  application_url: string;
  function: string;
  provider: 'zai' | 'openrouter';
  model: string;
  priority: number;
  api_base: string;
  api_key_env: string;
  litellm_model: string;
  wire_model: string;
  extra_headers: Record<string, string>;
}

export interface ResolvedSubllmRoute {
  route: SubllmPublicRoute;
  credential: string;
}

let lastPublicRoute: SubllmPublicRoute | null = null;

export function lastResolvedSubllmRoute(): SubllmPublicRoute | null {
  return lastPublicRoute;
}

export function shouldUseSubllm(
  environment: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): boolean {
  const explicit = environment.T2C_USE_SUBLLM?.trim().toLowerCase();
  if (explicit && FALSE_VALUES.has(explicit)) return false;
  if (explicit && !TRUE_VALUES.has(explicit)) {
    throw new Error('T2C_USE_SUBLLM must be true or false');
  }
  if (explicit) return true;
  if (environment.SUBLLM_ENV_FILE || environment.SUBLLM_POLICY_FILE || environment.SUBLLM_PYTHONPATH) {
    return true;
  }
  return Boolean(localSubllmPythonPath(cwd));
}

export async function resolveSubllmRoute(
  environment: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): Promise<ResolvedSubllmRoute> {
  const commandEnvironment = subllmCommandEnvironment(environment, cwd);
  const python = environment.SUBLLM_PYTHON?.trim() || 'python3';
  const routeOutput = await runSubllm(
    python,
    ['-m', 'subllm.cli', 'resolve', APPLICATION, FUNCTION],
    commandEnvironment,
    cwd,
  );
  const route = parsePublicRoute(routeOutput);
  const credential = environment[route.api_key_env]?.trim()
    || await credentialFromSharedFile(python, route.api_key_env, commandEnvironment, cwd);
  if (!credential) throw new Error(`SubLLM selected ${route.provider} without a usable ${route.api_key_env}`);
  if (route.provider === 'zai' && credential.split('.').length !== 2) {
    throw new Error('SubLLM returned an invalid Z.AI credential binding');
  }
  lastPublicRoute = route;
  return { route, credential };
}

function localSubllmPythonPath(cwd: string): string | null {
  const candidate = path.join(path.resolve(cwd), 'subllm', 'src');
  try {
    return requireFile(path.join(candidate, 'subllm', '__init__.py')) ? candidate : null;
  } catch {
    return null;
  }
}

function requireFile(candidate: string): boolean {
  try {
    const stat = statSync(candidate);
    return stat.isFile();
  } catch {
    return false;
  }
}

function subllmCommandEnvironment(environment: NodeJS.ProcessEnv, cwd: string): NodeJS.ProcessEnv {
  const pythonPath = environment.SUBLLM_PYTHONPATH?.trim() || localSubllmPythonPath(cwd);
  const inherited = environment.PYTHONPATH?.trim();
  const commandEnvironment: NodeJS.ProcessEnv = {};
  for (const name of [
    'HOME', 'LANG', 'LC_ALL', 'OPENROUTER_API_KEY', 'PATH', 'SUBLLM_ENV_FILE',
    'SUBLLM_POLICY_FILE', 'SYSTEMROOT', 'TMPDIR', 'ZAI_API_KEY',
  ]) {
    if (environment[name] !== undefined) commandEnvironment[name] = environment[name];
  }
  const resolvedPythonPath = pythonPath
    ? (inherited ? `${pythonPath}${path.delimiter}${inherited}` : pythonPath)
    : inherited;
  if (resolvedPythonPath) commandEnvironment.PYTHONPATH = resolvedPythonPath;
  return commandEnvironment;
}

function parsePublicRoute(output: string): SubllmPublicRoute {
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    throw new Error('SubLLM route resolution returned invalid JSON');
  }
  if (!isRecord(value)) throw new Error('SubLLM route resolution returned a non-object');
  const route = value as Record<string, unknown>;
  const provider = requiredString(route, 'provider');
  const extraHeaders = route.extra_headers;
  if (provider !== 'zai' && provider !== 'openrouter') {
    throw new Error(`SubLLM returned unsupported provider ${provider}`);
  }
  if (!isRecord(extraHeaders) || Object.values(extraHeaders).some((item) => typeof item !== 'string')) {
    throw new Error('SubLLM returned invalid attribution headers');
  }
  const parsed: SubllmPublicRoute = {
    application: requiredString(route, 'application'),
    application_name: requiredString(route, 'application_name'),
    application_url: requiredString(route, 'application_url'),
    function: requiredString(route, 'function'),
    provider,
    model: requiredString(route, 'model'),
    priority: requiredNumber(route, 'priority'),
    api_base: requiredHttpsUrl(route, 'api_base'),
    api_key_env: requiredEnvName(route, 'api_key_env'),
    litellm_model: requiredString(route, 'litellm_model'),
    wire_model: requiredString(route, 'wire_model'),
    extra_headers: Object.fromEntries(Object.entries(extraHeaders) as Array<[string, string]>),
  };
  if (parsed.application !== APPLICATION || parsed.function !== FUNCTION) {
    throw new Error('SubLLM returned a route for a different application or function');
  }
  return parsed;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`SubLLM route has invalid ${key}`);
  return value.trim();
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`SubLLM route has invalid ${key}`);
  return value;
}

function requiredHttpsUrl(record: Record<string, unknown>, key: string): string {
  const value = requiredString(record, key).replace(/\/$/u, '');
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`SubLLM route has invalid ${key}`);
  }
  return value;
}

function requiredEnvName(record: Record<string, unknown>, key: string): string {
  const value = requiredString(record, key);
  if (!/^[A-Z_][A-Z0-9_]*$/u.test(value)) throw new Error(`SubLLM route has invalid ${key}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
