#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const options = parseArgs(process.argv.slice(2));
const entries = (await fs.readdir(options.repos, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const repositories = [];
const sample = [];
const census = [];

for (const repository of entries) {
  const root = path.join(options.repos, repository);
  const latest = await readJson(path.join(root, options.intentDirectory, 'latest.json'));
  const runDirectory = path.join(root, options.intentDirectory, 'runs', latest.runId);
  const diagnostics = await readJson(path.join(runDirectory, 'diagnostics.json'));
  const graph = await readJson(path.join(runDirectory, 'intent.graph.json'));
  const recordsById = new Map(graph.records.map((record) => [record.id, record]));
  const findings = diagnostics.diagnostics
    .filter((diagnostic) => diagnostic.code === 'CHANGELOG_WITHOUT_IMPLEMENTATION')
    .map((diagnostic) => recordsById.get(diagnostic.recordIds[0]))
    .filter(Boolean);
  const selected = stratifiedSample(findings, options.limit);
  const trackedFiles = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  for (const record of findings) {
    census.push({ repository, label: classify(record).label });
  }
  repositories.push({
    repository,
    commit: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    runId: latest.runId,
    graphFingerprint: graph.fingerprint,
    records: graph.records.length,
    relations: graph.relations.length,
    residualFindings: findings.length,
    residualLabelCounts: countBy(findings, (record) => classify(record).label),
    sampledFindings: selected.length,
  });

  for (const { record, stratum } of selected) {
    const classification = classify(record);
    sample.push({
      repository,
      recordId: record.id,
      stratum,
      label: classification.label,
      rationale: classification.rationale,
      action: record.statement.action,
      text: record.statement.text,
      target: record.statement.target,
      trackedPathOwners: pathOwners(record, trackedFiles),
      source: {
        path: record.source.path,
        lines: record.source.lines,
      },
      metadata: {
        version: record.metadata.version ?? null,
        category: record.metadata.category ?? null,
      },
    });
  }
}

const labelCounts = countBy(sample, (entry) => entry.label);
const labelRepositories = Object.fromEntries(
  Object.keys(labelCounts).sort().map((label) => [
    label,
    [...new Set(sample.filter((entry) => entry.label === label).map((entry) => entry.repository))].sort(),
  ]),
);
const output = {
  schemaVersion: 't2c.changelog-audit/v1',
  generatedAt: '2026-07-31T00:00:00.000Z',
  selectionPolicy: {
    description: 'Round-robin over lexical target-class:action strata, then stable record ID.',
    perRepositoryLimit: options.limit,
    targetClassPrecedence: ['ticket', 'path', 'symbol', 'none'],
  },
  classificationPolicy: {
    version: 1,
    labels: {
      non_actionable_file_update: 'Exact Update <file> bookkeeping with no behavioral statement.',
      non_actionable_file_summary: 'Opaque chore summary naming only a file count.',
      roadmap_not_release: 'Unchecked Markdown task embedded in a changelog.',
      substantive_or_unverified: 'Behavioral, compatibility, test or documentation claim that still needs evidence.',
    },
  },
  repositories,
  summary: {
    residualFindings: census.length,
    residualLabelCounts: countBy(census, (entry) => entry.label),
    residualLabelRepositories: Object.fromEntries(
      [...new Set(census.map((entry) => entry.label))].sort().map((label) => [
        label,
        [...new Set(census.filter((entry) => entry.label === label).map((entry) => entry.repository))].sort(),
      ]),
    ),
    sampledFindings: sample.length,
    labelCounts,
    labelRepositories,
  },
  sample,
};
await fs.writeFile(options.out, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output.summary)}\n`);

function stratifiedSample(records, limit) {
  const groups = new Map();
  for (const record of records) {
    const stratum = `${targetClass(record)}:${record.statement.action}`;
    const values = groups.get(stratum) ?? [];
    values.push(record);
    groups.set(stratum, values);
  }
  for (const values of groups.values()) values.sort((left, right) => left.id.localeCompare(right.id));
  const keys = [...groups.keys()].sort();
  const output = [];
  for (let index = 0; output.length < limit; index += 1) {
    let added = false;
    for (const key of keys) {
      const record = groups.get(key)?.[index];
      if (!record) continue;
      output.push({ record, stratum: key });
      added = true;
      if (output.length === limit) break;
    }
    if (!added) break;
  }
  return output;
}

function targetClass(record) {
  const target = record.statement.target;
  if (target.tickets.length > 0) return 'ticket';
  if (target.paths.length > 0) return 'path';
  if (target.symbols.length > 0) return 'symbol';
  return 'none';
}

function classify(record) {
  const text = record.statement.text.trim();
  const file = exactFileUpdate(text);
  if (file) {
    return {
      label: 'non_actionable_file_update',
      rationale: `Names only the updated file (${file}); it makes no behavioral implementation claim.`,
    };
  }
  if (/^chore:\s*update\s+\d+\s+files?[.!]?$/i.test(text)) {
    return {
      label: 'non_actionable_file_summary',
      rationale: 'Opaque file-count bookkeeping provides no behavior to ground.',
    };
  }
  if (/^\[\s\]\s+/.test(text)) {
    return {
      label: 'roadmap_not_release',
      rationale: 'Unchecked Markdown denotes planned work, not a released implementation claim.',
    };
  }
  return {
    label: 'substantive_or_unverified',
    rationale: 'Contains a behavior, compatibility, quality or documentation claim that still requires evidence review.',
  };
}

function exactFileUpdate(text) {
  const match = text.match(/^update\s+`?([^`\s]+)`?[.!]?$/i);
  const candidate = match?.[1]?.replace(/[.!]$/, '') ?? '';
  if (!candidate || /^https?:/i.test(candidate)) return null;
  const basename = candidate.split('/').at(-1) ?? '';
  if (
    candidate.includes('/')
    || basename.startsWith('.')
    || basename.includes('.')
    || ['Dockerfile', 'Jenkinsfile', 'Makefile'].includes(basename)
  ) return candidate;
  return null;
}

function pathOwners(record, trackedFiles) {
  const file = exactFileUpdate(record.statement.text);
  if (!file) return [];
  return trackedFiles
    .filter((candidate) => candidate === file || candidate.split('/').at(-1) === file)
    .sort();
}

function countBy(values, key) {
  const counts = {};
  for (const value of values) {
    const item = key(value);
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function parseArgs(args) {
  const value = (name) => {
    const index = args.indexOf(name);
    if (index < 0 || !args[index + 1]) throw new Error(`${name} is required`);
    return path.resolve(args[index + 1]);
  };
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 24;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('--limit must be an integer from 1 to 1000');
  const intentDirectoryIndex = args.indexOf('--intent-directory');
  const intentDirectory = intentDirectoryIndex >= 0
    ? args[intentDirectoryIndex + 1]
    : '.intent-ticket003';
  if (!intentDirectory || path.isAbsolute(intentDirectory) || intentDirectory.includes('..')) {
    throw new Error('--intent-directory must be a relative directory without ..');
  }
  return { repos: value('--repos'), out: value('--out'), limit, intentDirectory };
}
