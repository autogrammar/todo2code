import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathExists } from '../core/io.js';

export interface T2CConfig {
  root: string;
  outputDir: string;
  gitCommitCount: number;
  maxFileBytes: number;
  pythonExecutable: string;
  enablePythonAst: boolean;
  allowOutsideRoot: boolean;
  enableTensorFlow: boolean;
  tensorflowModelPath: string | null;
  tensorflowLabels: string[];
  documentPatterns: string[];
  documentExcludes: string[];
  openRouter: {
    apiKey: string | null;
    baseUrl: string;
    model: string;
    documentModel: string;
    summaryModel: string;
    siteUrl: string | null;
    appName: string;
    timeoutMs: number;
    maxTokens: number;
    temperature: number;
    requireStructuredOutput: boolean;
    responseHealing: boolean;
  };
  mcp: {
    serverName: string;
    serverVersion: string;
  };
  a2a: {
    host: string;
    port: number;
    publicUrl: string;
    token: string | null;
    maxBodyBytes: number;
  };
}

let loadedEnvPath: string | null = null;

export async function loadEnvFile(startDirectory = process.cwd()): Promise<string | null> {
  const explicit = process.env.T2C_ENV_FILE;
  const candidates = explicit
    ? [path.resolve(startDirectory, explicit)]
    : [path.resolve(startDirectory, '.env'), path.resolve(process.cwd(), '.env')];

  for (const candidate of [...new Set(candidates)]) {
    if (!(await pathExists(candidate))) continue;
    const content = await fs.readFile(candidate, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
    loadedEnvPath = candidate;
    return candidate;
  }
  return null;
}

function envString(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function envOptional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function envNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return value;
}

function envBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  throw new Error(`${name} must be true or false`);
}

function envList(name: string, fallback: string[]): string[] {
  const raw = process.env[name]?.trim();
  return raw ? raw.split(',').map((value) => value.trim()).filter(Boolean) : fallback;
}

export function getConfig(cwd = process.cwd()): T2CConfig {
  const model = envString('OPENROUTER_MODEL', 'openrouter/auto-beta');
  const root = path.resolve(cwd, envString('T2C_ROOT', '.'));
  return {
    root,
    outputDir: envString('T2C_OUTPUT_DIR', '.intent'),
    gitCommitCount: envNumber('T2C_GIT_COMMIT_COUNT', 10, 1, 100),
    maxFileBytes: envNumber('T2C_MAX_FILE_BYTES', 524_288, 1024, 100 * 1024 * 1024),
    pythonExecutable: envString('T2C_PYTHON', 'python3'),
    enablePythonAst: envBoolean('T2C_ENABLE_PYTHON_AST', true),
    allowOutsideRoot: envBoolean('T2C_ALLOW_OUTSIDE_ROOT', false),
    enableTensorFlow: envBoolean('T2C_ENABLE_TF', false),
    tensorflowModelPath: envOptional('T2C_TF_MODEL_PATH'),
    tensorflowLabels: envList('T2C_TF_LABELS', ['add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'unknown']),
    documentPatterns: envList('T2C_DOC_PATTERNS', ['README.md', 'docs/**/*.md', 'project/**/*.md', 'packages/**/MODULE.md']),
    documentExcludes: envList('T2C_DOC_EXCLUDES', ['node_modules/**', '.git/**', 'dist/**', '.intent/**', 'TODO.md', 'CHANGELOG.md']),
    openRouter: {
      apiKey: envOptional('OPENROUTER_API_KEY'),
      baseUrl: envString('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
      model,
      documentModel: envString('OPENROUTER_DOC_MODEL', model),
      summaryModel: envString('OPENROUTER_SUMMARY_MODEL', model),
      siteUrl: envOptional('OPENROUTER_SITE_URL'),
      appName: envString('OPENROUTER_APP_NAME', 'todo2code'),
      timeoutMs: envNumber('OPENROUTER_TIMEOUT_MS', 120_000, 1000, 600_000),
      maxTokens: envNumber('OPENROUTER_MAX_TOKENS', 6000, 128, 100_000),
      temperature: envNumber('OPENROUTER_TEMPERATURE', 0, 0, 2),
      requireStructuredOutput: envBoolean('OPENROUTER_REQUIRE_STRUCTURED_OUTPUT', true),
      responseHealing: envBoolean('OPENROUTER_RESPONSE_HEALING', true),
    },
    mcp: {
      serverName: envString('T2C_MCP_SERVER_NAME', 'todo2code'),
      serverVersion: envString('T2C_MCP_SERVER_VERSION', '0.1.0'),
    },
    a2a: {
      host: envString('T2C_A2A_HOST', '0.0.0.0'),
      port: envNumber('T2C_A2A_PORT', 8787, 1, 65_535),
      publicUrl: envString('T2C_A2A_PUBLIC_URL', 'http://localhost:8787/a2a'),
      token: envOptional('T2C_A2A_TOKEN'),
      maxBodyBytes: envNumber('T2C_A2A_MAX_BODY_BYTES', 1_048_576, 1024, 32 * 1024 * 1024),
    },
  };
}

export function configForDisplay(config: T2CConfig): Record<string, unknown> {
  return {
    ...config,
    openRouter: {
      ...config.openRouter,
      apiKey: config.openRouter.apiKey ? '[configured]' : null,
    },
    a2a: {
      ...config.a2a,
      token: config.a2a.token ? '[configured]' : null,
    },
    envFile: loadedEnvPath,
  };
}

export function hasOpenRouter(config: T2CConfig): boolean {
  return Boolean(config.openRouter.apiKey);
}
