import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { buildRecord } from '../src/core/record.js';
import {
  createCodeChangePlanHash,
  createCodeChangePlanId,
  createCodeChangeSourcePatchHash,
  createCodeChangeSourcePatchId,
} from '../src/core/id.js';
import { assertCodeChangeAcceptance } from '../src/core/schema.js';
import type { IntentGraph } from '../src/core/types.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import {
  applyCodeChangeSourcePatch,
  applyUnifiedDiffToText,
  assertCodeChangeReviewPatch,
  assertCodeChangeSourcePatch,
  createCodeChangeReviewPatch,
  createCodeChangeSourcePatch,
  createCodeChangeSourcePatchSet,
  createRepositoryPathProbe,
  evaluateCodeChangeAcceptance,
  isUsefulCodeChangePath,
  proposeCodeChangePlans,
  type ProposeCodeChangePlansResult,
} from '../src/synthesis/code-change-plan.js';
import { sha256 } from '../src/core/id.js';
import { T2C_VERSION } from '../src/version.js';

const AT = '2026-07-30T15:00:00.000Z';
const exec = promisify(execFile);

function plannedTodo(): IntentGraph {
  const plan = buildRecord({
    kind: 'todo_item',
    action: 'add',
    object: 'validateContract',
    target: { paths: ['src/contracts.ts'], symbols: ['validateContract'], tickets: ['T2C-401'] },
    text: 'Add validateContract in src/contracts.ts for T2C-401.',
    lifecycle: 'planned',
    sourceKind: 'todo',
    sourcePath: 'TODO.md',
    sourceLines: { start: 3, end: 3 },
    extractor: 'test/code-change',
    epistemicClass: 'plan',
    confidence: 0.98,
    basis: ['fixture'],
  });
  return linkIntentRecords([plan], AT);
}

function implementedGraph(): IntentGraph {
  const plan = buildRecord({
    kind: 'todo_item',
    action: 'add',
    object: 'validateContract',
    target: { paths: ['src/contracts.ts'], symbols: ['validateContract'], tickets: ['T2C-401'] },
    text: 'Add validateContract in src/contracts.ts for T2C-401.',
    lifecycle: 'planned',
    sourceKind: 'todo',
    sourcePath: 'TODO.md',
    sourceLines: { start: 3, end: 3 },
    extractor: 'test/code-change',
    epistemicClass: 'plan',
    confidence: 0.98,
    basis: ['fixture'],
  });
  const fact = buildRecord({
    kind: 'symbol_fact',
    action: 'declare',
    object: 'validateContract',
    target: { paths: ['src/contracts.ts'], symbols: ['validateContract'], tickets: ['T2C-401'] },
    text: 'declare validateContract',
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: 'src/contracts.ts',
    sourceLines: { start: 10, end: 20 },
    symbol: 'validateContract',
    extractor: 'test/code-change',
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['fixture'],
    metadata: { language: 'typescript', exported: true },
  });
  return linkIntentRecords([plan, fact], AT);
}

test('proposeCodeChangePlans materialises grounded plans from PLANNED_NOT_IMPLEMENTED', () => {
  const graph = plannedTodo();
  const diagnostics = diagnoseGraph(graph, AT);
  const open = diagnostics.diagnostics.find((item) => item.code === 'PLANNED_NOT_IMPLEMENTED');
  assert.ok(open);

  const result = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT });
  assert.equal(result.schemaVersion, 't2c.code-change-plan-set/v1');
  assert.equal(result.generation.generator, 't2c/code-change-plan-set');
  assert.equal(result.generation.runtimeVersion, T2C_VERSION);
  assert.equal(result.plans.length, 1);
  const plan = result.plans[0]!;
  assert.match(plan.id, /^CPLAN-[a-f0-9]{20}$/);
  assert.match(plan.planHash, /^[a-f0-9]{64}$/);
  assert.equal(plan.status, 'proposed');
  assert.equal(plan.id, `CPLAN-${plan.planHash.slice(0, 20)}`);
  assert.deepEqual(plan.evidence.diagnosticIds, [open.id]);
  assert.deepEqual(plan.target.paths, ['src/contracts.ts']);
  assert.deepEqual(plan.target.symbols, ['validateContract']);
  assert.deepEqual(plan.target.tickets, ['T2C-401']);
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0]!.path, 'src/contracts.ts');
  assert.equal(plan.changes[0]!.action, 'modify');
  assert.equal(
    plan.changes[0]!.rationale,
    'Implement the source intent: Add validateContract in src/contracts.ts for T2C-401.',
  );
  assert.equal(plan.risk.level, 'low');
  assert.ok(plan.risk.reasons.length > 0);
  assert.match(plan.rollback, /revert/i);
  assert.equal(plan.generation.runtimeVersion, T2C_VERSION);
  assert.equal(plan.generation.effectiveMode, 'deterministic');
  assert.ok(plan.acceptanceCriteria.some((item) => item.includes(open.id)));
});

test('code-change title preserves the leading action of a compound intent', () => {
  // The deterministic classifier sees `verify` before `implement` in its
  // precedence table. `inferObject` then removes the secondary verb and leaves
  // "Implement ... and it", which used to render as "Implement Implement ...".
  const record = buildRecord({
    kind: 'todo_item', action: 'validate',
    object: 'Implement bounded retry backoff in `src/retry.py` and it in `tests/test_retry.py`',
    target: { paths: ['src/retry.py', 'tests/test_retry.py'] },
    text: 'Implement bounded retry backoff in `src/retry.py` and verify it in `tests/test_retry.py`.',
    lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md',
    sourceLines: { start: 1, end: 1 }, extractor: 'test/code-change',
    epistemicClass: 'plan', confidence: 0.9, basis: ['fixture'],
  });
  const graph = linkIntentRecords([record], AT);
  const diagnostics = diagnoseGraph(graph, AT);
  const result = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT });

  assert.equal(result.plans.length, 1);
  assert.equal(
    result.plans[0]?.title,
    'Implement bounded retry backoff in `src/retry.py` and verify it in `tests/test_retry.py`',
  );
});

test('proposeCodeChangePlans is deterministic for the same evidence', () => {
  const graph = plannedTodo();
  const diagnostics = diagnoseGraph(graph, AT);
  const first = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT });
  const second = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT });
  assert.deepEqual(first.plans, second.plans);
  assert.throws(
    () => proposeCodeChangePlans({ graph, diagnostics, maxPlans: Number.POSITIVE_INFINITY }),
    /maxPlans must be an integer between 1 and 500/,
  );
  assert.throws(
    () => proposeCodeChangePlans({ graph, diagnostics, generatedAt: 'not-a-date' }),
    /generatedAt must be an ISO date-time/,
  );
});

test('a plan creates a missing file and modifies an existing one', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-plan-probe-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'contracts.ts'), 'export {};\n');
  const graph = plannedTodo();
  const diagnostics = diagnoseGraph(graph, AT);

  const probe = createRepositoryPathProbe(root);
  const existing = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT, pathExists: probe });
  assert.equal(existing.plans[0]?.changes[0]?.action, 'modify');

  await fs.rm(path.join(root, 'src', 'contracts.ts'));
  const missing = proposeCodeChangePlans({
    graph, diagnostics, generatedAt: AT, pathExists: createRepositoryPathProbe(root),
  });
  assert.equal(missing.plans[0]?.changes[0]?.action, 'create');
  // The action is part of the plan hash, so an executor cannot receive a
  // create instruction under an identity minted for a modify plan.
  assert.notEqual(missing.plans[0]?.planHash, existing.plans[0]?.planHash);

  // Without a probe the runtime cannot know, and keeps the conservative action.
  const unprobed = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT });
  assert.equal(unprobed.plans[0]?.changes[0]?.action, 'modify');
});

test('a plan never invents a repository-root file from a bare filename', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-plan-bare-'));
  await fs.mkdir(path.join(root, 'pkg'), { recursive: true });
  await fs.writeFile(path.join(root, 'pkg', '__init__.py'), '\n');
  await fs.writeFile(path.join(root, 'setup.cfg'), '\n');
  const plan = buildRecord({
    kind: 'todo_item', action: 'add', object: 'version sync',
    // `__init__.py` exists 1x under pkg/ but not at the root, `it.md` is a
    // prose fragment, `docs/GUIDE.md` names a real location, `setup.cfg` is
    // a real root file.
    target: { paths: ['__init__.py', 'it.md', 'docs/GUIDE.md', 'setup.cfg'] },
    text: 'Sync `__version__` across `__init__.py` files and document it.',
    lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md',
    sourceLines: { start: 1, end: 1 }, extractor: 'test/code-change',
    epistemicClass: 'plan', confidence: 0.95, basis: ['fixture'],
  });
  const graph = linkIntentRecords([plan], AT);
  const diagnostics = diagnoseGraph(graph, AT);
  const result = proposeCodeChangePlans({
    graph, diagnostics, generatedAt: AT, pathExists: createRepositoryPathProbe(root),
  });
  assert.deepEqual(
    result.plans[0]?.changes.map((change) => `${change.action} ${change.path}`),
    ['create docs/GUIDE.md', 'modify setup.cfg'],
  );
});

test('a plan whose every path is bare and missing is withheld entirely', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-plan-withheld-'));
  const plan = buildRecord({
    kind: 'todo_item', action: 'add', object: 'unit tests',
    target: { paths: ['it.md', 'potr.md'] },
    text: 'Update "TODO/uruchamiać unit testy z pytest, it.md".',
    lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md',
    sourceLines: { start: 1, end: 1 }, extractor: 'test/code-change',
    epistemicClass: 'plan', confidence: 0.95, basis: ['fixture'],
  });
  const graph = linkIntentRecords([plan], AT);
  const diagnostics = diagnoseGraph(graph, AT);
  assert.ok(diagnostics.diagnostics.some((item) => item.code === 'PLANNED_NOT_IMPLEMENTED'));
  const result = proposeCodeChangePlans({
    graph, diagnostics, generatedAt: AT, pathExists: createRepositoryPathProbe(root),
  });
  assert.equal(result.plans.length, 0);
});

test('a plan never targets a location outside the repository tree', () => {
  assert.equal(isUsefulCodeChangePath('~/.urirun-host/mesh.json'), false);
  assert.equal(isUsefulCodeChangePath('~root/mesh.json'), false);
  assert.equal(isUsefulCodeChangePath('$HOME/mesh.json'), false);
  assert.equal(isUsefulCodeChangePath('%APPDATA%/mesh.json'), false);
  assert.equal(isUsefulCodeChangePath('src/mesh.json'), true);
});

test('the repository probe never proposes creating a file outside the root', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-plan-escape-'));
  const probe = createRepositoryPathProbe(root);
  assert.equal(probe('../outside.ts'), true);
  assert.equal(probe('inside.ts'), false);
});

test('bounded plan sets prefer explicit TODO work over historical changelog audit', () => {
  const todo = buildRecord({
    kind: 'todo_item', action: 'add', object: 'module entrypoint',
    target: { paths: ['pkg/__main__.py'] },
    text: 'Add pkg/__main__.py to support python -m pkg.',
    lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md',
    sourceLines: { start: 1, end: 1 }, extractor: 'test/code-change',
    epistemicClass: 'plan', confidence: 0.95, basis: ['fixture'],
  });
  const historical = buildRecord({
    kind: 'changelog_item', action: 'release', object: 'legacy import',
    target: { paths: ['src/legacy.py'], versions: ['0.1.0'] },
    text: 'Updated legacy import in src/legacy.py.',
    lifecycle: 'released', sourceKind: 'changelog', sourcePath: 'CHANGELOG.md',
    sourceLines: { start: 5, end: 5 }, extractor: 'test/code-change',
    epistemicClass: 'claim', confidence: 0.9, basis: ['fixture'],
  });
  const graph = linkIntentRecords([historical, todo], AT);
  const diagnostics = diagnoseGraph(graph, AT);
  assert.ok(diagnostics.diagnostics.some((item) => item.code === 'CHANGELOG_WITHOUT_IMPLEMENTATION'));

  const result = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT, maxPlans: 1 });
  assert.equal(result.plans.length, 1);
  assert.deepEqual(result.plans[0]?.evidence.recordIds, [todo.id]);
});

test('evaluateCodeChangeAcceptance passes when targeted diagnostics clear', () => {
  const beforeGraph = plannedTodo();
  const beforeDiagnostics = diagnoseGraph(beforeGraph, AT);
  const { plans } = proposeCodeChangePlans({
    graph: beforeGraph,
    diagnostics: beforeDiagnostics,
    generatedAt: AT,
  });
  assert.equal(plans.length, 1);

  const afterGraph = implementedGraph();
  const acceptance = evaluateCodeChangeAcceptance({
    plan: plans[0]!,
    before: { graph: beforeGraph, diagnostics: beforeDiagnostics },
    afterGraph,
    evaluatedAt: AT,
  });

  assert.equal(acceptance.schemaVersion, 't2c.code-change-acceptance/v1');
  assert.equal(acceptance.accepted, true);
  assert.deepEqual(acceptance.remainingDiagnosticIds, []);
  assert.deepEqual(acceptance.newBlockingDiagnosticIds, []);
  assert.ok(acceptance.clearedDiagnosticIds.includes(plans[0]!.evidence.diagnosticIds[0]!));
  assert.ok(acceptance.reasons.some((item) => /passed/i.test(item)));
  assert.equal(acceptance.generation.generator, 't2c/code-change-acceptance');
  assert.equal(acceptance.generation.runtimeVersion, T2C_VERSION);
  assert.equal(acceptance.generation.generatedAt, acceptance.evaluatedAt);
});

test('evaluateCodeChangeAcceptance fails while the plan is still open', () => {
  const beforeGraph = plannedTodo();
  const beforeDiagnostics = diagnoseGraph(beforeGraph, AT);
  const { plans } = proposeCodeChangePlans({
    graph: beforeGraph,
    diagnostics: beforeDiagnostics,
    generatedAt: AT,
  });

  const acceptance = evaluateCodeChangeAcceptance({
    plan: plans[0]!,
    before: { graph: beforeGraph, diagnostics: beforeDiagnostics },
    afterGraph: beforeGraph,
    afterDiagnostics: beforeDiagnostics,
    evaluatedAt: AT,
  });

  assert.equal(acceptance.accepted, false);
  assert.deepEqual(acceptance.remainingDiagnosticIds, plans[0]!.evidence.diagnosticIds);
  assert.ok(acceptance.reasons.some((item) => /still open/i.test(item)));
});

test('Plans without repository paths are not invented', () => {
  const vague = buildRecord({
    kind: 'todo_item',
    action: 'add',
    object: 'something useful',
    target: {},
    text: 'Add something useful somewhere.',
    lifecycle: 'planned',
    sourceKind: 'todo',
    sourcePath: 'TODO.md',
    sourceLines: { start: 1, end: 1 },
    extractor: 'test/code-change',
    epistemicClass: 'plan',
    confidence: 0.9,
    basis: ['fixture'],
  });
  const graph = linkIntentRecords([vague], AT);
  const diagnostics = diagnoseGraph(graph, AT);
  const result = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT });
  assert.equal(result.plans.length, 0);
  assert.ok(result.sourceDiagnosticCount >= 1);
});

test('Non-repository paths are ignored instead of aborting code-change planning', () => {
  const unsafe = buildRecord({
    kind: 'todo_item', action: 'configure', object: 'Docker socket',
    target: { paths: ['/var/run/docker.sock', '../outside.env'] },
    text: 'Configure the host Docker socket.', lifecycle: 'planned', sourceKind: 'todo',
    sourcePath: 'TODO.md', sourceLines: { start: 1, end: 1 }, extractor: 'test/code-change',
    epistemicClass: 'plan', confidence: 0.9, basis: ['fixture'],
  });
  const graph = linkIntentRecords([unsafe], AT);
  const diagnostics = diagnoseGraph(graph, AT);
  assert.doesNotThrow(() => proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT }));
  assert.equal(proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT }).plans.length, 0);
});

test('Acceptance rejects ungrounded paths, missing provenance and inconsistent verdicts', () => {
  const beforeGraph = plannedTodo();
  const beforeDiagnostics = diagnoseGraph(beforeGraph, AT);
  const plan = proposeCodeChangePlans({ graph: beforeGraph, diagnostics: beforeDiagnostics, generatedAt: AT }).plans[0]!;
  const afterGraph = implementedGraph();
  const afterDiagnostics = diagnoseGraph(afterGraph, AT);

  const ungrounded = structuredClone(plan);
  ungrounded.changes[0]!.path = 'src/unrelated.ts';
  assert.throws(() => evaluateCodeChangeAcceptance({
    plan: ungrounded,
    before: { graph: beforeGraph, diagnostics: beforeDiagnostics },
    afterGraph,
    afterDiagnostics,
    evaluatedAt: AT,
  }), /not present in target\.paths/);

  const anonymous = structuredClone(plan) as unknown as Record<string, unknown>;
  delete anonymous.generation;
  assert.throws(() => evaluateCodeChangeAcceptance({
    plan: anonymous as unknown as typeof plan,
    before: { graph: beforeGraph, diagnostics: beforeDiagnostics },
    afterGraph,
    afterDiagnostics,
    evaluatedAt: AT,
  }), /missing: generation/);

  const foreign = structuredClone(plan);
  foreign.evidence.graphFingerprint = afterGraph.fingerprint;
  foreign.planHash = createCodeChangePlanHash(foreign);
  foreign.id = createCodeChangePlanId(foreign);
  assert.throws(() => evaluateCodeChangeAcceptance({
    plan: foreign,
    before: { graph: beforeGraph, diagnostics: beforeDiagnostics },
    afterGraph,
    afterDiagnostics,
    evaluatedAt: AT,
  }), /evidence\.graphFingerprint does not match its graph/);

  const acceptance = evaluateCodeChangeAcceptance({
    plan,
    before: { graph: beforeGraph, diagnostics: beforeDiagnostics },
    afterGraph,
    afterDiagnostics,
    evaluatedAt: AT,
  });
  const inconsistent = { ...acceptance, accepted: false };
  assert.throws(() => assertCodeChangeAcceptance(inconsistent, {
    plan,
    before: { graph: beforeGraph, diagnostics: beforeDiagnostics },
    after: { graph: afterGraph, diagnostics: afterDiagnostics },
  }), /accepted flag is inconsistent/);
});

test('createCodeChangeSourcePatch is deterministic and path-bound', () => {
  const graph = plannedTodo();
  const diagnostics = diagnoseGraph(graph, AT);
  const plan = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT }).plans[0]!;
  const first = createCodeChangeSourcePatch({ plan, createdAt: AT });
  const second = createCodeChangeSourcePatch({ plan, createdAt: AT });
  assert.deepEqual(first, second);
  assert.match(first.id, /^SPATCH-[a-f0-9]{20}$/);
  assert.equal(first.id, `SPATCH-${first.patchHash.slice(0, 20)}`);
  assert.equal(first.planId, plan.id);
  assert.equal(first.edits.length, 1);
  assert.equal(first.edits[0]!.path, 'src/contracts.ts');
  assert.equal(first.edits[0]!.unifiedDiff, null);
  assert.match(first.edits[0]!.instruction, /validateContract/);

  const missingProvenance = structuredClone(plan) as unknown as Record<string, unknown>;
  delete missingProvenance.generation;
  assert.throws(() => createCodeChangeSourcePatch({
    plan: missingProvenance as unknown as typeof plan,
    createdAt: AT,
  }), /missing: generation/);

  const withDiff = createCodeChangeSourcePatch({
    plan,
    createdAt: AT,
    unifiedDiffs: {
      'src/contracts.ts': [
        '--- a/src/contracts.ts',
        '+++ b/src/contracts.ts',
        '@@ -1 +1,2 @@',
        ' export {}',
        '+export function validateContract() { return true; }',
        '',
      ].join('\n'),
    },
  });
  assert.ok(withDiff.edits[0]!.unifiedDiff?.includes('validateContract'));

  assert.throws(() => createCodeChangeSourcePatch({
    plan,
    unifiedDiffs: {
      'src/other.ts': '--- a/src/other.ts\n+++ b/src/other.ts\n',
    },
  }), /not declared by plan/);

  assert.throws(() => createCodeChangeSourcePatch({
    plan,
    unifiedDiffs: {
      'src/contracts.ts': '--- a/../secret.env\n+++ b/../secret.env\n@@ -0,0 +1 @@\n+x\n',
    },
  }), /non-repository path|foreign path/);

  assert.throws(() => createCodeChangeSourcePatch({
    plan,
    unifiedDiffs: {
      'src/contracts.ts': [
        '--- a/src/contracts.ts',
        '+++ b/src/contracts.ts',
        '@@ -0,0 +1 @@',
        ['+pass', 'word = "', 'xxx-blocked-by-runtime', '"'].join(''),
        '',
      ].join('\n'),
    },
  }), /secret assignment/);

  const wrongAction = structuredClone(first);
  wrongAction.edits[0]!.action = 'delete';
  wrongAction.patchHash = createCodeChangeSourcePatchHash(wrongAction);
  wrongAction.id = createCodeChangeSourcePatchId(wrongAction);
  assert.throws(() => assertCodeChangeSourcePatch(wrongAction, plan), /action.*does not match the plan/);

  const invalidGeneration = structuredClone(first) as unknown as Record<string, unknown>;
  delete invalidGeneration.generation;
  assert.throws(() => assertCodeChangeSourcePatch(invalidGeneration, plan), /keys must be exactly/);
});

test('applyUnifiedDiffToText creates and modifies files from hunks', () => {
  const created = applyUnifiedDiffToText('', [
    '--- /dev/null',
    '+++ b/src/contracts.ts',
    '@@ -0,0 +1,3 @@',
    '+export function validateContract() {',
    '+  return true;',
    '+}',
    '',
  ].join('\n'), 'src/contracts.ts');
  assert.match(created, /validateContract/);

  const modified = applyUnifiedDiffToText('export {}\n', [
    '--- a/src/contracts.ts',
    '+++ b/src/contracts.ts',
    '@@ -1 +1,2 @@',
    ' export {}',
    '+export const ok = true;',
    '',
  ].join('\n'), 'src/contracts.ts');
  assert.equal(modified, 'export {}\nexport const ok = true;\n');
});

test('applyCodeChangeSourcePatch requires approval and is idempotent', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-source-apply-'));
  const graph = plannedTodo();
  const diagnostics = diagnoseGraph(graph, AT);
  const plan = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT }).plans[0]!;
  const patch = createCodeChangeSourcePatch({
    plan,
    createdAt: AT,
    unifiedDiffs: {
      'src/contracts.ts': [
        '--- /dev/null',
        '+++ b/src/contracts.ts',
        '@@ -0,0 +1,1 @@',
        '+export function validateContract() { return true; }',
        '',
      ].join('\n'),
    },
  });
  await assert.rejects(() => applyCodeChangeSourcePatch({
    root,
    patch,
    approval: { actor: 'reviewer', patchHash: patch.patchHash },
    receiptPath: path.join(root, 'src/contracts.ts'),
  }), /collides with its receipt path/);

  await assert.rejects(() => applyCodeChangeSourcePatch({
    root,
    patch,
    approval: { actor: 'reviewer', patchHash: '0'.repeat(64) },
    receiptPath: path.join(root, 'receipt.json'),
  }), /approval hash does not match/);

  const first = await applyCodeChangeSourcePatch({
    root,
    patch,
    approval: { actor: 'reviewer', patchHash: patch.patchHash },
    receiptPath: path.join(root, 'receipt.json'),
  });
  assert.equal(first.applied, true);
  assert.equal(first.idempotent, false);
  assert.equal(first.receipt.generation.generator, 't2c/code-change-source-apply');
  assert.equal(first.receipt.generation.runtimeVersion, T2C_VERSION);
  assert.equal(first.receipt.generation.model, null);
  const body = await fs.readFile(path.join(root, 'src/contracts.ts'), 'utf8');
  assert.match(body, /validateContract/);

  const second = await applyCodeChangeSourcePatch({
    root,
    patch,
    approval: { actor: 'reviewer', patchHash: patch.patchHash },
    receiptPath: path.join(root, 'receipt.json'),
  });
  assert.equal(second.applied, false);
  assert.equal(second.idempotent, true);

  await fs.writeFile(path.join(root, 'src/contracts.ts'), 'tampered\n', 'utf8');
  await assert.rejects(() => applyCodeChangeSourcePatch({
    root,
    patch,
    approval: { actor: 'reviewer', patchHash: patch.patchHash },
    receiptPath: path.join(root, 'receipt.json'),
  }), /state changed after receipt/);
});

test('applyCodeChangeSourcePatch preflights diffs and refuses symlink escapes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-source-preflight-'));
  const graph = plannedTodo();
  const diagnostics = diagnoseGraph(graph, AT);
  const plan = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT }).plans[0]!;
  const instructionOnly = createCodeChangeSourcePatch({ plan, createdAt: AT });
  await assert.rejects(() => applyCodeChangeSourcePatch({
    root,
    patch: instructionOnly,
    approval: { actor: 'reviewer', patchHash: instructionOnly.patchHash },
    receiptPath: path.join(root, 'receipt.json'),
  }), /has no unifiedDiff/);

  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-source-outside-'));
  await fs.writeFile(path.join(outside, 'contracts.ts'), 'outside\n', 'utf8');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.symlink(path.join(outside, 'contracts.ts'), path.join(root, 'src/contracts.ts'));
  const patch = createCodeChangeSourcePatch({
    plan,
    createdAt: AT,
    unifiedDiffs: {
      'src/contracts.ts': '--- /dev/null\n+++ b/src/contracts.ts\n@@ -0,0 +1 @@\n+safe\n',
    },
  });
  await assert.rejects(() => applyCodeChangeSourcePatch({
    root,
    patch,
    approval: { actor: 'reviewer', patchHash: patch.patchHash },
    receiptPath: path.join(root, 'receipt.json'),
  }), /outside configured T2C_ROOT|symlink/);
  assert.equal(await fs.readFile(path.join(outside, 'contracts.ts'), 'utf8'), 'outside\n');
});

test('createCodeChangeSourcePatchSet covers every plan', () => {
  const graph = plannedTodo();
  const diagnostics = diagnoseGraph(graph, AT);
  const planSet = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT });
  const patches = createCodeChangeSourcePatchSet({
    plans: planSet.plans,
    graphFingerprint: planSet.graphFingerprint,
    generatedAt: AT,
  });
  assert.equal(patches.schemaVersion, 't2c.code-change-source-patch-set/v1');
  assert.equal(patches.patches.length, planSet.plans.length);
  assert.equal(patches.patches[0]!.planId, planSet.plans[0]!.id);
});

test('createCodeChangeReviewPatch is hash-stable and lists grounded paths', () => {
  const graph = plannedTodo();
  const diagnostics = diagnoseGraph(graph, AT);
  const planSet = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT });
  const first = createCodeChangeReviewPatch({
    plans: planSet.plans,
    graphFingerprint: planSet.graphFingerprint,
    createdAt: AT,
  });
  const second = createCodeChangeReviewPatch({
    plans: planSet.plans,
    graphFingerprint: planSet.graphFingerprint,
    createdAt: AT,
  });
  assert.equal(first.markdown, second.markdown);
  assert.equal(first.artifact.renderedPatchHash, sha256(first.markdown));
  assert.deepEqual(first.artifact.planIds, [planSet.plans[0]!.id]);
  assert.match(first.markdown, /src\/contracts\.ts/);
  assert.match(first.markdown, /evaluate-code-change/);
  assert.ok(first.markdown.includes('<!-- t2c.code-change-review/v1 -->'));
  const invalidArtifact = structuredClone(first.artifact) as unknown as Record<string, unknown>;
  delete invalidArtifact.generation;
  assert.throws(() => assertCodeChangeReviewPatch(invalidArtifact), /missing: generation/);
  assert.throws(() => createCodeChangeReviewPatch({
    plans: planSet.plans,
    graphFingerprint: '0'.repeat(64),
    createdAt: AT,
  }), /evidence\.graphFingerprint does not match its graph/);
  const tampered = structuredClone(planSet.plans);
  tampered[0]!.changes[0]!.path = 'src/tampered.ts';
  assert.throws(() => createCodeChangeReviewPatch({
    plans: tampered,
    graphFingerprint: planSet.graphFingerprint,
    createdAt: AT,
  }), /not present in target\.paths|planHash does not match semantic content/);
  const missingProvenance = structuredClone(planSet.plans) as unknown as Array<Record<string, unknown>>;
  delete missingProvenance[0]!.generation;
  assert.throws(() => createCodeChangeReviewPatch({
    plans: missingProvenance as unknown as typeof planSet.plans,
    graphFingerprint: planSet.graphFingerprint,
    createdAt: AT,
  }), /missing: generation/);
});

test('CLI proposes and evaluates a grounded code-change plan through persisted JSON', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-code-change-cli-'));
  const cli = path.resolve('dist/src/cli.js');
  const beforeGraph = plannedTodo();
  const beforeDiagnostics = diagnoseGraph(beforeGraph, AT);
  const afterGraph = implementedGraph();
  await Promise.all([
    fs.writeFile(path.join(root, 'before.graph.json'), `${JSON.stringify(beforeGraph)}\n`, 'utf8'),
    fs.writeFile(path.join(root, 'before.diagnostics.json'), `${JSON.stringify(beforeDiagnostics)}\n`, 'utf8'),
    fs.writeFile(path.join(root, 'after.graph.json'), `${JSON.stringify(afterGraph)}\n`, 'utf8'),
  ]);
  const environment = { ...process.env, T2C_ROOT: root, T2C_ENV_FILE: 'missing.env', OPENROUTER_API_KEY: '' };

  const proposed = await exec(process.execPath, [
    cli, 'propose-code-change', 'before.graph.json',
    '--diagnostics', 'before.diagnostics.json', '--out', 'plans.json',
  ], { cwd: root, env: environment });
  const planSet = JSON.parse(proposed.stdout) as ProposeCodeChangePlansResult;
  assert.equal(planSet.plans.length, 1);
  assert.equal(planSet.generation.generator, 't2c/code-change-plan-set');
  await fs.writeFile(path.join(root, 'plan.json'), `${JSON.stringify(planSet.plans[0])}\n`, 'utf8');

  const rendered = await exec(process.execPath, [
    cli, 'render-code-change', 'plans.json',
    '--patch', 'CODE_CHANGE.review.md', '--audit', 'CODE_CHANGE.review.json',
  ], { cwd: root, env: environment });
  const review = JSON.parse(rendered.stdout) as {
    artifact: { renderedPatchHash: string; schemaVersion: string };
    markdown: string;
  };
  assert.equal(review.artifact.schemaVersion, 't2c.code-change-review/v1');
  assert.equal(review.artifact.renderedPatchHash, sha256(review.markdown));
  assert.match(await fs.readFile(path.join(root, 'CODE_CHANGE.review.md'), 'utf8'), /src\/contracts\.ts/);

  const evaluated = await exec(process.execPath, [
    cli, 'evaluate-code-change', 'plan.json',
    '--before-graph', 'before.graph.json', '--before-diagnostics', 'before.diagnostics.json',
    '--after-graph', 'after.graph.json', '--out', 'acceptance.json',
  ], { cwd: root, env: environment });
  const acceptance = JSON.parse(evaluated.stdout) as { accepted: boolean; generation: { generator: string } };
  assert.equal(acceptance.accepted, true);
  assert.equal(acceptance.generation.generator, 't2c/code-change-acceptance');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'acceptance.json'), 'utf8')), acceptance);

  await fs.copyFile(path.join(root, 'plans.json'), path.join(root, 'change-input.json'));
  const closed = await exec(process.execPath, [
    cli, 'close-code-change', 'change-input.json',
    '--before-graph', 'before.graph.json', '--before-diagnostics', 'before.diagnostics.json',
    '--after-graph', 'after.graph.json', '--out', 'close.json',
  ], { cwd: root, env: environment });
  const closeResult = JSON.parse(closed.stdout) as {
    schemaVersion: string;
    allAccepted: boolean;
    acceptedCount: number;
    planCount: number;
    generation: { generator: string; runtimeVersion: string; model: null };
  };
  assert.equal(closeResult.schemaVersion, 't2c.code-change-close-result/v1');
  assert.equal(closeResult.planCount, 1);
  assert.equal(closeResult.acceptedCount, 1);
  assert.equal(closeResult.allAccepted, true);
  assert.equal(closeResult.generation.generator, 't2c/code-change-close-result');
  assert.equal(closeResult.generation.runtimeVersion, T2C_VERSION);
  assert.equal(closeResult.generation.model, null);
});

test('isUsefulCodeChangePath rejects vendored, binary and analysis dump paths', () => {
  assert.equal(isUsefulCodeChangePath('src/contracts.ts'), true);
  assert.equal(isUsefulCodeChangePath('packages/core/index.py'), true);
  assert.equal(isUsefulCodeChangePath('public/index.html'), true);
  assert.equal(isUsefulCodeChangePath('docs/context.md'), true);
  assert.equal(isUsefulCodeChangePath('assets/architecture.svg'), true);
  assert.equal(isUsefulCodeChangePath('package-lock.json'), true);
  assert.equal(isUsefulCodeChangePath('Cargo.lock'), true);
  assert.equal(isUsefulCodeChangePath('Dockerfile'), true);
  assert.equal(isUsefulCodeChangePath('tools/Makefile'), true);
  assert.equal(isUsefulCodeChangePath('.testvenv/lib/python3.13/site-packages/pip/auth.py'), false);
  assert.equal(isUsefulCodeChangePath('node_modules/left-pad/index.js'), false);
  assert.equal(isUsefulCodeChangePath('.intent-demo/runs/latest/manifest.json'), false);
  assert.equal(isUsefulCodeChangePath('project/compact_flow.png'), false);
  assert.equal(isUsefulCodeChangePath('project/analysis.toon.yaml'), false);
  assert.equal(isUsefulCodeChangePath('project/context.md'), false);
  assert.equal(isUsefulCodeChangePath('project/index.html'), false);
  assert.equal(isUsefulCodeChangePath('project'), false);
  assert.equal(isUsefulCodeChangePath('src/core'), false);
  assert.equal(isUsefulCodeChangePath('summary-conclusions.json'), false);
  assert.equal(isUsefulCodeChangePath('CODE_CHANGE.review.json'), false);
  assert.equal(isUsefulCodeChangePath('Prompt.txt'), false);
  assert.equal(isUsefulCodeChangePath('examples/*/*'), false);
  assert.equal(isUsefulCodeChangePath('/abs/path.ts'), false);
  assert.equal(isUsefulCodeChangePath('C:\\outside\\path.ts'), false);
  assert.equal(isUsefulCodeChangePath('https://example.test/source.ts'), false);
});

test('proposeCodeChangePlans skips diagnostics that only name junk paths', () => {
  const junk = buildRecord({
    kind: 'todo_item',
    action: 'add',
    object: 'vendored helper',
    target: {
      paths: ['.testvenv/lib/python3.13/site-packages/pip/_internal/network/auth.py'],
      symbols: ['get_keyring_provider'],
      tickets: [],
    },
    text: 'Refactor get_keyring_provider in .testvenv site-packages.',
    lifecycle: 'planned',
    sourceKind: 'todo',
    sourcePath: 'TODO.md',
    sourceLines: { start: 9, end: 9 },
    extractor: 'test/code-change',
    epistemicClass: 'plan',
    confidence: 0.9,
    basis: ['fixture'],
  });
  const graph = linkIntentRecords([junk], AT);
  const diagnostics = diagnoseGraph(graph, AT);
  const result = proposeCodeChangePlans({ graph, diagnostics, generatedAt: AT });
  assert.equal(result.plans.length, 0);
});

test('Published code-change JSON schemas require provenance, risk and rollback', async () => {
  const [plan, planSet, acceptance, review, closeResult, sourceReceipt] = await Promise.all([
    fs.readFile(path.resolve('schemas/code-change-plan.schema.json'), 'utf8'),
    fs.readFile(path.resolve('schemas/code-change-plan-set.schema.json'), 'utf8'),
    fs.readFile(path.resolve('schemas/code-change-acceptance.schema.json'), 'utf8'),
    fs.readFile(path.resolve('schemas/code-change-review.schema.json'), 'utf8'),
    fs.readFile(path.resolve('schemas/code-change-close-result.schema.json'), 'utf8'),
    fs.readFile(path.resolve('schemas/code-change-source-apply-receipt.schema.json'), 'utf8'),
  ]).then((values) => values.map((value) => JSON.parse(value) as { required: string[] }));
  assert.ok(['risk', 'rollback', 'generation'].every((field) => plan!.required.includes(field)));
  assert.ok(planSet!.required.includes('generation'));
  assert.ok(acceptance!.required.includes('generation'));
  assert.ok(['renderedPatchHash', 'planIds', 'generation'].every((field) => review!.required.includes(field)));
  assert.ok(['acceptances', 'evaluatedAt', 'generation'].every((field) => closeResult!.required.includes(field)));
  assert.ok(['patchHash', 'approvedBy', 'fileHashesAfter', 'generation']
    .every((field) => sourceReceipt!.required.includes(field)));
});
