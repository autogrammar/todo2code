import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTrustedApproval, trustedGithubApps } from './resolve-approval.mjs';

const headSha = 'a'.repeat(40);
const manifest = {
  trustedApprovalActors: {
    githubApps: [{ login: 'ifuri-validator-agent[bot]', type: 'Bot' }],
  },
};
const activeTickets = ['ticket-034'];

const review = (overrides = {}) => ({
  id: 1,
  state: 'APPROVED',
  commit_id: headSha,
  submitted_at: '2026-08-04T10:00:00Z',
  user: { login: 'reviewer', type: 'User' },
  body: '',
  ...overrides,
});

test('accepts an independent human User approval on the exact head', () => {
  const result = resolveTrustedApproval({ reviews: [review()], authorLogin: 'author', headSha, activeTickets, manifest });
  assert.deepEqual(result, {
    approved: true, source: 'github-review', actor: 'reviewer', actorType: 'User',
    approvedTickets: ['ticket-034'], correlationId: null,
  });
});

test('accepts only the exact allowlisted GitHub App on the exact head', () => {
  const app = review({
    user: { login: 'ifuri-validator-agent[bot]', type: 'Bot' },
    body: 'Ticket: `ticket-034`\nCorrelation ID: `todo2code-pr-13-head`',
  });
  const unknown = review({ id: 2, user: { login: 'unknown[bot]', type: 'Bot' } });
  const result = resolveTrustedApproval({ reviews: [unknown, app], authorLogin: 'author', headSha, activeTickets, manifest });
  assert.equal(result.approved, true);
  assert.equal(result.actor, 'ifuri-validator-agent[bot]');
  assert.deepEqual(result.approvedTickets, ['ticket-034']);
  assert.equal(result.correlationId, 'todo2code-pr-13-head');
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
    const result = resolveTrustedApproval({ reviews: [candidate], authorLogin: 'author', headSha, activeTickets, manifest });
    assert.equal(result.approved, false);
  }
});

test('latest review state for an actor wins and stale approval cannot survive dismissal', () => {
  const approved = review();
  const dismissed = review({ id: 2, state: 'DISMISSED', submitted_at: '2026-08-04T11:00:00Z' });
  const result = resolveTrustedApproval({ reviews: [approved, dismissed], authorLogin: 'author', headSha, activeTickets, manifest });
  assert.equal(result.approved, false);
});

test('allowlisted App must bind an active ticket and safe correlation ID', () => {
  const app = (body) => review({
    user: { login: 'ifuri-validator-agent[bot]', type: 'Bot' }, body,
  });
  for (const body of [
    '',
    'Ticket: `ticket-999`\nCorrelation ID: `safe`',
    'Ticket: `ticket-034`',
    'Ticket: `ticket-034`\nCorrelation ID: `unsafe value`',
  ]) {
    const result = resolveTrustedApproval({ reviews: [app(body)], authorLogin: 'author', headSha, activeTickets, manifest });
    assert.equal(result.approved, false);
  }
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
