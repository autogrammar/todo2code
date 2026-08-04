/**
 * Validate a single-file unified diff body.
 * Accepts optional `--- a/path` / `+++ b/path` headers and rejects foreign paths.
 */
export function normalizeUnifiedDiff(diff: string, expectedPath: string): string {
  const normalized = normalizeUnifiedDiffText(diff, expectedPath);
  validateUnifiedDiffBody(normalized, expectedPath);
  validateUnifiedDiffPathHeaders(normalized, expectedPath);
  return normalized;
}

function normalizeUnifiedDiffText(diff: string, expectedPath: string): string {
  const normalized = diff.replace(/\r\n/g, '\n');
  if (!normalized.trim()) throw new Error(`Unified diff for ${expectedPath} is empty`);
  if (normalized.includes('\0')) throw new Error(`Unified diff for ${expectedPath} contains NUL bytes`);
  return normalized;
}

function validateUnifiedDiffBody(diff: string, expectedPath: string): void {
  if (/(?:api[_-]?key|secret|password|private[_-]?key)\s*[:=]\s*['"]?[^'"\s]{8,}/i.test(diff)) {
    throw new Error(`Unified diff for ${expectedPath} appears to contain a secret assignment`);
  }
}

function validateUnifiedDiffPathHeaders(diff: string, expectedPath: string): void {
  for (const header of extractUnifiedDiffHeaders(diff)) {
    validateUnifiedDiffHeaderPath(header, expectedPath);
  }
}

function extractUnifiedDiffHeaders(diff: string): string[] {
  return [...diff.matchAll(/^(?:---|\+\+\+)\s+(?:[ab]\/)?(.+)$/gm)].map((match) => match[1]!.trim());
}

function validateUnifiedDiffHeaderPath(header: string, expectedPath: string): void {
  if (header === '/dev/null') return;
  const normalizedPath = normalizeUnifiedDiffHeaderPath(header);
  assertUnifiedDiffHeaderPathSafety(normalizedPath, expectedPath);
}

function normalizeUnifiedDiffHeaderPath(header: string): string {
  return header.replace(/\\/g, '/').trim();
}

function assertUnifiedDiffHeaderPathSafety(normalizedPath: string, expectedPath: string): void {
  if (isUnifiedDiffTraversalHeader(normalizedPath)) {
    throw new Error(`Unified diff for ${expectedPath} uses a non-repository path header: ${normalizedPath}`);
  }
  if (!matchesUnifiedDiffExpectedHeader(normalizedPath, expectedPath)) {
    const bare = normalizedHeaderPathCandidate(normalizedPath);
    const stripped = stripLeadingDiffPrefix(bare);
    if (stripped !== expectedPath) {
      throw new Error(`Unified diff for ${expectedPath} references foreign path: ${normalizedPath}`);
    }
  }
}

function isUnifiedDiffTraversalHeader(normalizedPath: string): boolean {
  return normalizedPath.startsWith('/') || normalizedPath.split('/').includes('..');
}

function matchesUnifiedDiffExpectedHeader(normalizedPath: string, expectedPath: string): boolean {
  return normalizedPath === expectedPath
    || normalizedPath === `a/${expectedPath}`
    || normalizedPath === `b/${expectedPath}`;
}

function normalizedHeaderPathCandidate(normalizedPath: string): string {
  return normalizedPath.split('\t')[0] ?? normalizedPath;
}

function stripLeadingDiffPrefix(pathValue: string): string {
  return pathValue.replace(/^[ab]\//, '');
}
