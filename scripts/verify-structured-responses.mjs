#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const sourceRoot = path.join(root, 'src');
const files = await typescriptFiles(sourceRoot);
const rawCalls = [];
let structuredCalls = 0;

for (const file of files) {
  if (file.endsWith(path.join('llm', 'openrouter.ts'))) continue;
  const source = await fs.readFile(file, 'utf8');
  if (/\.chatJson(?:WithMetadata)?\s*(?:<[^>]+>)?\s*\(/.test(source)) {
    rawCalls.push(path.relative(root, file).replaceAll('\\', '/'));
  }
  structuredCalls += source.match(/\.chatStructuredWithMetadata\s*\(/g)?.length ?? 0;
}

if (rawCalls.length > 0) {
  throw new Error(`Production code bypasses canonical structured-response parsing:\n- ${rawCalls.join('\n- ')}`);
}
if (structuredCalls === 0) throw new Error('No canonical structured-response boundaries were found');
process.stdout.write(`${JSON.stringify({ structuredCalls, rawCalls: 0, status: 'ok' })}\n`);

async function typescriptFiles(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await typescriptFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith('.ts')) output.push(absolute);
  }
  return output;
}
