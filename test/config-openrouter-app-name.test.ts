import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { getConfig } from '../src/config/env.js';

const controlledVariables = ['OPENROUTER_APP_NAME', 'T2C_ROOT'] as const;

function withEnvironment(
  values: Partial<Record<(typeof controlledVariables)[number], string>>,
  assertion: () => void,
): void {
  const previous = new Map(controlledVariables.map((name) => [name, process.env[name]]));
  try {
    for (const name of controlledVariables) {
      const value = values[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    assertion();
  } finally {
    for (const name of controlledVariables) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('explicit OPENROUTER_APP_NAME overrides the project folder name', () => {
  withEnvironment({ OPENROUTER_APP_NAME: ' registered-application ', T2C_ROOT: 'customer-portal' }, () => {
    assert.equal(getConfig('/workspace').openRouter.appName, 'registered-application');
  });
});

test('missing or blank OPENROUTER_APP_NAME falls back to the resolved project folder', () => {
  withEnvironment({ T2C_ROOT: path.join('customers', 'billing-api') }, () => {
    assert.equal(getConfig('/workspace').openRouter.appName, 'billing-api');
  });

  withEnvironment({ OPENROUTER_APP_NAME: '   ', T2C_ROOT: path.join('customers', 'support-console') }, () => {
    assert.equal(getConfig('/workspace').openRouter.appName, 'support-console');
  });
});

test('OpenRouter application identity remains non-empty for a filesystem root', () => {
  withEnvironment({ T2C_ROOT: path.parse(process.cwd()).root }, () => {
    assert.ok(getConfig(path.parse(process.cwd()).root).openRouter.appName.length > 0);
  });
});
