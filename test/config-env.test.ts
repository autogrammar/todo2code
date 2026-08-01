import assert from 'node:assert/strict';
import test from 'node:test';
import { getConfig } from '../src/config/env.js';

const MODEL_ENV_NAMES = [
  'OPENROUTER_MODEL',
  'OPENROUTER_NL_MODEL',
  'OPENROUTER_MARKDOWN_MODEL',
  'OPENROUTER_COMMUNICATION_MODEL',
  'OPENROUTER_DOC_MODEL',
  'OPENROUTER_SUMMARY_MODEL',
  'OPENROUTER_TASK_MODEL',
] as const;

function withModelEnvironment(
  values: Partial<Record<(typeof MODEL_ENV_NAMES)[number], string>>,
  assertion: () => void,
): void {
  const previous = new Map(MODEL_ENV_NAMES.map((name) => [name, process.env[name]]));
  try {
    for (const name of MODEL_ENV_NAMES) delete process.env[name];
    for (const [name, value] of Object.entries(values)) process.env[name] = value;
    assertion();
  } finally {
    for (const name of MODEL_ENV_NAMES) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('semantic stages inherit the benchmark-qualified OpenRouter default', () => {
  withModelEnvironment({}, () => {
    const openRouter = getConfig(process.cwd()).openRouter;
    assert.equal(openRouter.model, 'google/gemini-3.1-pro-preview');
    assert.equal(openRouter.nlModel, openRouter.model);
    assert.equal(openRouter.markdownModel, openRouter.model);
    assert.equal(openRouter.communicationModel, openRouter.model);
    assert.equal(openRouter.documentModel, openRouter.model);
    assert.equal(openRouter.summaryModel, openRouter.model);
    assert.equal(openRouter.taskModel, openRouter.model);
  });
});

test('global and stage-specific OpenRouter model overrides remain authoritative', () => {
  withModelEnvironment({ OPENROUTER_MODEL: 'test/global', OPENROUTER_TASK_MODEL: 'test/task' }, () => {
    const openRouter = getConfig(process.cwd()).openRouter;
    assert.equal(openRouter.model, 'test/global');
    assert.equal(openRouter.nlModel, 'test/global');
    assert.equal(openRouter.summaryModel, 'test/global');
    assert.equal(openRouter.taskModel, 'test/task');
  });
});
