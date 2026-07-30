#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(process.argv[2] ?? process.cwd());
const projectDirectory = path.join(root, 'project');
const textExtensions = new Set(['.export', '.html', '.md', '.mmd', '.txt', '.toon', '.yaml', '.yml']);

const generated = [path.join(root, 'docs', 'README.md')];
for (const entry of await fs.readdir(projectDirectory, { withFileTypes: true })) {
  if (entry.isFile() && textExtensions.has(path.extname(entry.name))) {
    generated.push(path.join(projectDirectory, entry.name));
  }
}

const { stdout } = await execFileAsync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
  cwd: root,
  encoding: 'buffer',
});
const untracked = stdout.toString('utf8').split('\0').filter(Boolean).map(normalizePath);
const failures = [];

for (const file of generated.sort()) {
  const relative = normalizePath(path.relative(root, file));
  const content = await fs.readFile(file, 'utf8');
  for (const candidate of untracked) {
    if (content.includes(candidate)) {
      failures.push(`${relative} references untracked input ${candidate}`);
    }
  }
  if (/\/tmp\/t2c-analysis\.[^/\s]+\//.test(content)) {
    failures.push(`${relative} contains a temporary analysis path`);
  }
  if (/syntax\.unsupported[\s\S]{0,240}not available for download/i.test(content)) {
    failures.push(`${relative} contains a validator parser-download failure`);
  }
}

if (failures.length > 0) {
  throw new Error(`Generated analysis verification failed:\n- ${failures.join('\n- ')}`);
}

process.stdout.write(`${JSON.stringify({
  filesChecked: generated.length,
  untrackedInputsChecked: untracked.length,
  status: 'ok',
})}\n`);

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}
