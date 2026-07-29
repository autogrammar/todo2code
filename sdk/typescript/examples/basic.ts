/**
 * Usage test for the TypeScript SDK.
 *
 * Start the server first:
 *   node dist/src/interfaces/a2a.js
 *
 * Then run:
 *   npm --prefix sdk/typescript run build && node sdk/typescript/dist/examples/basic.js
 */

import { T2CClient } from '../src/index.js';

const baseUrl = process.env.T2C_A2A_URL ?? 'http://localhost:8787';
const token = process.env.T2C_A2A_TOKEN ?? null;
const root = process.env.T2C_EXAMPLE_ROOT ?? 'examples/backend';

async function main(): Promise<void> {
  const client = new T2CClient({ baseUrl, token });

  const health = await client.health();
  console.log('health:', health);

  const card = await client.agentCard();
  console.log('agent skills:', (card.skills as Array<{ id: string }> | undefined)?.map((skill) => skill.id).join(', '));

  // 1. Deterministic extraction -> graph -> diagnostics.
  const ast = await client.extractAst(root);
  const markdown = await client.call<{ records: unknown[] }>('extract_markdown', { root });
  const records = [...ast.records, ...(markdown.records as typeof ast.records)];
  console.log(`extracted ${records.length} records from ${root}`);

  const graph = await client.link(records);
  console.log('graph fingerprint:', graph.fingerprint.slice(0, 16));

  const diagnostics = await client.diagnose(graph);
  console.log('diagnostics:', diagnostics.counts);

  // 2. Intent-vs-reality view.
  const reality = await client.reality(graph, diagnostics, { includeSvg: true, gapsOnly: true });
  console.log('reality markdown lines:', reality.markdown.split('\n').length);
  console.log('reality svg bytes:', reality.svg?.length ?? 0);

  // 3. Git diff rendered as SVG.
  const gitDiff = await client.diffGit({ root, revision: 'HEAD', includeSvg: true });
  console.log(`git diff files: ${gitDiff.diffs.length}, svg bytes: ${gitDiff.svg?.length ?? 0}`);

  console.log('OK');
}

main().catch((error: unknown) => {
  console.error('example failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
