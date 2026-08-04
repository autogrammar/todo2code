import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTrustedApproval, trustedGithubApps } from './resolve-approval.mjs';

const headSha = 'a'.repeat(40);
const manifest = {
  trustedApprovalActors: {
    githubApps: [{ login: 'ifuri-validator-agent[bot]', type: 'Bot' }],
  },
};

const review = (overrides = {}) => ({
  id: 1,
  state: 'APPROVED',
  commit_id: headSha,
  submitted_at: '2026-08-04T10:00:00Z',
  user: { login: 'reviewer', type: 'User' },
  ...overrides,
});

test('accepts an independent human User approval on the exact head', () => {
  const result = resolveTrustedApproval({ reviews: [review()], authorLogin: 'author', headSha, manifest });
  assert.deepEqual(result, {
    approved: true, source: 'github-review', actor: 'reviewer', actorType: 'User',
  });
});

test('accepts only the exact allowlisted GitHub App on the exact head', () => {
  const app = review({ user: { login: 'ifuri-validator-agent[bot]', type: 'Bot' } });
  const unknown = review({ id: 2, user: { login: 'unknown[bot]', type: 'Bot' } });
  const result = resolveTrustedApproval({ reviews: [unknown, app], authorLogin: 'author', headSha, manifest });
  assert.equal(result.approved, true);
  assert.equal(result.actor, 'ifuri-validator-agent[bot]');
});

test('rejects unknown bots, stale commits, same-author and non-approved reviews', () => {
  const fixtures = [
    review({ user: { login: 'unknown[bot]', type: 'Bot' } }),
    review({ commit_id: 'b'.repeat(40) }),
    review({ user: { login: 'author', type: 'User' } }),
    review({ state: 'DISMISSED' }),
    review({ state: 'CHANGES_REQUESTED' }),
  ];
  for (const candidate of fixtures) {
    const result = resolveTrustedApproval({ reviews: [candidate], authorLogin: 'author', headSha, manifest });
    assert.equal(result.approved, false);
  }
});

test('latest review state for an actor wins and stale approval cannot survive dismissal', () => {
  const approved = review();
  const dismissed = review({ id: 2, state: 'DISMISSED', submitted_at: '2026-08-04T11:00:00Z' });
  const result = resolveTrustedApproval({ reviews: [approved, dismissed], authorLogin: 'author', headSha, manifest });
  assert.equal(result.approved, false);
});

test('rejects malformed and duplicate trusted App allowlists', () => {
  const malformed = [
    {},
    { trustedApprovalActors: { githubApps: [] } },
    { trustedApprovalActors: { githubApps: [{ login: 'human', type: 'Bot' }] } },
    { trustedApprovalActors: { githubApps: [{ login: 'app[bot]', type: 'User' }] } },
    { trustedApprovalActors: { githubApps: [
      { login: 'app[bot]', type: 'Bot' }, { login: 'APP[bot]', type: 'Bot' },
    ] } },
  ];
  for (const value of malformed) assert.throws(() => trustedGithubApps(value));
});
