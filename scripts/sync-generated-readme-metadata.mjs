#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const readmePath = path.resolve(process.argv[3] ?? path.join(root, 'docs', 'README.md'));
const relativeReadme = path.relative(root, readmePath);
if (!relativeReadme || relativeReadme.startsWith(`..${path.sep}`) || path.isAbsolute(relativeReadme)) {
  throw new Error('Generated README must be a file inside the project root');
}
const packagePath = path.join(root, 'package.json');

const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
const version = requiredString(packageJson.version, 'package.json version');
const license = requiredString(packageJson.license, 'package.json license');
const nodeVersion = requiredString(packageJson.engines?.node, 'package.json engines.node');
const original = await fs.readFile(readmePath, 'utf8');

let synchronized = replaceRequired(
  original,
  /!\[version\]\(https:\/\/img\.shields\.io\/badge\/version-[^)]+\)/,
  `![version](https://img.shields.io/badge/version-${badgeValue(version)}-blue)`,
  'version badge',
);
synchronized = replaceRequired(
  synchronized,
  /!\[(?:javascript|node|typescript)\]\(https:\/\/img\.shields\.io\/badge\/(?:javascript|node|typescript)-[^)]+\)/,
  `![node](https://img.shields.io/badge/node-${badgeValue(nodeVersion)}-339933)`,
  'Node runtime badge',
);
const licenseTarget = path.relative(path.dirname(readmePath), path.join(root, 'LICENSE')).replace(/\\/g, '/') || 'LICENSE';
synchronized = replaceRequired(
  synchronized,
  /^\*\*License:\*\*.*$/m,
  `**License:** [${license}](${licenseTarget})`,
  'license line',
);

if (synchronized !== original) {
  const temporary = `${readmePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, synchronized, 'utf8');
  await fs.rename(temporary, readmePath);
}

process.stdout.write(`${JSON.stringify({
  readme: relativeReadme.replace(/\\/g, '/'),
  version,
  license,
  nodeVersion,
  changed: synchronized !== original,
})}\n`);

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function replaceRequired(value, pattern, replacement, label) {
  if (!pattern.test(value)) throw new Error(`Generated README is missing its ${label}`);
  return value.replace(pattern, replacement);
}

function badgeValue(value) {
  return encodeURIComponent(value).replace(/-/g, '--');
}
