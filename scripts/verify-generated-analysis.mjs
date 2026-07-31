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

const [{ stdout: untrackedOutput }, { stdout: trackedOutput }] = await Promise.all([
  execFileAsync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'buffer',
  }),
  execFileAsync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'buffer',
  }),
]);
const untracked = untrackedOutput.toString('utf8').split('\0').filter(Boolean).map(normalizePath);
const tracked = trackedOutput.toString('utf8').split('\0').filter(Boolean).map(normalizePath);
const generatedRelative = new Set(generated.map((file) => normalizePath(path.relative(root, file))));
const trackedReferences = await referencesAlreadyInTrackedSources(tracked, generatedRelative, untracked);
const failures = [];

for (const file of generated.sort()) {
  const relative = normalizePath(path.relative(root, file));
  const content = await fs.readFile(file, 'utf8');
  for (const candidate of untracked) {
    if (content.includes(candidate) && !trackedReferences.has(candidate)) {
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

/**
 * A generated report may quote tracked audit evidence that already names an
 * untracked file (for example a recorded `git status --short`). That is not
 * proof that the generator consumed the private file. Only a reference newly
 * introduced outside tracked sources is treated as an input leak.
 *
 * Generated outputs themselves are excluded from the source corpus so a stale
 * report cannot justify its own reference.
 */
async function referencesAlreadyInTrackedSources(trackedFiles, generatedFiles, candidates) {
  const referenced = new Set();
  if (candidates.length === 0) return referenced;
  for (const relative of trackedFiles) {
    if (generatedFiles.has(relative)) continue;
    const content = await fs.readFile(path.join(root, relative));
    if (content.includes(0)) continue;
    const text = content.toString('utf8');
    for (const candidate of candidates) {
      if (text.includes(candidate)) referenced.add(candidate);
    }
  }
  return referenced;
}
