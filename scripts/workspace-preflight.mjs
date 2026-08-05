#!/usr/bin/env node
import {
  inspectWorkspace,
  WorkspacePreflightError,
} from '../dist/src/services/workspace-preflight.js';

const usage = `Usage: make preflight PREFLIGHT_EXPECTED_BRANCH=<branch> [PREFLIGHT_BASELINE=<full-local-ref>]

Direct invocation:
  node scripts/workspace-preflight.mjs --expected-branch <branch> [options]

Options:
  --root <path>              Git worktree root (default: .)
  --baseline <full-ref>      Local baseline (default: refs/remotes/origin/main)
  --expected-branch <name>   Required current branch name
  --actor <agent|human|ci>   Governance actor (default: agent)
  --help                     Show this help
`;

function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { help: true };
  if (argv.includes('--help')) throw new Error('--help cannot be combined with other options');
  if (argv.length % 2 !== 0) throw new Error(`missing value for ${argv.at(-1)}`);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    if (!['--root', '--baseline', '--expected-branch', '--actor'].includes(option)) {
      throw new Error(`unknown option: ${option}`);
    }
    if (values.has(option)) throw new Error(`duplicate option: ${option}`);
    const value = argv[index + 1];
    if (value.startsWith('--')) throw new Error(`missing value for ${option}`);
    values.set(option, value);
  }
  return {
    help: false,
    root: optionValue(values, '--root', '.'),
    baselineRef: optionValue(values, '--baseline', 'refs/remotes/origin/main'),
    expectedBranch: optionValue(values, '--expected-branch', ''),
    actor: optionValue(values, '--actor', 'agent'),
  };
}

function optionValue(values, option, fallback) {
  return values.has(option) ? values.get(option) : fallback;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`workspace preflight input error: ${error instanceof Error ? error.message : 'invalid arguments'}\n`);
    process.exitCode = 1;
    return;
  }
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  if (!options.expectedBranch) {
    process.stderr.write('workspace preflight input error: expected branch is required\n');
    process.exitCode = 1;
    return;
  }
  try {
    const report = await inspectWorkspace({
      root: options.root,
      baselineRef: options.baselineRef,
      expectedBranch: options.expectedBranch,
      actor: options.actor,
    });
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.exitCode = report.verdict === 'PASS' ? 0 : 2;
  } catch (error) {
    const message = error instanceof WorkspacePreflightError
      ? error.message
      : 'unexpected runtime failure';
    process.stderr.write(`workspace preflight failed: ${message}\n`);
    process.exitCode = 1;
  }
}

await main();
