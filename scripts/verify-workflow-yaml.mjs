#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const explicit = process.argv.slice(2);
const files = explicit.length ? explicit : await workflowFiles();
const failures = [];

for (const file of files) {
  const body = await fs.readFile(file, 'utf8');
  const seen = new Map();
  for (const [index, line] of body.split(/\r?\n/).entries()) {
    if (!line.trim() || /^\s*#/.test(line) || /^\s/.test(line)) continue;
    const match = line.match(/^(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_.-]+))\s*:/);
    const key = match?.[1] ?? match?.[2] ?? match?.[3];
    if (!key) continue;
    const previous = seen.get(key);
    if (previous !== undefined) failures.push(`${file}:${index + 1}: duplicate top-level key "${key}" (first at line ${previous})`);
    else seen.set(key, index + 1);
  }
}

if (failures.length) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Workflow YAML verified: ${files.length} file(s), no duplicate top-level keys.\n`);
}

async function workflowFiles() {
  const directory = path.resolve('.github/workflows');
  let entries = [];
  try {
    entries = await fs.readdir(directory);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort()
    .map((name) => path.join(directory, name));
}
