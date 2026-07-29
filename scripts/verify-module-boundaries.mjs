#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve('src');
const files = (await collect(sourceRoot)).filter((file) => file.endsWith('.ts')).sort();
const graph = new Map();
const failures = [];

for (const file of files) {
  const body = await fs.readFile(file, 'utf8');
  const imports = [];
  for (const match of body.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (match[1]?.startsWith('.')) imports.push(match[1]);
  }
  const resolved = [];
  for (const specifier of imports) {
    const target = await resolveSource(path.dirname(file), specifier);
    if (target) resolved.push(target);
  }
  graph.set(file, [...new Set(resolved)].sort());

  const relative = slash(path.relative(sourceRoot, file));
  if (relative.startsWith('core/')) {
    for (const target of resolved) {
      const targetRelative = slash(path.relative(sourceRoot, target));
      if (!targetRelative.startsWith('core/')) {
        failures.push(`core layer imports ${targetRelative}: ${relative}`);
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
for (const file of files) visit(file, []);

function visit(file, chain) {
  if (visiting.has(file)) {
    const start = chain.indexOf(file);
    failures.push(`dependency cycle: ${[...chain.slice(Math.max(0, start)), file].map(relative).join(' -> ')}`);
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const target of graph.get(file) ?? []) visit(target, [...chain, file]);
  visiting.delete(file);
  visited.add(file);
}

if (failures.length) {
  console.error(`Module boundaries failed:\n${[...new Set(failures)].join('\n')}`);
  process.exit(1);
}

const edges = [...graph.values()].reduce((count, targets) => count + targets.length, 0);
console.log(`Module boundaries verified: ${files.length} modules, ${edges} internal imports, no cycles, core is independent.`);

async function collect(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await collect(absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

async function resolveSource(directory, specifier) {
  const raw = path.resolve(directory, specifier);
  for (const candidate of [...new Set([raw, raw.replace(/\.js$/, '.ts'), `${raw}.ts`, path.join(raw, 'index.ts')])]) {
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

function relative(file) {
  return slash(path.relative(sourceRoot, file));
}

function slash(value) {
  return value.replace(/\\/g, '/');
}
