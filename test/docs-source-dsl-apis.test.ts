import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertIntentRecords,
  code2dsl,
  config2dsl,
  docs2dsl,
  extractAstIntent,
  extractConfigurationIntent,
  extractDocumentationBaseline,
} from '../src/index.js';
import { makeConfig } from './helpers.js';

test('standalone source DSL facades preserve their canonical extractor results', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-source-dsl-api-'));
  const docsDirectory = path.join(root, 'docs');
  const documentation = path.join(docsDirectory, 'ARCHITECTURE.md');
  await fs.mkdir(docsDirectory, { recursive: true });
  await fs.writeFile(path.join(root, 'runtime.ts'), [
    'export function validateContract(): boolean {',
    '  return true;',
    '}',
    '',
  ].join('\n'));
  await fs.writeFile(documentation, [
    '# Runtime architecture',
    '',
    'The runtime must call `validateContract` from `runtime.ts` before use.',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(root, 'package.json'), '{"name":"standalone-fixture","scripts":{"test":"node --test"}}\n');
  await fs.writeFile(path.join(root, '.env.example'), 'APP_MODE=development\n');
  const providerKeyName = ['OPENROUTER', 'API', 'KEY'].join('_');
  const providerKeyValue = ['test', 'secret', 'material'].join('-');
  await fs.writeFile(path.join(root, '.env'), `${providerKeyName}=${providerKeyValue}\n`);

  const config = makeConfig(root);
  config.cacheEnabled = false;
  config.enablePythonAst = false;

  const canonicalCode = await extractAstIntent({ root }, config);
  const standaloneCode = await code2dsl({ root }, config);
  assert.deepEqual(standaloneCode, canonicalCode);

  const canonicalDocs = await extractDocumentationBaseline({ root, files: [documentation] }, config);
  const standaloneDocs = await docs2dsl({ root, files: ['docs/ARCHITECTURE.md'] }, config);
  assert.deepEqual(standaloneDocs, canonicalDocs);

  const discoveredDocs = await docs2dsl({ root, patterns: ['docs/**/*.md'], excludes: [] }, config);
  assert.deepEqual(discoveredDocs, canonicalDocs);

  const canonicalConfig = await extractConfigurationIntent(root, config);
  const standaloneConfig = await config2dsl({ root }, config);
  assert.deepEqual(standaloneConfig, canonicalConfig);

  for (const result of [standaloneCode, standaloneDocs, standaloneConfig]) {
    assert.doesNotThrow(() => assertIntentRecords(result.records));
  }
  assert.ok(standaloneCode.records.every((record) => record.source.kind === 'ast'));
  assert.ok(standaloneDocs.records.every((record) => record.source.kind === 'document'));
  assert.ok(standaloneConfig.records.every((record) => record.source.kind === 'system'));
  assert.ok(standaloneConfig.records.some((record) => record.source.path === '.env.example'));
  assert.ok(!standaloneConfig.records.some((record) => record.source.path === '.env'));
  assert.ok(!JSON.stringify(standaloneConfig).includes(providerKeyValue));
});

test('standalone source DSL facades reject invalid or foreign roots and files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-source-dsl-options-'));
  const config = makeConfig(root);
  config.cacheEnabled = false;
  config.enablePythonAst = false;

  await assert.rejects(
    code2dsl({ root: '' }, config),
    /code2dsl\.options\.root must be a non-empty string/,
  );
  await assert.rejects(
    docs2dsl({ root, files: ['../foreign.md'] }, config),
    /docs2dsl\.options\.files must stay inside root/,
  );
  await assert.rejects(
    config2dsl({ root: '' }, config),
    /config2dsl\.options\.root must be a non-empty string/,
  );
});
