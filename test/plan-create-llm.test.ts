import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import {
  createRepositoryPathProbe,
  proposeCodeChangePlans,
} from '../src/synthesis/code-change-plan.js';

const AT = '2026-07-30T15:00:00.000Z';

test('descriptive update intents do not create missing nested paths', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-plan-desc-'));
  await fs.mkdir(path.join(root, 'src/php_app/config'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/php_app/config/emails.json'), '{}\n');
  const descriptive = buildRecord({
    kind: 'todo_item',
    action: 'change',
    object: 'deployment documentation',
    target: {
      paths: [
        'platform/scripts/deploy-stack.sh',
        'src/php_app/config/emails.json',
      ],
    },
    text: 'Update deployment documentation mentioning platform/scripts/deploy-stack.sh and src/php_app/config/emails.json.',
    lifecycle: 'planned',
    sourceKind: 'todo',
    sourcePath: 'docs/ops.md',
    sourceLines: { start: 4, end: 4 },
    extractor: 'test/plan-create-llm',
    epistemicClass: 'plan',
    confidence: 0.95,
    basis: ['fixture'],
  });
  const graph = linkIntentRecords([descriptive], AT);
  const diagnostics = diagnoseGraph(graph, AT);
  const result = proposeCodeChangePlans({
    graph,
    diagnostics,
    generatedAt: AT,
    pathExists: createRepositoryPathProbe(root),
  });
  assert.deepEqual(
    result.plans[0]?.changes.map((change) => `${change.action} ${change.path}`),
    ['modify src/php_app/config/emails.json'],
  );

  const explicit = buildRecord({
    kind: 'todo_item',
    action: 'add',
    object: 'deployment documentation',
    target: {
      paths: [
        'platform/scripts/deploy-stack.sh',
        'src/php_app/config/emails.json',
      ],
    },
    text: 'Create platform/scripts/deploy-stack.sh and update src/php_app/config/emails.json.',
    lifecycle: 'planned',
    sourceKind: 'todo',
    sourcePath: 'docs/ops.md',
    sourceLines: { start: 4, end: 4 },
    extractor: 'test/plan-create-llm',
    epistemicClass: 'plan',
    confidence: 0.95,
    basis: ['fixture'],
  });
  const explicitGraph = linkIntentRecords([explicit], AT);
  const explicitResult = proposeCodeChangePlans({
    graph: explicitGraph,
    diagnostics: diagnoseGraph(explicitGraph, AT),
    generatedAt: AT,
    pathExists: createRepositoryPathProbe(root),
  });
  assert.deepEqual(
    explicitResult.plans[0]?.changes.map((change) => `${change.action} ${change.path}`),
    ['create platform/scripts/deploy-stack.sh', 'modify src/php_app/config/emails.json'],
  );
});
