import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { extractAstIntent } from '../src/extractors/ast.js';
import { makeConfig } from './helpers.js';

const execFileAsync = promisify(execFile);

const SAMPLE = `<?php
namespace Demo\\Queue;

use Psr\\Log\\LoggerInterface;

final class RetryPolicy
{
    public function retryWithBackoff(LoggerInterface $logger): int
    {
        $logger->info('retry');
        return calculateDelay(2);
    }
}

function calculateDelay(int $attempt): int
{
    return min(30, min(20, $attempt * 2));
}
`;

async function phpAvailable(): Promise<boolean> {
  try {
    await execFileAsync('php', ['--version'], { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

function phpConfig(root: string) {
  const config = makeConfig(root);
  config.enablePythonAst = false;
  config.enablePhpAst = true;
  return config;
}

test('PHP syntax adapter records namespaces, imports, types, functions, methods and calls', async (t) => {
  if (!await phpAvailable()) return t.skip('PHP runtime not installed');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-php-ast-'));
  await fs.writeFile(path.join(root, 'RetryPolicy.php'), SAMPLE, 'utf8');

  const result = await extractAstIntent({ root }, phpConfig(root));
  const php = result.records.filter((record) => record.metadata.language === 'php');
  const objects = new Set(php.map((record) => record.statement.object));

  assert.ok(objects.has('Demo\\Queue'), 'namespace');
  assert.ok(objects.has('Psr\\Log\\LoggerInterface'), 'use dependency');
  assert.ok(objects.has('RetryPolicy'), 'class');
  assert.ok(objects.has('RetryPolicy.retryWithBackoff'), 'qualified method');
  assert.ok(objects.has('calculateDelay'), 'function');
  assert.ok(php.some((record) => record.statement.kind === 'php_call_fact' && record.statement.object === '$logger.info'));
  assert.ok(php.some((record) => record.statement.kind === 'php_call_fact' && record.statement.object === 'min'));
  assert.equal(php.filter((record) => record.statement.kind === 'php_call_fact' && record.statement.object === 'min').length, 1,
    'identical calls on one source line collapse to one semantic fact');
  assert.ok(!result.warnings.some((warning) => warning.includes('UNSUPPORTED_AST_FILES: php=')));
  for (const record of php) {
    assert.equal(record.epistemic.class, 'fact');
    assert.equal(record.epistemic.confidence, 1);
    assert.deepEqual(record.epistemic.basis, ['php_syntax_tokens']);
    assert.equal(record.source.extractor, 't2c/php-syntax@1');
    assert.equal(record.metadata.llmUsed, false);
  }
});

test('PHP adapter skips runtime startup when no PHP source exists', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-php-empty-'));
  await fs.writeFile(path.join(root, 'runtime.ts'), 'export const ok = true;\n', 'utf8');
  const config = phpConfig(root);
  config.phpExecutable = 'missing-php';

  const result = await extractAstIntent({ root }, config);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.records.some((record) => record.source.path === 'runtime.ts'));
});

test('Missing PHP runtime degrades to an explicit warning', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-php-missing-'));
  await fs.writeFile(path.join(root, 'index.php'), '<?php function ready(): bool { return true; }\n', 'utf8');
  const config = phpConfig(root);
  config.phpExecutable = 'missing-php';

  const result = await extractAstIntent({ root }, config);
  assert.equal(result.records.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0] ?? '', /PHP AST extraction failed/);
});

test('Invalid PHP syntax is reported without aborting extraction', async (t) => {
  if (!await phpAvailable()) return t.skip('PHP runtime not installed');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-php-invalid-'));
  await fs.writeFile(path.join(root, 'broken.php'), '<?php function broken( {\n', 'utf8');

  const result = await extractAstIntent({ root }, phpConfig(root));
  assert.equal(result.records.length, 0);
  assert.match(result.warnings.join('\n'), /broken\.php:/);
});
