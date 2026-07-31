import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathExists } from '../core/io.js';
import type { LlmExtractionMode, NlExtractionMode } from '../core/types.js';
import { T2C_VERSION } from '../version.js';

export interface T2CConfig {
  root: string;
  outputDir: string;
  /** Programmatic escape hatch; CLI runs keep the transparent cache enabled. */
  cacheEnabled?: boolean;
  gitCommitCount: number;
  maxFileBytes: number;
  documentConcurrency: number;
  documentChunkChars: number;
  documentMaxChunks: number;
  documentRecordsPerChunk: number;
  documentTimeoutMs: number;
  pythonExecutable: string;
  enablePythonAst: boolean;
  goExecutable: string;
  enableGoAst: boolean;
  javaExecutable: string;
  enableJavaAst: boolean;
  cargoExecutable: string;
  enableRustAst: boolean;
  allowOutsideRoot: boolean;
  enableTensorFlow: boolean;
  tensorflowModelPath: string | null;
  tensorflowModulePath: string;
  tensorflowLabels: string[];
  documentPatterns: string[];
  documentExcludes: string[];
  nlMode: NlExtractionMode;
  markdownMode: LlmExtractionMode;
  communicationMode: LlmExtractionMode;
  openRouter: {
    apiKey: string | null;
    baseUrl: string;
    model: string;
    nlModel: string;
    markdownModel: string;
    communicationModel: string;
    documentModel: string;
    summaryModel: string;
    taskModel: string;
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
    taskStorePath: string | null;
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

function envLlmMode(name: string, fallback: LlmExtractionMode): LlmExtractionMode {
  const value = envString(name, fallback).toLowerCase();
  if (value === 'deterministic' || value === 'prefer-llm' || value === 'require-llm') return value;
  throw new Error(`${name} must be deterministic, prefer-llm or require-llm`);
}

export function getConfig(cwd = process.cwd()): T2CConfig {
  const model = envString('OPENROUTER_MODEL', 'google/gemini-3.6-flash');
  const root = path.resolve(cwd, envString('T2C_ROOT', '.'));
  return {
    root,
    outputDir: envString('T2C_OUTPUT_DIR', '.intent'),
    cacheEnabled: true,
    gitCommitCount: envNumber('T2C_GIT_COMMIT_COUNT', 10, 1, 100),
    maxFileBytes: envNumber('T2C_MAX_FILE_BYTES', 524_288, 1024, 100 * 1024 * 1024),
    documentConcurrency: envNumber('T2C_DOC_CONCURRENCY', 3, 1, 16),
    documentChunkChars: envNumber('T2C_DOC_CHUNK_CHARS', 8000, 512, 100_000),
    documentMaxChunks: envNumber('T2C_DOC_MAX_CHUNKS', 12, 1, 1000),
    documentRecordsPerChunk: envNumber('T2C_DOC_MAX_RECORDS_PER_CHUNK', 24, 1, 200),
    documentTimeoutMs: envNumber('T2C_DOC_TIMEOUT_MS', 45_000, 1000, 600_000),
    pythonExecutable: envString('T2C_PYTHON', 'python3'),
    enablePythonAst: envBoolean('T2C_ENABLE_PYTHON_AST', true),
    goExecutable: envString('T2C_GO', 'go'),
    enableGoAst: envBoolean('T2C_ENABLE_GO_AST', true),
    javaExecutable: envString('T2C_JAVA', 'java'),
    enableJavaAst: envBoolean('T2C_ENABLE_JAVA_AST', true),
    cargoExecutable: envString('T2C_CARGO', 'cargo'),
    enableRustAst: envBoolean('T2C_ENABLE_RUST_AST', true),
    allowOutsideRoot: envBoolean('T2C_ALLOW_OUTSIDE_ROOT', false),
    enableTensorFlow: envBoolean('T2C_ENABLE_TF', false),
    tensorflowModelPath: envOptional('T2C_TF_MODEL_PATH'),
    tensorflowModulePath: envString('T2C_TF_MODULE_PATH', 'adapters/tensorflow/node_modules/@tensorflow/tfjs-node/dist/index.js'),
    tensorflowLabels: envList('T2C_TF_LABELS', ['add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'unknown']),
    documentPatterns: envList('T2C_DOC_PATTERNS', ['README.md', 'docs/**/*.md', 'project/**/*.md', 'packages/**/MODULE.md']),
    documentExcludes: envList('T2C_DOC_EXCLUDES', ['node_modules/**', '.git/**', 'dist/**', '.intent/**', 'TODO.md', 'CHANGELOG.md']),
    nlMode: envLlmMode('T2C_NL_MODE', 'prefer-llm'),
    markdownMode: envLlmMode('T2C_MARKDOWN_MODE', 'prefer-llm'),
    communicationMode: envLlmMode('T2C_COMMUNICATION_MODE', 'deterministic'),
    openRouter: {
      apiKey: envOptional('OPENROUTER_API_KEY'),
      baseUrl: envString('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
      model,
      nlModel: envString('OPENROUTER_NL_MODEL', model),
      markdownModel: envString('OPENROUTER_MARKDOWN_MODEL', model),
      communicationModel: envString('OPENROUTER_COMMUNICATION_MODEL', model),
      documentModel: envString('OPENROUTER_DOC_MODEL', model),
      summaryModel: envString('OPENROUTER_SUMMARY_MODEL', model),
      taskModel: envString('OPENROUTER_TASK_MODEL', model),
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
      serverVersion: envString('T2C_MCP_SERVER_VERSION', T2C_VERSION),
    },
    a2a: {
      host: envString('T2C_A2A_HOST', '0.0.0.0'),
      port: envNumber('T2C_A2A_PORT', 8787, 1, 65_535),
      publicUrl: envString('T2C_A2A_PUBLIC_URL', 'http://localhost:8787/a2a'),
      token: envOptional('T2C_A2A_TOKEN'),
      maxBodyBytes: envNumber('T2C_A2A_MAX_BODY_BYTES', 1_048_576, 1024, 32 * 1024 * 1024),
      taskStorePath: envOptional('T2C_A2A_TASK_STORE'),
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
