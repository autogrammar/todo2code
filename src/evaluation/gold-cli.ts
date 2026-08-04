#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  evaluateGoldDataset,
  goldReportIsPerfect,
  loadGoldDataset,
  renderGoldReportMarkdown,
} from './gold.js';

type GoldCliInput = {
  datasetArg: string;
  json: boolean;
  requirePerfect: boolean;
  outPath: string | undefined;
};

function parseGoldCliInput(args: string[]): GoldCliInput {
  let datasetArg = 'evaluation/gold/v1/dataset.json';
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--out') {
      index += 1;
      continue;
    }
    if (arg && !arg.startsWith('--')) {
      datasetArg = arg;
      break;
    }
  }

  const json = args.includes('--json');
  const requirePerfect = args.includes('--require-perfect');
  const outIndex = args.indexOf('--out');
  const outPath = outIndex >= 0 ? args[outIndex + 1] : undefined;
  if (outIndex >= 0 && !outPath) {
    throw new Error('--out requires a path');
  }

  return {
    datasetArg,
    json,
    requirePerfect,
    outPath,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { datasetArg, json, requirePerfect, outPath } = parseGoldCliInput(args);
  const dataset = await loadGoldDataset(path.resolve(datasetArg));
  const report = await evaluateGoldDataset(dataset);
  const rendered = json ? `${JSON.stringify(report, null, 2)}\n` : renderGoldReportMarkdown(report);
  if (outPath) {
    await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
    await fs.writeFile(path.resolve(outPath), rendered, 'utf8');
  }
  process.stdout.write(rendered);
  if (requirePerfect && !goldReportIsPerfect(report)) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
