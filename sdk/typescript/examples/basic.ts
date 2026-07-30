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
  const nl = await client.extractNl('task.md', root, 'deterministic');
  if (nl.audit?.status !== 'succeeded' || nl.audit.effectiveMode !== 'deterministic') {
    throw new Error(`unexpected NL audit: ${JSON.stringify(nl.audit)}`);
  }
  console.log('NL audit:', nl.audit.status, nl.audit.effectiveMode);
  const ast = await client.extractAst(root);
  const markdown = await client.extractMarkdown(root, { markdownMode: 'deterministic' });
  if (markdown.audit?.status !== 'succeeded') throw new Error(`unexpected Markdown audit: ${JSON.stringify(markdown.audit)}`);
  console.log('markdown audit:', markdown.audit.status, markdown.audit.effectiveMode);
  const records = [...nl.records, ...ast.records, ...markdown.records];
  console.log(`extracted ${records.length} records from ${root}`);

  const graph = await client.link(records);
  console.log('graph fingerprint:', graph.fingerprint.slice(0, 16));

  const diagnostics = await client.diagnose(graph);
  console.log('diagnostics:', diagnostics.counts);

  // 2. Audited propose -> review -> approved apply. With secrets disabled the
  // proposal stage degrades explicitly and the approved patch is a safe no-op.
  const synthesis = await client.proposeTodo({ root, graph, diagnostics, mode: 'prefer-llm' });
  const validation = synthesis.validation as { newProposalIds: string[]; duplicateProposalIds: string[] };
  const rendered = await client.renderTodo({
    root, graph, diagnostics, synthesis, todo: 'TODO.md',
    patch: '.intent-sdk/typescript/TODO.patch', audit: '.intent-sdk/typescript/TODO.patch.json',
  });
  const artifact = rendered.artifact as { renderedPatchHash: string };
  await client.applyTodo({
    root, todo: 'TODO.md', patch: '.intent-sdk/typescript/TODO.patch',
    audit: '.intent-sdk/typescript/TODO.patch.json', receipt: '.intent-sdk/typescript/TODO.patch.receipt.json',
    actor: 'sdk-typescript', approvalHash: artifact.renderedPatchHash,
  });
  console.log('proposal ids:', validation.newProposalIds.join(',') || '-');
  console.log('duplicate ids:', validation.duplicateProposalIds.join(',') || '-');
  console.log('patch fingerprint:', artifact.renderedPatchHash.slice(0, 16));

  // 3. Intent-vs-reality view.
  const reality = await client.reality(graph, diagnostics, { includeSvg: true, gapsOnly: true });
  console.log('reality markdown lines:', reality.markdown.split('\n').length);
  console.log('reality svg bytes:', reality.svg?.length ?? 0);

  // 4. Git diff rendered as SVG.
  const gitDiff = await client.diffGit({ root, revision: 'HEAD', includeSvg: true });
  console.log(`git diff files: ${gitDiff.diffs.length}, svg bytes: ${gitDiff.svg?.length ?? 0}`);

  // 5. Optional origin/main -> local filesystem Intent comparison.
  if (process.env.T2C_COMPARE_WORKSPACE === '1') {
    const comparison = await client.compareWorkspace({ root, base: process.env.T2C_COMPARE_BASE ?? 'origin/main' });
    console.log('workspace trend:', (comparison.trend as { direction?: string } | undefined)?.direction);
  }

  console.log('OK');
}

main().catch((error: unknown) => {
  console.error('example failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
