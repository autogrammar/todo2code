#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const examplePath = path.join(root, '.env.example');
const example = await fs.readFile(examplePath, 'utf8');
const declared = new Map();
const duplicates = [];
for (const [index, line] of example.split(/\r?\n/).entries()) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
  if (!match?.[1]) continue;
  if (declared.has(match[1])) duplicates.push(`${match[1]} (lines ${declared.get(match[1])} and ${index + 1})`);
  declared.set(match[1], index + 1);
}

const expected = new Set();
const configBody = await fs.readFile(path.join(root, 'src/config/env.ts'), 'utf8');
for (const match of configBody.matchAll(/env(?:String|Optional|Number|Boolean|List|LlmMode)\('([A-Z][A-Z0-9_]+)'/g)) {
  expected.add(match[1]);
}

for (const file of await collectExisting(['src', 'sdk', 'examples', 'scripts'])) {
  const body = await fs.readFile(file, 'utf8');
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]+)/g,
    /process\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g,
    /os\.(?:getenv|environ\.get)\(['"]([A-Z][A-Z0-9_]+)['"]/g,
    /getenv\(['"]([A-Z][A-Z0-9_]+)['"]\)/g,
    /env::var\(['"]([A-Z][A-Z0-9_]+)['"]\)/g,
    /os\.Getenv\(['"]([A-Z][A-Z0-9_]+)['"]\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of body.matchAll(pattern)) expected.add(match[1]);
  }
  if (file.endsWith('.sh')) {
    for (const match of body.matchAll(/\b((?:T2C|OPENROUTER)_[A-Z0-9_]+)\b/g)) expected.add(match[1]);
  }
}

const makefile = await fs.readFile(path.join(root, 'Makefile'), 'utf8');
for (const match of makefile.matchAll(/\b((?:T2C|OPENROUTER)_[A-Z0-9_]+)\b/g)) expected.add(match[1]);

for (const fileName of ['docker-compose.yml', 'Dockerfile']) {
  const body = await fs.readFile(path.join(root, fileName), 'utf8');
  for (const match of body.matchAll(/\$\{([A-Z][A-Z0-9_]+)/g)) expected.add(match[1]);
  for (const match of body.matchAll(/\b((?:T2C|OPENROUTER)_[A-Z0-9_]+)\s*(?::|=)/g)) expected.add(match[1]);
}

const missing = [...expected].filter((name) => !declared.has(name)).sort();
const unused = [...declared.keys()].filter((name) => !expected.has(name)).sort();
const local = await auditLocalKeys(path.join(root, '.env'), declared);
if (duplicates.length || missing.length || unused.length || local.missing.length || local.extra.length || local.duplicates.length) {
  if (duplicates.length) console.error(`Duplicate .env.example keys:\n${duplicates.join('\n')}`);
  if (missing.length) console.error(`Environment variables missing from .env.example:\n${missing.join('\n')}`);
  if (unused.length) console.error(`Unused environment variables declared in .env.example:\n${unused.join('\n')}`);
  if (local.missing.length) console.error(`Environment variables missing from local .env:\n${local.missing.join('\n')}`);
  if (local.extra.length) console.error(`Unexpected environment variables in local .env:\n${local.extra.join('\n')}`);
  if (local.duplicates.length) console.error(`Duplicate environment variables in local .env:\n${local.duplicates.join('\n')}`);
  process.exit(1);
}
console.log(`Environment contract verified: ${expected.size} code/Docker variables, ${declared.size} documented keys, no duplicates.`);

async function auditLocalKeys(file, contract) {
  try {
    const body = await fs.readFile(file, 'utf8');
    const names = [...body.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);
    const keys = new Set(names);
    return {
      missing: [...contract.keys()].filter((name) => !keys.has(name)).sort(),
      extra: [...keys].filter((name) => !contract.has(name)).sort(),
      duplicates: names.filter((name, index) => names.indexOf(name) !== index).filter((name, index, values) => values.indexOf(name) === index).sort(),
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { missing: [], extra: [], duplicates: [] };
    throw error;
  }
}

async function collectExisting(directories) {
  const output = [];
  for (const directory of directories) {
    const absolute = path.join(root, directory);
    try {
      output.push(...await collect(absolute));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const generatedDirectories = ['target', 'node_modules', 'dist', 'build', '__pycache__'];
  return output.filter((file) => /\.(?:ts|js|mjs|py|php|rs|go|sh)$/.test(file)
    && !generatedDirectories.some((name) => file.includes(`${path.sep}${name}${path.sep}`)));
}

async function collect(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await collect(absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}
