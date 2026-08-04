const BOT_LOGIN = /^[A-Za-z0-9-]+\[bot\]$/;

export function trustedGithubApps(manifest) {
  const actors = manifest?.trustedApprovalActors;
  if (!actors || typeof actors !== 'object' || Array.isArray(actors)
      || Object.keys(actors).length !== 1 || !Array.isArray(actors.githubApps)
      || actors.githubApps.length === 0) {
    throw new Error('trustedApprovalActors.githubApps must be a non-empty array');
  }
  const logins = new Set();
  for (const actor of actors.githubApps) {
    if (!actor || typeof actor !== 'object' || Array.isArray(actor)
        || Object.keys(actor).sort().join(',') !== 'login,type'
        || actor.type !== 'Bot' || typeof actor.login !== 'string'
        || !BOT_LOGIN.test(actor.login)) {
      throw new Error('trusted GitHub App actor must contain only a valid bot login and type=Bot');
    }
    const normalized = actor.login.toLowerCase();
    if (logins.has(normalized)) throw new Error('trusted GitHub App actor logins must be unique');
    logins.add(normalized);
  }
  return logins;
}

export function resolveTrustedApproval({ reviews, authorLogin, headSha, manifest }) {
  if (!Array.isArray(reviews) || typeof authorLogin !== 'string'
      || !/^[0-9a-f]{40}$/.test(headSha)) {
    throw new Error('approval resolver input is malformed');
  }
  const trustedApps = trustedGithubApps(manifest);
  const latest = new Map();
  for (const review of reviews) {
    const login = review?.user?.login;
    if (typeof login !== 'string') continue;
    const key = login.toLowerCase();
    const previous = latest.get(key);
    if (!previous || isAtLeastAsNew(review, previous)) latest.set(key, review);
  }
  const candidates = [...latest.values()].filter(review => {
    const login = review?.user?.login;
    const type = review?.user?.type;
    if (review?.state !== 'APPROVED' || review?.commit_id !== headSha
        || typeof login !== 'string' || login.toLowerCase() === authorLogin.toLowerCase()) {
      return false;
    }
    return type === 'User' || (type === 'Bot' && trustedApps.has(login.toLowerCase()));
  }).sort((left, right) => left.user.login.localeCompare(right.user.login));

  if (candidates.length === 0) {
    return { approved: false, source: 'none', actor: null, actorType: null };
  }
  return {
    approved: true,
    source: 'github-review',
    actor: candidates[0].user.login,
    actorType: candidates[0].user.type,
  };
}

function isAtLeastAsNew(candidate, previous) {
  const candidateTime = Date.parse(candidate?.submitted_at || '') || 0;
  const previousTime = Date.parse(previous?.submitted_at || '') || 0;
  if (candidateTime !== previousTime) return candidateTime > previousTime;
  return Number(candidate?.id || 0) >= Number(previous?.id || 0);
}
