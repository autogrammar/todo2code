import { sha256, stableStringify } from '../core/id.js';
import type { GroundedGenerationMetadata, TodoPriority } from '../core/types.js';
import { T2C_VERSION } from '../version.js';

export const IMPLEMENTATION_DIAGNOSTIC_CODES = new Set([
  'PLANNED_NOT_IMPLEMENTED',
  'CHANGELOG_WITHOUT_IMPLEMENTATION',
]);

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].sort();
}

export function deterministicGeneration(generatedAt: string, generator: string): GroundedGenerationMetadata {
  return {
    generator,
    generatorVersion: '1',
    runtimeVersion: T2C_VERSION,
    generatedAt,
    requestedMode: 'deterministic',
    effectiveMode: 'deterministic',
    degraded: false,
    model: null,
    provider: null,
    responseId: null,
    configurationFingerprint: sha256(stableStringify({
      generator,
      generatorVersion: '1',
      codes: [...IMPLEMENTATION_DIAGNOSTIC_CODES].sort(),
    })),
    reason: null,
  };
}

export function priorityRank(priority: TodoPriority): number {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 } as const)[priority];
}

export function inline(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function renderIds(ids: string[]): string {
  return ids.length ? ids.map((id) => `\`${id}\``).join(', ') : '_none_';
}

export function exactSourcePatchKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${name} keys must be exactly: ${wanted.join(', ')}`);
  }
}

export function assertSourcePatchIds(value: unknown, pattern: RegExp, name: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0
    || value.some((item) => typeof item !== 'string' || !pattern.test(item))) {
    throw new Error(`Source patch ${name} must be a non-empty array of valid IDs`);
  }
  if (new Set(value).size !== value.length) throw new Error(`Source patch ${name} must be unique`);
}

export function assertSourcePatchStrings(value: unknown, name: string, emptyAllowed: boolean): asserts value is string[] {
  if (!Array.isArray(value) || (!emptyAllowed && value.length === 0)
    || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`Source patch ${name} must contain ${emptyAllowed ? 'only ' : ''}non-blank strings`);
  }
  if (new Set(value).size !== value.length) throw new Error(`Source patch ${name} must be unique`);
}

export function exactSourcePatchSet(actual: string[], expected: string[], name: string): void {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  if (left.length !== right.length || left.some((item, index) => item !== right[index])) {
    throw new Error(`Source patch ${name} do not match the plan`);
  }
}

/**
 * Validate a single-file unified diff body.
 * Accepts optional `--- a/path` / `+++ b/path` headers and rejects foreign paths.
 */
export function normalizeUnifiedDiff(diff: string, expectedPath: string): string {
  const normalized = diff.replace(/\r\n/g, '\n');
  if (!normalized.trim()) throw new Error(`Unified diff for ${expectedPath} is empty`);
  if (normalized.includes('\0')) throw new Error(`Unified diff for ${expectedPath} contains NUL bytes`);
  if (/(?:api[_-]?key|secret|password|private[_-]?key)\s*[:=]\s*['"]?[^'"\s]{8,}/i.test(normalized)) {
    throw new Error(`Unified diff for ${expectedPath} appears to contain a secret assignment`);
  }
  const headers = [...normalized.matchAll(/^(?:---|\+\+\+)\s+(?:[ab]\/)?(.+)$/gm)].map((match) => match[1]!.trim());
  for (const header of headers) {
    if (header === '/dev/null') continue;
    const path = header.replace(/\\/g, '/');
    if (path.startsWith('/') || path.split('/').includes('..')) {
      throw new Error(`Unified diff for ${expectedPath} uses a non-repository path header: ${path}`);
    }
    if (path !== expectedPath && path !== `a/${expectedPath}` && path !== `b/${expectedPath}`) {
      const bare = path.split('\t')[0] ?? path;
      const stripped = bare.replace(/^[ab]\//, '');
      if (stripped !== expectedPath) {
        throw new Error(`Unified diff for ${expectedPath} references foreign path: ${path}`);
      }
    }
  }
  return normalized;
}

export function splitKeep(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return lines;
}
