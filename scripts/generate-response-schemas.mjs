#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentResponseContract } from '../dist/src/extractors/docs-schema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'schemas', 'document-extraction-response.schema.json');
const publishedDocumentMaximum = 200;
const generated = `${JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://todo2code.local/schemas/document-extraction-response.schema.json',
  title: 'OpenRouter documentation extraction response',
  ...documentResponseContract(publishedDocumentMaximum).jsonSchema,
}, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = await fs.readFile(outputPath, 'utf8');
  if (current !== generated) {
    throw new Error('Published document response schema is stale; run npm run schemas:generate');
  }
  process.stdout.write(`${JSON.stringify({ schema: path.relative(root, outputPath), status: 'ok' })}\n`);
} else {
  await fs.writeFile(outputPath, generated, 'utf8');
  process.stdout.write(`${JSON.stringify({ schema: path.relative(root, outputPath), status: 'generated' })}\n`);
}
