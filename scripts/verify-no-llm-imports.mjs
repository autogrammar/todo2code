#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const entrypoints = [
  'src/extractors/nl.ts',
  'src/extractors/git.ts',
  'src/extractors/ast.ts',
  'src/extractors/markdown.ts',
  'src/extractors/communication.ts',
  'src/communication/analyzer.ts',
  'src/graph/linker.ts',
  'src/graph/diagnostics.ts',
  'src/tf/classifier.ts',
];
const forbiddenTargets = [
  `${path.sep}src${path.sep}llm${path.sep}`,
  `${path.sep}src${path.sep}extractors${path.sep}docs-llm.ts`,
  `${path.sep}src${path.sep}summary${path.sep}`,
];
const forbiddenContent = [/OPENROUTER_API_KEY/i, /chat\/completions/i];
const visited = new Set();
const failures = [];

for (const entrypoint of entrypoints) await visit(path.resolve(entrypoint), [entrypoint]);

async function visit(file, chain) {
  if (isVisited(file)) return;
  markVisited(file);
  if (isForbiddenTarget(file)) {
    failures.push(`forbidden dependency: ${chain.join(' -> ')}`);
    return;
  }

  const body = await fs.readFile(file, 'utf8');
  for (const pattern of forbiddenContentPatterns()) {
    if (pattern.test(body)) failures.push(`${path.relative(process.cwd(), file)} contains ${pattern}`);
  }
  for (const specifier of collectSourceImports(body)) {
    if (!specifier.startsWith('.')) continue;
    const resolved = await resolveSource(path.dirname(file), specifier);
    if (resolved) await visit(resolved, [...chain, path.relative(process.cwd(), resolved)]);
  }
}

function forbiddenContentPatterns() {
  return forbiddenContent;
}

function isForbiddenTarget(file) {
  return forbiddenTargets.some((target) => file.includes(target));
}

function collectSourceImports(body) {
  const imports = [];
  for (const match of body.matchAll(/import\s+(type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (!match[1] && match[2]) imports.push(match[2]);
  }
  for (const match of body.matchAll(/export\s+(type\s+)?(?:[^'";]+?\s+from\s+)['"]([^'"]+)['"]/g)) {
    if (!match[1] && match[2]) imports.push(match[2]);
  }
  for (const match of body.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (match[1]) imports.push(match[1]);
  }
  return imports;
}

function isVisited(file) {
  return visited.has(file);
}

function markVisited(file) {
  visited.add(file);
}

async function resolveSource(directory, specifier) {
  const raw = path.resolve(directory, specifier);
  const candidates = [
    raw,
    raw.replace(/\.js$/, '.ts'),
    raw.replace(/\.mjs$/, '.mts'),
    `${raw}.ts`,
    path.join(raw, 'index.ts'),
  ];
  for (const candidate of [...new Set(candidates)]) {
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

if (failures.length) {
  console.error(`Deterministic/LLM boundary violated:\n${[...new Set(failures)].join('\n')}`);
  process.exit(1);
}
console.log(`LLM boundary verified transitively from ${entrypoints.length} deterministic entrypoints across ${visited.size} modules.`);
