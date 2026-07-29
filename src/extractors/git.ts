import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { buildRecord } from '../core/record.js';
import { extractSymbols, extractTickets, extractVersions, inferObject } from '../core/text.js';
import type { ExtractionResult, IntentRecord, JsonValue } from '../core/types.js';
import { classifyAction } from '../tf/classifier.js';

const execFileAsync = promisify(execFile);

interface GitCommit {
  sha: string;
  author: string;
  authoredAt: string;
  subject: string;
  body: string;
}

interface ChangedFile {
  status: string;
  path: string;
  previousPath?: string;
}

export interface GitExtractionOptions {
  root: string;
  count?: number;
}

export async function extractGitIntent(options: GitExtractionOptions, config: T2CConfig): Promise<ExtractionResult> {
  const root = path.resolve(options.root);
  const count = options.count ?? config.gitCommitCount;
  const warnings: string[] = [];
  try {
    const inside = (await runGit(root, ['rev-parse', '--is-inside-work-tree'])).trim();
    if (inside !== 'true') return { records: [], warnings: [`${root} is not a Git work tree`] };
  } catch {
    return { records: [], warnings: [`Git repository not available at ${root}`] };
  }

  const commits = await readCommits(root, count);
  const records: IntentRecord[] = [];
  for (let index = 0; index < commits.length; index += 1) {
    const commit = commits[index];
    if (!commit) continue;
    const changedFiles = await readChangedFiles(root, commit.sha);
    const stats = await readStats(root, commit.sha);
    const diff = await runGit(root, ['show', '--format=', '--unified=0', '--no-ext-diff', commit.sha], 8 * 1024 * 1024);
    const text = `${commit.subject}\n${commit.body}`.trim();
    const classified = await classifyAction(text, config);
    const inferredSymbols = extractChangedSymbols(diff);
    const targetPaths = [...new Set(changedFiles.map((item) => item.path))].sort();
    const docOnly = targetPaths.length > 0 && targetPaths.every(isDocumentationPath);
    records.push(buildRecord({
      kind: 'commit_intent_claim',
      actor: commit.author,
      action: classified.action,
      subject: `commit:${commit.sha}`,
      object: inferObject(commit.subject, classified.action),
      target: {
        paths: targetPaths,
        symbols: [...new Set([...extractSymbols(text), ...inferredSymbols])].sort(),
        tickets: extractTickets(text),
        versions: extractVersions(text),
      },
      modality: 'claimed',
      text: commit.subject,
      lifecycle: 'implemented',
      sourceKind: 'git',
      revision: commit.sha,
      commitIndex: index + 1,
      extractor: 't2c/git@1',
      rawExcerpt: text,
      epistemicClass: 'claim',
      confidence: Math.min(0.94, classified.confidence + (targetPaths.length > 0 ? 0.08 : 0)),
      basis: [classified.basis, 'commit_message', 'changed_files', ...(inferredSymbols.length ? ['diff_symbol_heuristics'] : [])],
      observedAt: commit.authoredAt,
      metadata: {
        author: commit.author,
        body: commit.body,
        docOnly,
        changedFiles: changedFiles as unknown as JsonValue,
        additions: stats.additions,
        deletions: stats.deletions,
        filesChanged: targetPaths.length,
        llmUsed: false,
      },
    }));
  }
  if (commits.length < count) warnings.push(`Requested ${count} commits, repository contains ${commits.length}`);
  return { records, warnings };
}

async function runGit(root: string, args: string[], maxBuffer = 4 * 1024 * 1024): Promise<string> {
  const result = await execFileAsync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer,
    env: { ...process.env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' },
  });
  return result.stdout;
}

async function readCommits(root: string, count: number): Promise<GitCommit[]> {
  const output = await runGit(root, [
    'log',
    `-n${count}`,
    '--date=iso-strict',
    '--format=%H%x1f%an%x1f%aI%x1f%s%x1f%b%x1e',
  ]);
  return output
    .split('\x1e')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [sha = '', author = '', authoredAt = '', subject = '', ...body] = chunk.split('\x1f');
      return { sha, author, authoredAt, subject, body: body.join('\x1f').trim() };
    })
    .filter((commit) => Boolean(commit.sha));
}

async function readChangedFiles(root: string, sha: string): Promise<ChangedFile[]> {
  const output = await runGit(root, ['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', '-M', sha]);
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const parts = line.split('\t');
    const status = parts[0] ?? 'M';
    if (status.startsWith('R') || status.startsWith('C')) {
      return { status, previousPath: parts[1] ?? '', path: parts[2] ?? parts[1] ?? '' };
    }
    return { status, path: parts[1] ?? '' };
  }).filter((item) => item.path);
}

async function readStats(root: string, sha: string): Promise<{ additions: number; deletions: number }> {
  const output = await runGit(root, ['show', '--format=', '--numstat', sha]);
  let additions = 0;
  let deletions = 0;
  for (const line of output.split(/\r?\n/)) {
    const [added, removed] = line.split('\t');
    if (/^\d+$/.test(added ?? '')) additions += Number(added);
    if (/^\d+$/.test(removed ?? '')) deletions += Number(removed);
  }
  return { additions, deletions };
}

function extractChangedSymbols(diff: string): string[] {
  const output = new Set<string>();
  const patterns = [
    /^[+-]\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm,
    /^[+-]\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    /^[+-]\s*def\s+([A-Za-z_][\w]*)\s*\(/gm,
    /^[+-]\s*class\s+([A-Za-z_][\w]*)\b/gm,
  ];
  for (const pattern of patterns) {
    for (const match of diff.matchAll(pattern)) {
      const symbol = match[1];
      if (symbol) output.add(symbol);
    }
  }
  return [...output].sort();
}

function isDocumentationPath(filePath: string): boolean {
  return /(^|\/)(docs?|documentation)(\/|$)/i.test(filePath)
    || /(^|\/)(README|CHANGELOG|TODO|CONTRIBUTING|POLICY|MODULE|ADR)[^/]*\.md$/i.test(filePath)
    || /\.mdx?$/i.test(filePath);
}
