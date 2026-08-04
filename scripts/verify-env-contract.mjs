#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const examplePath = path.join(root, '.env.example');
const { duplicates, declared, expected, missing, unused, local } = await buildEnvContractReport(root, examplePath);
if (hasContractProblems({ duplicates, missing, unused, local })) {
  reportContractProblems({
    duplicates,
    missing,
    unused,
    local,
  });
  process.exit(1);
}
console.log(`Environment contract verified: ${expected.size} code/Docker variables, ${declared.size} documented keys, no duplicates.`);

async function buildEnvContractReport(rootPath, envExamplePath) {
  const example = await fs.readFile(envExamplePath, 'utf8');
  const duplicates = [];
  const declared = parseDeclaredEnv(example, duplicates);
  const expected = await collectExpectedVariables(rootPath);
  const missing = [...expected].filter((name) => !declared.has(name)).sort();
  const unused = [...declared.keys()].filter((name) => !expected.has(name)).sort();
  const local = await auditLocalKeys(path.join(rootPath, '.env'), declared);

  return {
    duplicates,
    declared,
    expected,
    missing,
    unused,
    local,
  };
}

function reportContractProblems({
  duplicates: duplicateKeys,
  missing,
  unused,
  local,
}) {
  if (duplicateKeys.length) console.error(`Duplicate .env.example keys:\n${duplicateKeys.join('\n')}`);
  if (missing.length) console.error(`Environment variables missing from .env.example:\n${missing.join('\n')}`);
  if (unused.length) console.error(`Unused environment variables declared in .env.example:\n${unused.join('\n')}`);
  if (local.missing.length) console.error(`Environment variables missing from local .env:\n${local.missing.join('\n')}`);
  if (local.extra.length) console.error(`Unexpected environment variables in local .env:\n${local.extra.join('\n')}`);
  if (local.duplicates.length) console.error(`Duplicate environment variables in local .env:\n${local.duplicates.join('\n')}`);
}

function parseDeclaredEnv(example, duplicates) {
  const declared = new Map();
  for (const declaration of collectDeclaredEnvEntries(example)) {
    const { name, line } = declaration;
    if (declared.has(name)) {
      duplicates.push(`${name} (lines ${declared.get(name)} and ${line})`);
    }
    declared.set(name, line);
  }
  return declared;
}

async function collectExpectedVariables(rootPath) {
  const expected = new Set();
  await addConfigEnvKeys(path.join(rootPath, 'src', 'config', 'env.ts'), expected);
  await addSourceReferences(await collectExisting(['src', 'sdk', 'examples', 'scripts']), expected);
  await addMakefileReferences(path.join(rootPath, 'Makefile'), expected);
  await addDockerReferences([path.join(rootPath, 'docker-compose.yml'), path.join(rootPath, 'Dockerfile')], expected);
  return expected;
}

async function addConfigEnvKeys(configFile, expected) {
  for (const value of await collectConfigKeys(configFile)) {
    expected.add(value);
  }
}

async function addSourceReferences(files, expected) {
  for (const file of files) {
    const body = await fs.readFile(file, 'utf8');
    for (const match of collectEnvReferences(file, body)) expected.add(match);
  }
}

async function addMakefileReferences(makefile, expected) {
  const makefileBody = await fs.readFile(makefile, 'utf8');
  for (const name of collectMakefileReferences(makefileBody)) {
    expected.add(name);
  }
}

async function addDockerReferences(files, expected) {
  for (const file of files) {
    const body = await fs.readFile(file, 'utf8');
    for (const name of collectDockerReferences(body)) expected.add(name);
  }
}

async function collectConfigKeys(configFile) {
  const body = await fs.readFile(configFile, 'utf8');
  return [...body.matchAll(/env(?:String|Optional|Number|Boolean|List|LlmMode)\('([A-Z][A-Z0-9_]+)'/g)].map((match) => match[1]);
}

function collectDeclaredEnvEntries(example) {
  const lines = example.split(/\r?\n/);
  const declarations = [];
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match?.[1]) continue;
    declarations.push({ name: match[1], line: index + 1 });
  }
  return declarations;
}

function collectEnvReferences(file, body) {
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]+)/g,
    /process\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g,
    /os\.(?:getenv|environ\.get)\(['"]([A-Z][A-Z0-9_]+)['"]/g,
    /getenv\(['"]([A-Z][A-Z0-9_]+)['"]\)/g,
    /env::var\(['"]([A-Z][A-Z0-9_]+)['"]\)/g,
    /os\.Getenv\(['"]([A-Z][A-Z0-9_]+)['"]\)/g,
  ];
  const names = [];
  for (const pattern of patterns) {
    for (const match of body.matchAll(pattern)) names.push(match[1]);
  }
  if (file.endsWith('.sh')) {
    for (const match of body.matchAll(/\b((?:T2C|OPENROUTER)_[A-Z0-9_]+)\b/g)) names.push(match[1]);
  }
  return names;
}

function collectMakefileReferences(makefileBody) {
  return [...makefileBody.matchAll(/\b((?:T2C|OPENROUTER)_[A-Z0-9_]+)\b/g)].map((match) => match[1]);
}

function collectDockerReferences(body) {
  return [
    ...collectDockerTemplateReferences(body),
    ...collectDockerAssignmentReferences(body),
  ];
}

function collectDockerTemplateReferences(body) {
  return extractMatches(body, /\$\{([A-Z][A-Z0-9_]+)/g);
}

function collectDockerAssignmentReferences(body) {
  return extractMatches(body, /\b((?:T2C|OPENROUTER)_[A-Z0-9_]+)\s*(?::|=)/g);
}

function extractMatches(body, pattern) {
  const names = [];
  for (const match of body.matchAll(pattern)) names.push(match[1]);
  return names;
}

function hasContractProblems({
  duplicates: duplicateKeys,
  missing,
  unused,
  local,
}) {
  return duplicateKeys.length
    || missing.length
    || unused.length
    || local.missing.length
    || local.extra.length
    || local.duplicates.length;
}

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
