import type { IntentTarget } from './types.js';

const GENERIC_SYMBOLS = new Set(['call', 'get', 'main', 'new', 'run', 'set', 'test']);
const GENERIC_FILES = new Set(['index.js', 'index.ts', 'lib.rs', 'main.go', 'main.rs']);

export function normalizeTarget(target: Partial<IntentTarget> | undefined): IntentTarget {
  return {
    paths: unique(target?.paths ?? [], normalizePath),
    symbols: unique(target?.symbols ?? [], normalizeSymbol),
    tickets: unique(target?.tickets ?? [], (value) => value.trim().replace(/\s+/g, '-').toUpperCase()),
    versions: unique(target?.versions ?? [], (value) => value.trim()),
  };
}

export function normalizePath(value: string): string {
  return value.trim()
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '');
}

export function normalizeSymbol(value: string): string {
  return value.trim()
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/::/g, '.')
    .replace(/#/g, '.')
    .replace(/\([^)]*\)$/, '')
    .replace(/<[^<>]*>/g, '')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');
}

export function symbolAliases(value: string): string[] {
  const normalized = normalizeSymbol(value).toLowerCase();
  if (!normalized) return [];
  const parts = normalized.split('.').filter(Boolean);
  const aliases = [normalized];
  if (parts.length > 1) aliases.push(parts.slice(-2).join('.'));
  const leaf = parts.at(-1);
  if (leaf && leaf.length >= 3 && !GENERIC_SYMBOLS.has(leaf)) aliases.push(leaf);
  return [...new Set(aliases)];
}

export function pathAliases(value: string): string[] {
  const normalized = normalizePath(value).toLowerCase();
  if (!normalized) return [];
  const aliases = [normalized];
  const basename = normalized.split('/').at(-1);
  if (basename && basename.includes('.') && !GENERIC_FILES.has(basename)) aliases.push(basename);
  return [...new Set(aliases)];
}

function unique(values: string[], normalize: (value: string) => string): string[] {
  return [...new Set(values.map(normalize).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
