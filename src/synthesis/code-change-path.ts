/**
 * A plan may only name a file inside the analysed repository that an agent can
 * reasonably implement.
 *
 * Extraction is the first line of defence, but records also arrive from
 * hand-written TODO items and from the LLM. One unusable value must degrade to
 * "this plan names fewer paths", never to a crashed pipeline: on an external
 * platform repository an absolute host path aborted the whole run at the
 * contract boundary, after every earlier stage had already succeeded.
 *
 * Paths under vendored trees (venv/site-packages/node_modules), binary assets,
 * and pure analysis dumps are not implementation targets and must not become
 * code-change plans.
 */
const NON_SOURCE_DIR_SEGMENTS = new Set([
  '.git',
  '.hg',
  '.svn',
  '.venv',
  'venv',
  '.testvenv',
  'testvenv',
  '.tox',
  '.nox',
  '.mypy_cache',
  '.pytest_cache',
  '.ruff_cache',
  '.code2llm_cache',
  '__pycache__',
  'node_modules',
  'site-packages',
  'dist-packages',
  'dist',
  'build',
  'coverage',
  'htmlcov',
  '.eggs',
  'eggs',
  'vendor',
  'third_party',
  'third-party',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.tiff',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.mp4',
  '.webm',
  '.zip',
  '.tar',
  '.gz',
  '.tgz',
  '.whl',
  '.egg',
  '.so',
  '.dylib',
  '.dll',
  '.pyc',
  '.pyo',
  '.class',
  '.o',
  '.a',
  '.wasm',
  '.sqlite',
  '.db',
]);

const GENERATED_ANALYSIS_BASENAMES = new Set([
  'analysis.toon',
  'analysis.toon.yaml',
  'analysis.yaml',
  'analysis.json',
  'map.toon',
  'map.toon.yaml',
  'flow.toon',
  'flow.toon.yaml',
  'flow.mmd',
  'flow.png',
  'calls.mmd',
  'calls.png',
  'calls.toon',
  'calls.toon.yaml',
  'calls.yaml',
  'compact_flow.mmd',
  'compact_flow.png',
  'duplication.toon',
  'duplication.toon.yaml',
  'evolution.toon',
  'evolution.toon.yaml',
  'validation.toon',
  'validation.toon.yaml',
  'context.md',
  'dashboard.html',
  'index.html',
  '.code2llm_incremental.json',
  'code2llm_incremental.json',
]);

const T2C_ARTIFACT_BASENAMES = new Set([
  'code_change.review.json',
  'code_change.review.md',
  'code-change-plans.json',
  'code-change-source-patches.json',
  'communication-analysis.json',
  'communication-analysis.md',
  'diagnostics.json',
  'intent.graph.json',
  'manifest.json',
  'summary-conclusions.json',
  'team-summary.md',
  'todo-validation.json',
  'todo.patch',
  'todo.patch.json',
]);

const EXTENSIONLESS_SOURCE_BASENAMES = new Set([
  'dockerfile',
  'gemfile',
  'jenkinsfile',
  'justfile',
  'makefile',
  'procfile',
  'rakefile',
  'vagrantfile',
]);

/** Exported for unit tests and koru/ticket2dsl usefulness checks. */
export function isUsefulCodeChangePath(value: string): boolean {
  return isPlannablePath(value);
}

function isPlannablePath(value: string): boolean {
  const normalized = normalizePlannablePath(value);
  if (!isCandidatePathSyntax(normalized)) return false;

  const segments = splitPathSegments(normalized);
  if (isInvalidSegmentShape(segments)) return false;
  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  if (!isConcretePath(segments, lowerSegments)) return false;
  if (hasShellPattern(normalized)) return false;
  if (isDisallowedSegment(lowerSegments)) return false;

  const basename = segments[segments.length - 1] ?? '';
  return isPlannableBasename(lowerSegments, basename);
}

function normalizePlannablePath(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

function isCandidatePathSyntax(normalized: string): boolean {
  return Boolean(normalized)
    && !normalized.startsWith('/')
    && !normalized.endsWith('/')
    && !/^[a-z][a-z\d+.-]*:/i.test(normalized);
}

function splitPathSegments(normalized: string): string[] {
  return normalized.split('/').filter(Boolean);
}

function isInvalidSegmentShape(segments: string[]): boolean {
  return !segments.length || segments.includes('.') || segments.includes('..');
}

function isConcretePath(segments: string[], lowerSegments: string[]): boolean {
  if (segments.length === 0) return false;
  if (/^[~$%]/.test(segments[0] ?? '')) return false;
  if (segments.includes('~')) return false;
  return lowerSegments.every((segment) => segment !== '');
}

function hasShellPattern(normalized: string): boolean {
  return /[*?[\]{}]/.test(normalized);
}

function isDisallowedSegment(segments: string[]): boolean {
  for (const segment of segments) {
    if (NON_SOURCE_DIR_SEGMENTS.has(segment)) return true;
    if (segment === '.intent' || segment.startsWith('.intent-')) return true;
    if (segment.endsWith('.egg-info') || segment.endsWith('.dist-info')) return true;
  }
  return false;
}

function isPlannableBasename(lowerSegments: string[], basename: string): boolean {
  const lowerBasename = basename.toLowerCase();
  if (!basename) return false;
  if (T2C_ARTIFACT_BASENAMES.has(lowerBasename)) return false;
  if (lowerSegments.length === 1 && lowerBasename === 'prompt.txt') return false;
  if (!basename.includes('.') && !EXTENSIONLESS_SOURCE_BASENAMES.has(lowerBasename)) return false;

  const dot = basename.lastIndexOf('.');
  if (dot > 0) {
    const ext = basename.slice(dot).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) return false;
  }

  if (isGeneratedArtifactPath(lowerSegments, lowerBasename)) return false;
  if (lowerBasename.includes('code2llm_incremental')) return false;

  return true;
}

function isGeneratedArtifactPath(lowerSegments: string[], lowerBasename: string): boolean {
  if (
    lowerSegments[0] === 'project'
    && (GENERATED_ANALYSIS_BASENAMES.has(lowerBasename)
      || lowerBasename.endsWith('.toon')
      || lowerBasename.endsWith('.toon.yaml')
      || lowerBasename.endsWith('.mmd')
      || lowerBasename.endsWith('.json')
      || lowerBasename === 'prompt.txt'
      || lowerBasename === 'readme.md')
  ) {
    return true;
  }

  return lowerSegments[0] === '.koru' || lowerSegments[0] === '.code2llm_cache';
}
 
