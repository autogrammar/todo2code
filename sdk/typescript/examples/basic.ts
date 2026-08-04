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

const TODO_PATH = '.intent-sdk/typescript/TODO.patch';
const AUDIT_PATH = '.intent-sdk/typescript/TODO.patch.json';
const RECEIPT_PATH = '.intent-sdk/typescript/TODO.patch.receipt.json';

interface ExampleContext {
  baseUrl: string;
  token: string | null;
  root: string;
}

interface ExtractionArtifacts {
  graph: Awaited<ReturnType<T2CClient['link']>>;
  diagnostics: Awaited<ReturnType<T2CClient['diagnose']>>;
  extractedRecords: number;
}

interface ProposalArtifacts {
  newProposalIds: string[];
  duplicateProposalIds: string[];
  patchHash: string;
}

async function main(): Promise<void> {
  const context = readExampleContext();
  const client = new T2CClient({ baseUrl: context.baseUrl, token: context.token });

  const extraction = await runExtractionFlow(client, context.root);
  console.log(`extracted ${extraction.extractedRecords} records from ${context.root}`);

  const patch = await runProposalFlow(client, context.root, extraction.graph, extraction.diagnostics);
  console.log(`proposal ids: ${patch.newProposalIds.join(',') || '-'}`);
  console.log(`duplicate ids: ${patch.duplicateProposalIds.join(',') || '-'}`);
  console.log(`patch fingerprint: ${patch.patchHash.slice(0, 16)}`);

  await runRealityAndDiff(client, extraction.graph, extraction.diagnostics, context.root);
  await runWorkspaceComparison(client, context.root);

  console.log('OK');
}

main().catch((error: unknown) => {
  console.error('example failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

function readExampleContext(): ExampleContext {
  return {
    baseUrl: process.env.T2C_A2A_URL ?? 'http://localhost:8787',
    token: process.env.T2C_A2A_TOKEN ?? null,
    root: process.env.T2C_EXAMPLE_ROOT ?? 'examples/backend',
  };
}

async function runExtractionFlow(client: T2CClient, root: string): Promise<ExtractionArtifacts> {
  const agentCard = await client.agentCard();
  console.log('agent skills:', (agentCard.skills as Array<{ id: string }> | undefined)?.map((skill) => skill.id).join(', '));

  const [nl, ast, markdown] = await Promise.all([
    client.extractNl('task.md', root, 'deterministic'),
    client.extractAst(root),
    client.extractMarkdown(root, { markdownMode: 'deterministic' }),
  ]);

  assertExtractionState(nl.audit, 'NL');
  if (markdown.audit?.status !== 'succeeded') {
    throw new Error(`unexpected Markdown audit: ${JSON.stringify(markdown.audit)}`);
  }
  console.log('markdown audit:', markdown.audit.status, markdown.audit.effectiveMode);

  const records = [...nl.records, ...ast.records, ...markdown.records];
  const graph = await client.link(records);
  console.log('graph fingerprint:', graph.fingerprint.slice(0, 16));

  const diagnostics = await client.diagnose(graph);
  console.log('diagnostics:', diagnostics.counts);
  for (const diagnostic of diagnostics.diagnostics.slice(0, 3)) {
    console.log(`  - [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.title}`);
  }

  return {
    graph,
    diagnostics,
    extractedRecords: records.length,
  };
}

function assertExtractionState(audit: unknown, label: string): void {
  if (
    typeof audit !== 'object'
    || audit === null
    || !('status' in audit)
    || (audit as { status?: string }).status !== 'succeeded'
  ) {
    throw new Error(`unexpected ${label} audit: ${JSON.stringify(audit)}`);
  }
  console.log(`${label} audit: ${(audit as { status: string; effectiveMode?: string }).status} ${(audit as { effectiveMode?: string }).effectiveMode}`);
}

async function runProposalFlow(
  client: T2CClient,
  root: string,
  graph: Awaited<ReturnType<T2CClient['link']>>,
  diagnostics: Awaited<ReturnType<T2CClient['diagnose']>>,
): Promise<ProposalArtifacts> {
  const synthesis = await client.proposeTodo({
    root,
    graph,
    diagnostics,
    mode: 'prefer-llm',
  });

  const rendered = await client.renderTodo({
    root,
    graph,
    diagnostics,
    synthesis,
    todo: 'TODO.md',
    patch: TODO_PATH,
    audit: AUDIT_PATH,
  });

  const artifact = rendered.artifact as { renderedPatchHash: string };
  const patchHash = artifact.renderedPatchHash;
  await client.applyTodo({
    root,
    todo: 'TODO.md',
    patch: TODO_PATH,
    audit: AUDIT_PATH,
    receipt: RECEIPT_PATH,
    actor: 'sdk-typescript',
    approvalHash: patchHash,
  });

  const validation = synthesis.validation as {
    newProposalIds: string[];
    duplicateProposalIds: string[];
  };

  return {
    newProposalIds: validation.newProposalIds,
    duplicateProposalIds: validation.duplicateProposalIds,
    patchHash,
  };
}

async function runRealityAndDiff(
  client: T2CClient,
  graph: Awaited<ReturnType<T2CClient['link']>>,
  diagnostics: Awaited<ReturnType<T2CClient['diagnose']>>,
  root: string,
): Promise<void> {
  const reality = await client.reality(graph, diagnostics, { includeSvg: true, gapsOnly: true });
  console.log('reality markdown lines:', reality.markdown.split('\n').length);
  console.log('reality svg bytes:', reality.svg?.length ?? 0);

  const gitDiff = await client.diffGit({ root, revision: 'HEAD', includeSvg: true });
  console.log(`git diff files: ${gitDiff.diffs.length}, svg bytes: ${gitDiff.svg?.length ?? 0}`);
}

async function runWorkspaceComparison(client: T2CClient, root: string): Promise<void> {
  if (process.env.T2C_COMPARE_WORKSPACE !== '1') {
    return;
  }

  const comparison = await client.compareWorkspace({ root, base: process.env.T2C_COMPARE_BASE ?? 'origin/main' });
  const direction = (comparison.trend as { direction?: string } | undefined)?.direction;
  console.log('workspace trend:', direction);
}
