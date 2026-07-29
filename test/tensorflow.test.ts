import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifyAction } from '../src/tf/classifier.js';
import { makeConfig } from './helpers.js';

test('TensorFlow remains an explicit fallback when the isolated adapter is not installed', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-tf-isolated-'));
  const config = makeConfig(root);
  config.enableTensorFlow = true;
  config.tensorflowModelPath = path.join(root, 'model.json');

  const result = await classifyAction('Add contract validation', config);

  assert.equal(result.action, 'add');
  assert.match(result.basis, /^heuristic_fallback:/);
  assert.match(result.basis, /tensorflow\/node_modules/);
  assert.equal(result.confidence, 0.6);
});
