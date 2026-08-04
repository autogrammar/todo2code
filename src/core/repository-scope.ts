const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:\//;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/**
 * Returns the stable, repository-relative alias used as record provenance.
 * The current repository may be represented by `.`, matching Git extraction.
 */
export function canonicalRepositoryRoot(value: string): string {
  if (value.length === 0 || value.trim() !== value) {
    throw new TypeError('repositoryRoot must be a non-blank canonical alias');
  }
  if (value.includes('\\')) {
    throw new TypeError('repositoryRoot must use forward-slash separators');
  }

  const canonical = value.normalize('NFC');
  if (canonical.startsWith('/') || WINDOWS_ABSOLUTE_PATH.test(canonical)) {
    throw new TypeError('repositoryRoot must be relative');
  }
  if (CONTROL_CHARACTER.test(canonical)) {
    throw new TypeError('repositoryRoot must not contain control characters');
  }
  if (canonical === '.') return canonical;

  const segments = canonical.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new TypeError('repositoryRoot must not contain empty, current or parent path segments');
  }
  return segments.join('/');
}
