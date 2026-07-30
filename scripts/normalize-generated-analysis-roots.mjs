#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const sourceRoot = path.resolve(process.argv[3] ?? root);
const textExtensions = new Set(['.export', '.html', '.md', '.mmd', '.txt', '.toon', '.yaml', '.yml']);
if (sourceRoot === path.parse(sourceRoot).root) {
  throw new Error('Refusing to normalize a filesystem root');
}

const files = [path.join(root, 'docs', 'README.md')];
const projectDirectory = path.join(root, 'project');
for (const entry of await fs.readdir(projectDirectory, { withFileTypes: true })) {
  if (entry.isFile() && textExtensions.has(path.extname(entry.name))) {
    files.push(path.join(projectDirectory, entry.name));
  }
}

let changed = 0;
for (const file of files) {
  const original = await fs.readFile(file, 'utf8');
  const normalized = original.replaceAll(sourceRoot, '<PROJECT_ROOT>');
  if (normalized === original) continue;
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, normalized, 'utf8');
  await fs.rename(temporary, file);
  changed += 1;
}

process.stdout.write(`${JSON.stringify({ filesChecked: files.length, filesChanged: changed })}\n`);
