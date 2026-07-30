import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { loadIgnoreMatcher } from '../core/ignore.js';
import { readText, relativePosix, walkFiles } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import type { ExtractionResult, IntentRecord } from '../core/types.js';

const MAX_ENTRIES_PER_FILE = 100;

/** Deterministic repository configuration/infrastructure -> Intent DSL. */
export async function extractConfigurationIntent(rootInput: string, config: T2CConfig): Promise<ExtractionResult> {
  const root = path.resolve(rootInput);
  const matcher = await loadIgnoreMatcher(root);
  const discovered = await walkFiles(root, { maxFiles: 20_000, matcher });
  const files = discovered.filter((file) => isConfigurationPath(relativePosix(root, file)));
  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  for (const file of files) {
    const relative = relativePosix(root, file);
    try {
      const body = await readText(file, config.maxFileBytes);
      records.push(...configurationRecords(relative, body));
    } catch (error) {
      warnings.push(`${relative}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { records, warnings };
}

function isConfigurationPath(relative: string): boolean {
  const base = path.posix.basename(relative).toLowerCase();
  if (/^dockerfile(?:\..+)?$/.test(base) || /^compose(?:\..+)?\.ya?ml$/.test(base)) return true;
  if (/^(package|tsconfig(?:\..+)?|jsconfig|deno|composer)\.json$/.test(base)) return true;
  if (/^(pyproject|cargo|ruff|taplo)\.toml$/.test(base)) return true;
  if (/^(makefile|justfile|go\.mod|\.env\.example)$/.test(base)) return true;
  if (/^\.github\/workflows\/.*\.ya?ml$/i.test(relative)) return true;
  if (/^(?:config|infra|deploy|deployment)\//i.test(relative) && /\.(?:json|ya?ml|toml)$/i.test(relative)) return true;
  return /(?:^|\.)config\.(?:json|ya?ml|toml)$/i.test(base);
}

function configurationRecords(sourcePath: string, body: string): IntentRecord[] {
  const base = path.posix.basename(sourcePath).toLowerCase();
  const entries = base.startsWith('dockerfile')
    ? dockerEntries(body)
    : base.endsWith('.json')
      ? jsonEntries(body)
      : base.endsWith('.toml')
        ? tomlEntries(body)
        : yamlOrAssignmentEntries(body);
  return entries.slice(0, MAX_ENTRIES_PER_FILE).map((entry) => buildRecord({
    kind: 'configuration_declaration',
    action: entry.action,
    object: entry.key,
    target: { paths: [sourcePath], symbols: [entry.key] },
    modality: 'observed',
    text: entry.text,
    lifecycle: 'implemented',
    sourceKind: 'system',
    sourcePath,
    sourceLines: { start: entry.line, end: entry.line },
    symbol: entry.key,
    extractor: 't2c/configuration-structural@1',
    rawExcerpt: entry.text,
    epistemicClass: 'fact',
    confidence: 0.98,
    basis: ['deterministic_configuration_structure', entry.basis],
    metadata: { format: entry.format, llmUsed: false },
  }));
}

interface ConfigurationEntry {
  key: string;
  text: string;
  line: number;
  action: 'configure' | 'depend_on' | 'call';
  basis: string;
  format: string;
}

function jsonEntries(body: string): ConfigurationEntry[] {
  const parsed = JSON.parse(body) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const lines = body.split(/\r?\n/);
  return Object.keys(parsed as Record<string, unknown>).sort().map((key) => ({
    key,
    text: `Configure ${key}`,
    line: findKeyLine(lines, key),
    action: key === 'dependencies' || key === 'devDependencies' ? 'depend_on' : 'configure',
    basis: 'json_top_level_key',
    format: 'json',
  }));
}

function tomlEntries(body: string): ConfigurationEntry[] {
  const output: ConfigurationEntry[] = [];
  let section = '';
  for (const [index, raw] of body.split(/\r?\n/).entries()) {
    const line = raw.trim();
    const heading = line.match(/^\[([^\]]+)]$/);
    if (heading) {
      section = heading[1]?.trim() ?? '';
      output.push(entry(section, raw, index + 1, 'toml_section', 'toml'));
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
    if (pair) output.push(entry(section ? `${section}.${pair[1]}` : pair[1]!, raw, index + 1, 'toml_key', 'toml'));
  }
  return uniqueEntries(output);
}

function yamlOrAssignmentEntries(body: string): ConfigurationEntry[] {
  const output: ConfigurationEntry[] = [];
  for (const [index, raw] of body.split(/\r?\n/).entries()) {
    const yaml = raw.match(/^\s*(?:-\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*:/);
    const assignment = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*[?:+]?=/);
    const key = yaml?.[1] ?? assignment?.[1];
    if (key) output.push(entry(key, raw, index + 1, yaml ? 'yaml_key' : 'assignment', yaml ? 'yaml' : 'text'));
  }
  return uniqueEntries(output);
}

function dockerEntries(body: string): ConfigurationEntry[] {
  return body.split(/\r?\n/).flatMap((raw, index) => {
    const match = raw.match(/^\s*(FROM|RUN|COPY|ADD|ENV|ARG|EXPOSE|CMD|ENTRYPOINT|HEALTHCHECK|WORKDIR|USER)\b\s*(.*)$/i);
    if (!match) return [];
    const instruction = match[1]!.toUpperCase();
    const detail = match[2]?.trim() ?? '';
    return [{
      key: `${instruction}:${detail.slice(0, 120)}`,
      text: raw.trim(),
      line: index + 1,
      action: instruction === 'RUN' || instruction === 'CMD' || instruction === 'ENTRYPOINT' ? 'call' as const
        : instruction === 'FROM' ? 'depend_on' as const : 'configure' as const,
      basis: 'dockerfile_instruction',
      format: 'dockerfile',
    }];
  });
}

function entry(key: string, text: string, line: number, basis: string, format: string): ConfigurationEntry {
  return { key, text: text.trim(), line, action: 'configure', basis, format };
}

function uniqueEntries(entries: ConfigurationEntry[]): ConfigurationEntry[] {
  const seen = new Set<string>();
  return entries.filter((item) => {
    if (!item.key || seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function findKeyLine(lines: string[], key: string): number {
  const pattern = new RegExp(`^\\s*"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`);
  const index = lines.findIndex((line) => pattern.test(line));
  return index < 0 ? 1 : index + 1;
}
