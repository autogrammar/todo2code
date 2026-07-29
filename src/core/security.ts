import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Resolve a candidate and ensure both its lexical path and its nearest existing
 * real path remain inside the configured root. The real-path check prevents a
 * symlink placed inside the workspace from redirecting MCP/A2A reads outside it.
 */
export async function assertPathWithinRoot(
  root: string,
  candidate: string,
  allowOutsideRoot = false,
): Promise<string> {
  const rootAbsolute = path.resolve(root);
  const candidateAbsolute = path.resolve(candidate);
  if (allowOutsideRoot) return candidateAbsolute;

  assertDescendant(rootAbsolute, candidateAbsolute, 'Requested path');

  let rootReal: string;
  try {
    rootReal = await fs.realpath(rootAbsolute);
  } catch {
    throw new Error(`Configured T2C_ROOT does not exist: ${rootAbsolute}`);
  }

  const existingAncestor = await nearestExistingPath(candidateAbsolute);
  const ancestorReal = await fs.realpath(existingAncestor);
  assertDescendant(rootReal, ancestorReal, 'Requested real path');

  return candidateAbsolute;
}

function assertDescendant(root: string, candidate: string, label: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} is outside configured T2C_ROOT: ${candidate}`);
  }
}

async function nearestExistingPath(candidate: string): Promise<string> {
  let current = candidate;
  for (;;) {
    try {
      await fs.lstat(current);
      return current;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw new Error(`No existing ancestor for path: ${candidate}`);
      current = parent;
    }
  }
}
